from fastapi import FastAPI, HTTPException
from pipelines.langchain_pipeline import LangChainPipeline
from pipelines.rerank_pipeline import RerankPipeline
from services.context_manager import ContextManager
import uvicorn

app = FastAPI(title="AI Concierge Service", version="1.0.0")

# Initialize pipelines and context
langchain = LangChainPipeline()
rerank = RerankPipeline()
context_mgr = ContextManager()

@app.post("/api/v1/query/text")
def text_query(request: dict):
    try:
        ctx = context_mgr.load(request.get("session_id"))
        response = langchain.run(request["text"], ctx)
        ranked = rerank.run(response)
        context_mgr.save(request.get("session_id"), ranked)
        return ranked
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
