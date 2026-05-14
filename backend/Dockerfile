FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf_cache \
    SENTENCE_TRANSFORMERS_HOME=/app/.hf_cache

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Pre-bake model weights into the image so cold starts skip the download.
RUN python -c "from huggingface_hub import snapshot_download; \
    snapshot_download('BAAI/bge-base-en-v1.5'); \
    snapshot_download('cross-encoder/ms-marco-MiniLM-L-6-v2')"

COPY . .

RUN mkdir -p data indexes

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
