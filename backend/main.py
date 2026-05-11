"""PaperMind FastAPI backend.

One endpoint per notebook pattern, sharing a single LLM + embedding setup
loaded from `llm_setup.py`. Paper PDFs land in `data/`, their persisted
indexes in `indexes/<paper_id>/`.
"""

import re
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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
from llama_index.core import VectorStoreIndex
from llama_index.core.llms import ChatMessage
from llama_index.core.base.llms.types import ImageBlock, TextBlock

app = FastAPI(title="PaperMind API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default
    ],
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


@app.post("/query/subquestion")
def query_subquestion(body: MultiPaperQuery):
    if not body.paper_ids:
        raise HTTPException(status_code=400, detail="paper_ids must be non-empty")
    papers = _papers_or_404(body.paper_ids)
    tools = [_query_engine_tool(p["paper_id"], p["title"]) for p in papers]

    llm = reasoning_llm()
    engine = SubQuestionQueryEngine.from_defaults(
        query_engine_tools=tools,
        question_gen=LLMQuestionGenerator.from_defaults(llm=llm),
        llm=llm,
        use_async=False,
        verbose=False,
    )
    response = engine.query(body.question)

    subquestions = []
    for n in response.source_nodes:
        m = SUBQ_PATTERN.match(n.node.get_content())
        if m:
            subquestions.append(
                {"question": m.group("q").strip(), "answer": m.group("a").strip()}
            )

    return {"answer": str(response), "subquestions": subquestions}


# ---------- Query: ReAct agent ----------


@app.post("/query/agent")
async def query_agent(body: MultiPaperQuery):
    if not body.paper_ids:
        raise HTTPException(status_code=400, detail="paper_ids must be non-empty")
    papers = _papers_or_404(body.paper_ids)
    tools = [_query_engine_tool(p["paper_id"], p["title"]) for p in papers]

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
            pending_action = {
                "thought": current_thought.strip(),
                "action": f"{ev.tool_name}({dict(ev.tool_kwargs)})",
                "observation": "",
            }
            current_thought = ""
        elif isinstance(ev, ToolCallResult):
            obs = str(ev.tool_output)
            if pending_action is None:
                pending_action = {"thought": current_thought.strip(), "action": "", "observation": ""}
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
        answer = (multimodal_llm.chat([answer_msg]).message.content or "").strip()

        describe_msg = ChatMessage(
            role="user",
            blocks=[
                TextBlock(text="Describe this image in detail for a research-paper index."),
                ImageBlock(path=tmp.name),
            ],
        )
        description = (
            multimodal_llm.chat([describe_msg]).message.content or ""
        ).strip()

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
