"""PaperMind FastAPI backend.

One endpoint per notebook pattern, sharing a single LLM + embedding setup
loaded from `llm_setup.py`. Paper PDFs land in `data/`, their persisted
indexes in `indexes/<paper_id>/`.
"""

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Importing this configures the global LlamaIndex Settings.
from llm_setup import gemini_llm, multimodal_llm, reasoning_llm
import paper_store

from llama_index.core.tools import QueryEngineTool
from llama_index.core.query_engine import RouterQueryEngine, SubQuestionQueryEngine
from llama_index.core.selectors import LLMSingleSelector
from llama_index.core.question_gen.llm_generators import LLMQuestionGenerator
from llama_index.core.agent.workflow import (
    ReActAgent,
    AgentStream,
    ToolCall,
    ToolCallResult,
)
from llama_index.core.postprocessor import SentenceTransformerRerank
from llama_index.core.objects import ObjectIndex
from llama_index.core import Settings, VectorStoreIndex
from llama_index.core.callbacks import CallbackManager, CBEventType, EventPayload
from llama_index.core.callbacks.base_handler import BaseCallbackHandler
from llama_index.core.llms import ChatMessage
from llama_index.core.base.llms.types import ImageBlock, TextBlock

DEMO_KEY = os.getenv("DEMO_KEY")

_default_origins = ["http://localhost:3000", "http://localhost:5173"]
_frontend_origin = os.getenv("FRONTEND_ORIGIN")
allow_origins = (
    [o.strip() for o in _frontend_origin.split(",") if o.strip()] + _default_origins
    if _frontend_origin
    else _default_origins
)


def require_demo_key(request: Request, x_demo_key: Optional[str] = Header(default=None)):
    # /health stays public so the Space URL can be pinged without a key.
    # No-op when DEMO_KEY is unset so local dev stays frictionless.
    if request.url.path == "/health":
        return
    if DEMO_KEY and x_demo_key != DEMO_KEY:
        raise HTTPException(status_code=401, detail="invalid or missing X-Demo-Key")


app = FastAPI(title="PaperMind API", dependencies=[Depends(require_demo_key)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request / response models ----------


class QueryByPaper(BaseModel):
    paper_id: str
    question: str


class MultiPaperQuery(BaseModel):
    question: str
    paper_ids: list[str]


class GlobalQuery(BaseModel):
    question: str


# ---------- Helpers ----------


def _source_from_node(node) -> dict:
    return {
        "text": node.node.get_content()[:500],
        "page": node.node.metadata.get("page"),
    }


def _paper_description(paper: dict) -> str:
    title = paper.get("title") or paper["paper_id"]
    return (
        f"Content of the paper '{title}' (paper_id={paper['paper_id']}). "
        "Use for any factual question about this paper's methods, results, "
        "or contributions."
    )


def _tool_name(paper_id: str, suffix: str = "") -> str:
    safe = re.sub(r"[^A-Za-z0-9_]", "_", paper_id)
    return f"{safe}{suffix}"


def _query_engine_tool(paper_id: str, title: str) -> QueryEngineTool:
    index = paper_store.load_vector_index(paper_id)
    description = _paper_description({"paper_id": paper_id, "title": title})
    return QueryEngineTool.from_defaults(
        query_engine=index.as_query_engine(similarity_top_k=3, llm=reasoning_llm()),
        name=_tool_name(paper_id),
        description=description,
    )


def _papers_or_404(paper_ids: list[str]) -> list[dict]:
    out = []
    for pid in paper_ids:
        p = paper_store.get_paper(pid)
        if p is None:
            raise HTTPException(status_code=404, detail=f"paper_id not found: {pid}")
        out.append(p)
    return out


# ---------- Health ----------


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- Papers ----------


@app.post("/papers/upload")
async def upload_paper(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    stem = Path(file.filename).stem
    paper_id = paper_store.unique_paper_id(stem)
    dest = paper_store.pdf_path(paper_id)
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    title = paper_store.extract_title(dest, fallback=stem.replace("_", " ").title())
    record = paper_store.build_indexes(paper_id, title=title, filename=file.filename)
    return record


@app.get("/papers")
def list_papers():
    return paper_store.list_papers()


@app.delete("/papers/{paper_id}")
def delete_paper(paper_id: str):
    existed = paper_store.delete_paper(paper_id)
    if not existed:
        raise HTTPException(status_code=404, detail=f"paper_id not found: {paper_id}")
    return {"paper_id": paper_id, "deleted": True}


# ---------- Query: basic RAG ----------


@app.post("/query/rag")
def query_rag(body: QueryByPaper):
    _papers_or_404([body.paper_id])
    index = paper_store.load_vector_index(body.paper_id)
    engine = index.as_query_engine(similarity_top_k=3, llm=gemini_llm)
    response = engine.query(body.question)
    return {
        "answer": str(response),
        "sources": [_source_from_node(n) for n in response.source_nodes],
    }


# ---------- Query: router ----------


@app.post("/query/router")
def query_router(body: MultiPaperQuery):
    if not body.paper_ids:
        raise HTTPException(status_code=400, detail="paper_ids must be non-empty")
    papers = _papers_or_404(body.paper_ids)
    tools = [_query_engine_tool(p["paper_id"], p["title"]) for p in papers]

    llm = reasoning_llm()
    router = RouterQueryEngine(
        selector=LLMSingleSelector.from_defaults(llm=llm),
        query_engine_tools=tools,
        llm=llm,
    )
    response = router.query(body.question)

    selected_paper = None
    routing_reason = None
    sel = response.metadata.get("selector_result") if response.metadata else None
    if sel and sel.selections:
        choice = sel.selections[0]
        # tool index matches the order we passed in `tools`
        selected_paper = papers[choice.index]["paper_id"]
        routing_reason = choice.reason

    return {
        "answer": str(response),
        "selected_paper": selected_paper,
        "routing_reason": routing_reason,
    }


# ---------- Query: sub-question ----------


SUBQ_PATTERN = re.compile(r"^Sub question:\s*(?P<q>.+?)\s*Response:\s*(?P<a>.+)$", re.DOTALL)


class _SubQuestionCapture(BaseCallbackHandler):
    """Captures every SUB_QUESTION event so we can return which tool answered
    each sub-question — the source-node text doesn't carry the tool name."""

    def __init__(self):
        super().__init__(event_starts_to_ignore=[], event_ends_to_ignore=[])
        self.pairs = []

    def start_trace(self, trace_id=None):
        pass

    def end_trace(self, trace_id=None, trace_map=None):
        pass

    def on_event_start(self, event_type, payload=None, event_id="", parent_id="", **kwargs):
        return event_id

    def on_event_end(self, event_type, payload=None, event_id="", **kwargs):
        if event_type == CBEventType.SUB_QUESTION and payload is not None:
            sqp = payload.get(EventPayload.SUB_QUESTION)
            if sqp is not None:
                self.pairs.append(sqp)


@app.post("/query/subquestion")
def query_subquestion(body: MultiPaperQuery):
    if not body.paper_ids:
        raise HTTPException(status_code=400, detail="paper_ids must be non-empty")
    papers = _papers_or_404(body.paper_ids)
    tools = [_query_engine_tool(p["paper_id"], p["title"]) for p in papers]

    capture = _SubQuestionCapture()
    # Temporarily swap the global callback manager so the engine and its
    # synthesizer (built via from_defaults) pick it up. Restored in finally
    # so we don't pollute concurrent requests once they finish.
    previous_manager = Settings.callback_manager
    Settings.callback_manager = CallbackManager([capture])

    try:
        llm = reasoning_llm()
        engine = SubQuestionQueryEngine.from_defaults(
            query_engine_tools=tools,
            question_gen=LLMQuestionGenerator.from_defaults(llm=llm),
            llm=llm,
            use_async=False,
            verbose=False,
        )
        response = engine.query(body.question)
    finally:
        Settings.callback_manager = previous_manager

    tool_to_paper = {_tool_name(p["paper_id"]): p["paper_id"] for p in papers}

    subquestions = []
    for sqp in capture.pairs:
        sub_q = getattr(sqp, "sub_q", None)
        tool_name = getattr(sub_q, "tool_name", None) if sub_q else None
        subquestions.append({
            "question": getattr(sub_q, "sub_question", "") if sub_q else "",
            "answer": str(getattr(sqp, "answer", "") or ""),
            "tool_name": tool_name,
            "paper_id": tool_to_paper.get(tool_name) if tool_name else None,
        })

    # Fallback: if the callback captured nothing (rare — older LI versions),
    # fall back to parsing the source nodes so the client still gets something.
    if not subquestions:
        for n in response.source_nodes:
            m = SUBQ_PATTERN.match(n.node.get_content())
            if m:
                subquestions.append({
                    "question": m.group("q").strip(),
                    "answer": m.group("a").strip(),
                    "tool_name": None,
                    "paper_id": None,
                })

    return {"answer": str(response), "subquestions": subquestions}


# ---------- Query: ReAct agent ----------


@app.post("/query/agent")
async def query_agent(body: MultiPaperQuery):
    if not body.paper_ids:
        raise HTTPException(status_code=400, detail="paper_ids must be non-empty")
    papers = _papers_or_404(body.paper_ids)
    tools = [_query_engine_tool(p["paper_id"], p["title"]) for p in papers]
    tool_to_paper = {_tool_name(p["paper_id"]): p["paper_id"] for p in papers}

    llm = reasoning_llm()
    agent = ReActAgent(tools=tools, llm=llm)
    handler = agent.run(user_msg=body.question)

    trace: list[dict] = []
    current_thought = ""
    pending_action: Optional[dict] = None

    async for ev in handler.stream_events():
        if isinstance(ev, AgentStream):
            current_thought += ev.delta
        elif isinstance(ev, ToolCall):
            kwargs = dict(ev.tool_kwargs)
            pending_action = {
                "thought": current_thought.strip(),
                "tool_name": ev.tool_name,
                "tool_kwargs": kwargs,
                "paper_id": tool_to_paper.get(ev.tool_name),
                # Human-readable form for direct display in the UI.
                "action": f"{ev.tool_name}({kwargs})",
                "observation": "",
            }
            current_thought = ""
        elif isinstance(ev, ToolCallResult):
            obs = str(ev.tool_output)
            if pending_action is None:
                pending_action = {
                    "thought": current_thought.strip(),
                    "tool_name": None,
                    "tool_kwargs": {},
                    "paper_id": None,
                    "action": "",
                    "observation": "",
                }
                current_thought = ""
            pending_action["observation"] = obs[:600]
            trace.append(pending_action)
            pending_action = None

    response = await handler
    return {"answer": str(response), "reasoning_trace": trace}


# ---------- Query: multi-document agent ----------


_reranker_singleton: Optional[SentenceTransformerRerank] = None


def _get_reranker() -> SentenceTransformerRerank:
    global _reranker_singleton
    if _reranker_singleton is None:
        _reranker_singleton = SentenceTransformerRerank(
            model="cross-encoder/ms-marco-MiniLM-L-6-v2", top_n=3
        )
    return _reranker_singleton


def _multidoc_tools(papers: list[dict]) -> list[QueryEngineTool]:
    reranker = _get_reranker()
    llm = reasoning_llm()
    tools: list[QueryEngineTool] = []
    for p in papers:
        pid, title = p["paper_id"], p.get("title") or p["paper_id"]
        v_index = paper_store.load_vector_index(pid)

        vector_tool = QueryEngineTool.from_defaults(
            query_engine=v_index.as_query_engine(
                similarity_top_k=10,
                node_postprocessors=[reranker],
                llm=llm,
            ),
            name=_tool_name(pid, "_vector"),
            description=(
                f"Specific factual questions about the paper '{title}'. "
                "Use for narrow, fact-seeking queries about methods, numbers, or results."
            ),
        )
        summary_engine = v_index.as_query_engine(
            similarity_top_k=10,
            response_mode="tree_summarize",
            llm=llm,
        )
        summary_tool = QueryEngineTool.from_defaults(
            query_engine=summary_engine,
            name=_tool_name(pid, "_summary"),
            description=(
                f"High-level summary of the paper '{title}'. "
                "Use for 'what is this paper about?' or 'summarise the contributions'."
            ),
        )
        tools.extend([vector_tool, summary_tool])
    return tools


@app.post("/query/multidoc")
async def query_multidoc(body: GlobalQuery):
    papers = paper_store.list_papers()
    if not papers:
        raise HTTPException(status_code=400, detail="No indexed papers available")

    tools = _multidoc_tools(papers)
    obj_index = ObjectIndex.from_objects(objects=tools, index_cls=VectorStoreIndex)
    tool_retriever = obj_index.as_retriever(similarity_top_k=min(3, len(tools)))

    llm = reasoning_llm()
    agent = ReActAgent(tool_retriever=tool_retriever, llm=llm)
    handler = agent.run(user_msg=body.question)

    contributions: dict[str, list[str]] = {}
    async for ev in handler.stream_events():
        if isinstance(ev, ToolCallResult):
            tool_name = getattr(ev, "tool_name", "") or ""
            paper_id = tool_name.removesuffix("_vector").removesuffix("_summary")
            if any(paper_id == p["paper_id"] for p in papers):
                obs = str(ev.tool_output).replace("\n", " ").strip()
                contributions.setdefault(paper_id, []).append(obs[:400])

    response = await handler
    return {
        "answer": str(response),
        "sources": [
            {"paper_id": pid, "contribution": " | ".join(obs_list)}
            for pid, obs_list in contributions.items()
        ],
    }


# ---------- Query: multi-modal ----------


@app.post("/query/multimodal")
async def query_multimodal(
    image: UploadFile = File(...),
    question: str = Form(...),
    paper_id: Optional[str] = Form(None),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="image must be an image upload")

    suffix = Path(image.filename or "upload.png").suffix or ".png"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(image.file, tmp)
        tmp.close()

        answer_msg = ChatMessage(
            role="user",
            blocks=[TextBlock(text=question), ImageBlock(path=tmp.name)],
        )
        # `achat` instead of `chat` — the sync wrapper calls asyncio.run()
        # internally and crashes inside FastAPI's running event loop.
        answer_resp = await multimodal_llm.achat([answer_msg])
        answer = (answer_resp.message.content or "").strip()

        describe_msg = ChatMessage(
            role="user",
            blocks=[
                TextBlock(text="Describe this image in detail for a research-paper index."),
                ImageBlock(path=tmp.name),
            ],
        )
        describe_resp = await multimodal_llm.achat([describe_msg])
        description = (describe_resp.message.content or "").strip()

        if paper_id:
            if paper_store.get_paper(paper_id) is None:
                raise HTTPException(status_code=404, detail=f"paper_id not found: {paper_id}")
            # Keep the image alongside the paper so the index pointer stays valid.
            figures_dir = paper_store.DATA_DIR / "figures"
            figures_dir.mkdir(parents=True, exist_ok=True)
            persisted = figures_dir / f"{paper_id}_{Path(tmp.name).name}"
            shutil.copy(tmp.name, persisted)
            paper_store.add_figure_description_to_index(
                paper_id, description=description, image_path=str(persisted)
            )

        return {"answer": answer, "description": description}
    finally:
        Path(tmp.name).unlink(missing_ok=True)


# ---------- arXiv ----------


@app.get("/arxiv/search")
def arxiv_search(q: str, max_results: int = 5):
    import arxiv

    search = arxiv.Search(
        query=q,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    results = []
    for r in search.results():
        results.append({
            "title": r.title.strip(),
            "authors": [a.name for a in r.authors],
            "abstract": r.summary.strip(),
            "arxiv_id": r.get_short_id(),
            "pdf_url": r.pdf_url,
        })
    return results


@app.post("/arxiv/import/{arxiv_id}")
def arxiv_import(arxiv_id: str):
    import arxiv

    search = arxiv.Search(id_list=[arxiv_id])
    try:
        result = next(search.results())
    except StopIteration:
        raise HTTPException(status_code=404, detail=f"arXiv id not found: {arxiv_id}")

    paper_id = paper_store.unique_paper_id(arxiv_id.replace(".", "_"))
    dest = paper_store.pdf_path(paper_id)
    import requests

    r = requests.get(result.pdf_url, timeout=60)
    r.raise_for_status()
    dest.write_bytes(r.content)

    record = paper_store.build_indexes(
        paper_id, title=result.title.strip(), filename=f"{paper_id}.pdf"
    )
    return {"paper_id": record["paper_id"], "title": record["title"]}
