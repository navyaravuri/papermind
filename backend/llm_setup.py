"""Shared LLM + embedding initialisation.

Importing this module configures the global LlamaIndex `Settings` once, so
every endpoint can just `from llm_setup import gemini_llm, groq_llm, ...`
without re-running the heavy embedding-model load on each call.

Provider choices (kept in sync with the notebooks):
- Gemini 2.5 Flash  — default text LLM for single-call RAG
- Gemini 2.5 Flash Lite — multi-modal (text + image) calls
- Groq llama-3.3-70b-versatile — routers, agents, sub-question (higher RPM)
- BGE base — local embeddings (no API quota)
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).parent
load_dotenv(BACKEND_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in backend/.env")

from llama_index.llms.google_genai import GoogleGenAI
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core import Settings

gemini_llm = GoogleGenAI(model="gemini-2.5-flash", api_key=GEMINI_API_KEY)
multimodal_llm = GoogleGenAI(model="gemini-2.5-flash-lite", api_key=GEMINI_API_KEY)

groq_llm = None
if GROQ_API_KEY:
    from llama_index.llms.groq import Groq
    groq_llm = Groq(model="llama-3.3-70b-versatile", api_key=GROQ_API_KEY)

embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-base-en-v1.5")

Settings.llm = gemini_llm
Settings.embed_model = embed_model


def reasoning_llm():
    """LLM used for routers / agents / sub-question decomposition.

    Prefer Groq when available (higher RPM, better tool-calling), fall back
    to Gemini so the backend still runs without a Groq key.
    """
    return groq_llm or gemini_llm
