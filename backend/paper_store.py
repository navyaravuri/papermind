"""Paper metadata + index persistence.

Each paper lives in three places on disk:
- ../data/<paper_id>.pdf            — raw PDF
- ../indexes/<paper_id>/            — VectorStoreIndex
- ../indexes/<paper_id>_summary/    — SummaryIndex (used by the multi-doc agent)

Metadata for every indexed paper is mirrored to data/papers.json so the
list/delete endpoints don't have to re-scan disk on every request.
"""

import json
import re
import shutil
from pathlib import Path
from typing import Optional

import fitz  # pymupdf
from llama_index.core import (
    Document,
    StorageContext,
    SummaryIndex,
    VectorStoreIndex,
    load_index_from_storage,
)

BACKEND_DIR = Path(__file__).parent
DATA_DIR = BACKEND_DIR / "data"
INDEX_ROOT = BACKEND_DIR / "indexes"
METADATA_FILE = DATA_DIR / "papers.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
INDEX_ROOT.mkdir(parents=True, exist_ok=True)


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "_", text)
    return text.strip("_") or "paper"


def _load_metadata() -> dict:
    if METADATA_FILE.exists():
        return json.loads(METADATA_FILE.read_text())
    return {}


def _save_metadata(meta: dict) -> None:
    METADATA_FILE.write_text(json.dumps(meta, indent=2))


def unique_paper_id(base: str) -> str:
    """Slugify `base` and append `_2`, `_3`, ... if the id is already used."""
    slug = _slugify(base)
    meta = _load_metadata()
    if slug not in meta:
        return slug
    i = 2
    while f"{slug}_{i}" in meta:
        i += 1
    return f"{slug}_{i}"


def load_pdf_as_documents(pdf_path: Path) -> list[Document]:
    pdf = fitz.open(str(pdf_path))
    docs = [
        Document(
            text=page.get_text(),
            metadata={"page": i + 1, "source": pdf_path.name},
        )
        for i, page in enumerate(pdf)
    ]
    pdf.close()
    return docs


def extract_title(pdf_path: Path, fallback: str) -> str:
    """Best-effort title extraction: PDF metadata → first non-empty line → fallback."""
    try:
        pdf = fitz.open(str(pdf_path))
        meta_title = (pdf.metadata or {}).get("title") or ""
        first_page = pdf.load_page(0).get_text() if pdf.page_count else ""
        pdf.close()
    except Exception:
        return fallback

    if meta_title and len(meta_title.strip()) > 3:
        return meta_title.strip()

    for line in first_page.splitlines():
        line = line.strip()
        if len(line) > 8 and not line.lower().startswith(("arxiv", "preprint", "submitted")):
            return line
    return fallback


def vector_dir(paper_id: str) -> Path:
    return INDEX_ROOT / paper_id


def summary_dir(paper_id: str) -> Path:
    return INDEX_ROOT / f"{paper_id}_summary"


def pdf_path(paper_id: str) -> Path:
    return DATA_DIR / f"{paper_id}.pdf"


def build_indexes(paper_id: str, title: str, filename: str) -> dict:
    """Build (or rebuild) vector + summary indexes for a paper, then register it."""
    pdf = pdf_path(paper_id)
    if not pdf.exists():
        raise FileNotFoundError(f"PDF not on disk: {pdf}")

    docs = load_pdf_as_documents(pdf)

    v_dir = vector_dir(paper_id)
    v_dir.mkdir(parents=True, exist_ok=True)
    vector_index = VectorStoreIndex.from_documents(docs)
    vector_index.storage_context.persist(persist_dir=str(v_dir))

    s_dir = summary_dir(paper_id)
    s_dir.mkdir(parents=True, exist_ok=True)
    summary_index = SummaryIndex.from_documents(docs)
    summary_index.storage_context.persist(persist_dir=str(s_dir))

    meta = _load_metadata()
    record = {"paper_id": paper_id, "title": title, "filename": filename}
    meta[paper_id] = record
    _save_metadata(meta)
    return record


def load_vector_index(paper_id: str) -> VectorStoreIndex:
    d = vector_dir(paper_id)
    if not d.exists() or not any(d.iterdir()):
        raise FileNotFoundError(f"No vector index for paper_id={paper_id}")
    return load_index_from_storage(StorageContext.from_defaults(persist_dir=str(d)))


def load_summary_index(paper_id: str):
    d = summary_dir(paper_id)
    if not d.exists() or not any(d.iterdir()):
        return None
    return load_index_from_storage(StorageContext.from_defaults(persist_dir=str(d)))


def list_papers() -> list[dict]:
    """Registered papers from metadata, plus any indexes-on-disk we didn't know about
    (so papers indexed by the notebooks before this backend existed still show up)."""
    meta = _load_metadata()
    known = set(meta.keys())

    # Pick up notebook-created indexes that aren't in papers.json yet.
    for d in INDEX_ROOT.iterdir():
        if not d.is_dir() or d.name.endswith("_summary"):
            continue
        if d.name in known:
            continue
        if not any(d.iterdir()):
            continue
        pdf = pdf_path(d.name)
        meta[d.name] = {
            "paper_id": d.name,
            "title": d.name.replace("_", " ").title(),
            "filename": pdf.name if pdf.exists() else f"{d.name}.pdf",
        }
    if meta != _load_metadata():
        _save_metadata(meta)

    return list(meta.values())


def get_paper(paper_id: str) -> Optional[dict]:
    return _load_metadata().get(paper_id) or next(
        (p for p in list_papers() if p["paper_id"] == paper_id), None
    )


def delete_paper(paper_id: str) -> bool:
    pdf = pdf_path(paper_id)
    if pdf.exists():
        pdf.unlink()
    for d in (vector_dir(paper_id), summary_dir(paper_id)):
        if d.exists():
            shutil.rmtree(d)

    meta = _load_metadata()
    existed = paper_id in meta
    meta.pop(paper_id, None)
    _save_metadata(meta)
    return existed


def add_figure_description_to_index(paper_id: str, description: str, image_path: str) -> None:
    """Append a multi-modal figure description as a new node in the paper's vector index."""
    index = load_vector_index(paper_id)
    doc = Document(
        text=description,
        metadata={
            "source_type": "figure_description",
            "image_path": image_path,
        },
    )
    index.insert(doc)
    index.storage_context.persist(persist_dir=str(vector_dir(paper_id)))
