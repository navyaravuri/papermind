# PaperMind

A research assistant for academic papers. Upload PDFs (or pull them from arXiv), then ask questions in six different modes — each one wired to a different LlamaIndex pattern, from a single-paper RAG up to a multi-document ReAct agent and a multi-modal figure reader.

The whole thing is two pieces:

- **Backend** — FastAPI + LlamaIndex. PDFs land in `backend/data/`, persisted vector + summary indexes in `backend/indexes/<paper_id>/`.
- **Frontend** — React + Vite + Tailwind. Three-column layout (library / tabs / context panel).

## Prerequisites

- Python 3.10+
- Node 18+
- A `GEMINI_API_KEY` (free tier is fine — get one at <https://aistudio.google.com>)
- Optional but recommended: a `GROQ_API_KEY` for higher-RPM router/agent queries (free tier at <https://console.groq.com>). Without it the backend falls back to Gemini for those endpoints.

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

cp .env.example .env
# Then edit .env and fill in your keys:
#   GEMINI_API_KEY=...
#   GROQ_API_KEY=...   (optional)
```

The first query against any paper downloads the BGE embedding model (~440 MB) into the HuggingFace cache. The Agent / Paper Network tabs additionally download a small reranker (~90 MB) on first use.

### Frontend

```bash
cd frontend
npm install
```

## Running

Two terminals:

```bash
# Terminal 1 — backend on :8000
cd backend
./venv/bin/uvicorn main:app --reload

# Terminal 2 — frontend on :5173
cd frontend
npm run dev
```

Open <http://localhost:5173>. The backend exposes interactive API docs at <http://localhost:8000/docs>.

## The six tabs

| # | Tab | What it does |
|---|---|---|
| 1 | **Ask a Paper** | Single-paper RAG chat — pick one paper, ask focused questions, see source passages in the right panel. |
| 2 | **Smart Router** | The LLM picks which paper to consult per question across your whole library and explains its choice. |
| 3 | **Deep Dive** | Decomposes a complex question into per-paper sub-questions, then synthesises one final answer. |
| 4 | **Agent** | A ReAct agent that decides which paper tools to call — its Thought/Action/Observation trace plays back live. |
| 5 | **Paper Network** | Multi-document agent that pulls from every paper in your library and shows each paper's contribution. |
| 6 | **Figure Reader** | Drop a figure (diagram, plot, table) and ask Gemini what it shows; optionally save the description to a paper's index. |

## The six notebooks

The `backend/notebooks/` folder walks through the LlamaIndex pattern that backs each tab — read them in order to see how the production endpoints were built.

| # | Notebook | Pattern |
|---|---|---|
| 1 | `1_basic_rag.ipynb` | Single-paper VectorStoreIndex with Gemini + BGE embeddings. |
| 2 | `2_router_query_engine.ipynb` | `RouterQueryEngine` + `LLMSingleSelector` picking one paper per query. |
| 3 | `3_subquestion_engine.ipynb` | `SubQuestionQueryEngine` decomposing a query into per-paper sub-questions. |
| 4 | `4_react_agent.ipynb` | Workflow `ReActAgent` mixing calculator + paper retrieval tools, streamed event-by-event. |
| 5 | `5_multi_document_agents.ipynb` | `ObjectIndex` over vector + summary tools per paper, retrieved dynamically per query. |
| 6 | `6_multimodal.ipynb` | Multi-modal Gemini reading figure images and persisting descriptions back into the text index. |

## Project layout

```
backend/
  main.py              FastAPI app (one endpoint per notebook pattern)
  llm_setup.py         Shared LLM + embedding initialisation
  paper_store.py       Paper metadata + index persistence
  notebooks/           Six walkthrough notebooks
  data/                Uploaded PDFs + figure images
  indexes/             Persisted LlamaIndex storage per paper

frontend/
  src/
    App.jsx            Three-column shell + global state
    api.js             Fetch wrapper for all backend endpoints
    components/        Tabs, right-panel content, sidebar, journal drawer
    tabs.js            Tab metadata (id, label, right-panel header)
```
