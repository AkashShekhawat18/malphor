from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import uvicorn
import os
import asyncio
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

from services.upload_service import process_upload
from services.chat_service import handle_chat_stream
from services.vector_service import delete_collection_for_user
from services.document_intelligence import process_pyq_document, process_pyq_document_stream
from services.similarity_engine import search_pyq_database, compute_overall_paper_analytics
from services.replacement_engine import generate_question_replacement, generate_updated_pdf
from services.pyq_chat import stream_pyq_chat
from services.vector_service import delete_collection_for_user, store_global_pyq_chunks
from services.embedding_service import get_embeddings
from services.simple_extractor import extract_questions_simple
from fastapi.responses import Response


load_dotenv(override=True)

app = FastAPI(title="MALPHOR AI Microservice", version="1.0")

# CORS for direct frontend access if needed (Node proxy is preferred)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "malphor-ai"}

@app.post("/api/ai/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    user_id: str = Form(...),
    chat_id: Optional[str] = Form(None)
):
    """
    Handle document uploads: extract text (OCR if needed), chunk, and embed into ChromaDB.
    """
    try:
        results = []
        for file in files:
            result = await process_upload(file, user_id, chat_id=chat_id)
            results.append(result)
        return {"status": "success", "results": results}
    except Exception as e:
        logger.error(f"Upload Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

@app.post("/api/ai/chat/stream")
async def chat_stream(
    message: str = Form(...),
    user_id: str = Form(...),
    chat_id: Optional[str] = Form(None),
    history: str = Form("[]"), # JSON string of history
):
    """
    Stream response using RAG: Retrieve context -> Assemble prompt -> Stream Groq response.
    """
    try:
        import json
        history_list = json.loads(history)
        
        # Returns a StreamingResponse
        return await handle_chat_stream(message, user_id, chat_id, history_list)
    except Exception as e:
        logger.error(f"Chat Stream Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

@app.delete("/api/ai/memory/{user_id}")
async def clear_memory(user_id: str):
    """
    Clear all vector embeddings for a specific user.
    """
    success = delete_collection_for_user(user_id)
    if success:
        return {"status": "success", "message": "Memory cleared"}
    raise HTTPException(status_code=500, detail="Failed to clear memory")

@app.post("/api/ai/pyq/extract")
async def extract_pyq(file: UploadFile = File(...), stream: bool = False):
    """
    Extracts structured questions from a PDF or Image using Groq Vision and OpenCV.
    When stream=True, returns NDJSON progress events via StreamingResponse.
    """
    try:
        file_bytes = await file.read()

        if stream:
            # We don't support streaming for the simple extractor (it's instant anyway)
            pass

        questions = extract_questions_simple(file_bytes, file.filename)
        return {"status": "success", "questions": questions}
    except Exception as e:
        logger.error(f"PYQ Extraction Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

@app.post("/api/ai/pyq/similarity")
async def compute_similarity(
    questions: list = Body(...),
    historical_pool: list = Body(...)
):
    """
    Computes deep semantic similarity across 6 dimensions.
    """
    try:
        reports = await asyncio.to_thread(search_pyq_database, questions, historical_pool)
        analytics = await asyncio.to_thread(compute_overall_paper_analytics, questions, reports)
        
        return {
            "status": "success",
            "similarityResults": reports,
            "analytics": analytics
        }
    except Exception as e:
        logger.error(f"Similarity Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

@app.post("/api/ai/pyq/replace")
async def replace_question(
    original_question: dict = Body(...)
):
    """
    Generates a replacement for a repeated question.
    """
    try:
        replacement = generate_question_replacement(original_question)
        return {"status": "success", "replacement": replacement}
    except Exception as e:
        logger.error(f"PYQ Replace Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

@app.post("/api/ai/pyq/generate-pdf")
async def generate_pdf(
    questions: list = Body(...),
    title: str = Body("Updated Question Paper")
):
    """
    Generates a new PDF with the updated questions.
    """
    try:
        pdf_bytes = generate_updated_pdf(questions, title)
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        logger.error(f"PDF Generation Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

@app.post("/api/ai/pyq/index")
async def index_pyq(
    paper_id: str = Body(...),
    questions: list = Body(...)
):
    """
    Generate embeddings for extracted questions and index them into the Global PYQ vector DB.
    """
    try:
        if not questions:
            return {"status": "success", "message": "No questions to index"}
            
        texts_to_embed = []
        for q in questions:
            t = q.get("questionText", "")
            if q.get("latex"):
                t += f" {q.get('latex')}"
            texts_to_embed.append(t)
            
        embeddings = get_embeddings(texts_to_embed)
        
        success = store_global_pyq_chunks(paper_id, questions, embeddings)
        if success:
            return {"status": "success", "message": "PYQ indexed successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to store vectors")
    except Exception as e:
        logger.error(f"Index PYQ Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")
@app.post("/api/ai/context")
async def get_context(
    message: str = Form(...),
    user_id: str = Form(...),
    chat_id: Optional[str] = Form(None)
):
    """
    Retrieve RAG context for a user message, strictly scoped by chat_id.
    """
    try:
        from services.retrieval_service import retrieve_context
        context = retrieve_context(message, user_id, chat_id=chat_id, top_k=5)
        return {"status": "success", "context": context}
    except Exception as e:
        logger.error(f"Context Retrieval Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

@app.post("/api/ai/chat/delete")
async def delete_chat_memory(
    user_id: str = Form(...),
    chat_id: str = Form(...)
):
    """
    Purge vector store embeddings and memory chunks for a deleted chat_id.
    """
    try:
        from services.vector_service import delete_chunks_for_chat
        success = delete_chunks_for_chat(user_id, chat_id)
        return {"status": "success", "message": f"Memory purged for chat '{chat_id}'"}
    except Exception as e:
        logger.error(f"Delete Chat Memory Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

from pydantic import BaseModel
class PYQChatRequest(BaseModel):
    message: str
    chat_type: str
    context_data: dict = {}
    history: list = []

@app.post("/api/ai/pyq/chat/stream")
async def pyq_chat_stream(request: PYQChatRequest):
    try:
        return await stream_pyq_chat(
            request.message, 
            request.chat_type, 
            request.context_data, 
            request.history
        )
    except Exception as e:
        logger.error(f"PYQ Chat Stream Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred. Please try again.")

if __name__ == "__main__":
    env = os.getenv("ENVIRONMENT") or os.getenv("NODE_ENV", "development")
    is_development = env.lower() == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=is_development)
