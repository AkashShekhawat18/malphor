import json
from typing import List, Dict, Any
from groq import Groq
from fastapi.responses import StreamingResponse
import os
import random
import logging

logger = logging.getLogger(__name__)

from services.vector_service import search_global_pyq
from services.embedding_service import get_embeddings

def get_groq_client():
    use_ollama = os.environ.get("USE_OLLAMA", "false").lower() == "true"
    if use_ollama:
        from openai import OpenAI
        ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        return OpenAI(api_key="ollama", base_url=f"{ollama_url}/v1")
    
    keys = os.environ.get("GROQ_API_KEYS", "")
    key_list = [k.strip() for k in keys.split(",") if k.strip()]
    if not key_list:
        raise ValueError("GROQ_API_KEYS not configured")
    api_key = random.choice(key_list)
    return Groq(api_key=api_key)

def get_model_name():
    if os.environ.get("USE_OLLAMA", "false").lower() == "true":
        return os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")
    return "qwen/qwen3.8-27b"

async def stream_pyq_chat(
    user_message: str, 
    chat_type: str, 
    context_data: Dict[str, Any], 
    history: List[Dict[str, str]]
):
    """
    Handles streaming responses for both PAPER_SPECIFIC and GLOBAL_LIBRARY chatbots.
    chat_type: "PAPER_SPECIFIC" or "GLOBAL_LIBRARY"
    context_data: dict containing current paper details or global filters
    """
    client = get_groq_client()
    
    system_prompt = """You are MALPHOR (MALPHOR AI), an expert academic professor and PYQ (Previous Year Question) analyzer.
    You analyze exam papers, identify trends, explain concepts, and provide actionable insights.
    
    CRITICAL INSTRUCTIONS FOR ACCURACY:
    1. NEVER hallucinate facts. If you do not know the answer, state that clearly.
    2. For Advanced Physics, Mathematics, and Quantum Mechanics: ALWAYS think step-by-step and rigorously verify your formulas before answering.
    3. Double-check standard quantum computing concepts (e.g., phase kickback requires initializing the target qubit to the |-> state, not |1>).
    4. Rely strictly on the provided context if it contains the answer.
    
    BEHAVIOR RULES:
    - If the user says a simple greeting (e.g., "hi", "hello"), respond warmly with a short greeting and ask how you can assist them with the paper. DO NOT output the full paper analysis statistics automatically unless explicitly asked to summarize or analyze the paper.
    - Only provide the paper stats (Repetition %, Fully Repeated, etc.) when the user asks for a summary, analysis, or stats of the paper.
    - Answer user questions naturally and concisely based on the context.
    
    FORMATTING RULES:
    - Use Markdown for all responses.
    - For inline math, ALWAYS wrap LaTeX in single dollar signs: $...$. Example: $f(x) = 0$, $|\\psi\\rangle$, $\\frac{1}{2}$.
    - For display/block math, ALWAYS wrap LaTeX in double dollar signs on their own lines: $$...$$
    - NEVER output raw LaTeX commands like \\frac, \\sum, \\alpha without wrapping them in $ or $$ delimiters.
    - Use **bold** and bullet points for clarity."""
    
    context_text = ""
    
    if chat_type == "PAPER_SPECIFIC":
        paper_stats = context_data.get("analytics", {})
        similarity_results = context_data.get("similarityResults", [])
        
        context_text = f"Context: Currently analyzing a specific exam paper.\n"
        context_text += f"Overall Repetition: {paper_stats.get('overallRepetitionPercent', 0)}%\n"
        context_text += f"Fully Repeated: {paper_stats.get('fullyRepeated', 0)}\n"
        context_text += f"Concept Repeated: {paper_stats.get('conceptRepeated', 0)}\n"
        context_text += f"New Questions: {paper_stats.get('newQuestions', 0)}\n\n"
        
        current_questions = context_data.get("currentQuestions", [])
        if current_questions:
            context_text += "Current Paper Questions:\n"
            for q in current_questions:
                context_text += f"Q{q.get('questionNo')}: {q.get('questionText')}\n"
                for img in q.get("images", []):
                    context_text += f"  -> [Attached Diagram: {img.get('type')}] Description: {img.get('description')}\n"
            context_text += "\n"
        
        context_text += "Similarity Details:\n"
        if not isinstance(similarity_results, list):
            similarity_results = []
        for res in similarity_results[:10]: # Limit to top 10 to fit context window
            if not isinstance(res, dict):
                continue
            context_text += f"- Question '{res.get('sourceQuestionId', '?')}' matched '{res.get('targetQuestionId', '?')}' with {res.get('overallSimilarity', 0)}% ({res.get('matchType', 'N/A')}). Reason: {res.get('reasoning', 'N/A')}\n"
            
    elif chat_type == "GLOBAL_LIBRARY":
        emb_query = get_embeddings([user_message])[0]
        raw_results = search_global_pyq(emb_query, n_results=5)
        
        if not raw_results:
             context_text = "Context: I don't have enough PYQ data for this."
        else:
             context_text = "Context: Relevant historical questions retrieved from the Global PYQ Library:\n\n"
             for i, res in enumerate(raw_results):
                 meta = res.get("metadata", {})
                 text = res.get("text", "")
                 context_text += f"--- Result {i+1} ---\n"
                 context_text += f"Text: {text}\n"
                 context_text += f"Marks: {meta.get('marks', 'N/A')} | Topic: {meta.get('topic', 'N/A')} | Concept: {meta.get('meta_concept', 'N/A')}\n\n"
        
    messages = [{"role": "system", "content": system_prompt + "\n\n" + context_text}]
    
    # Add history
    for msg in history[-5:]: # Last 5 messages
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    messages.append({"role": "user", "content": user_message})
    
    def generate():
        try:
            stream = client.chat.completions.create(
                model=get_model_name(),
                messages=messages,
                temperature=0.3,
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield f"data: {json.dumps({'text': chunk.choices[0].delta.content})}\n\n"
                    
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Chat error: {e}", exc_info=True)
            yield f"data: {json.dumps({'text': 'Sorry, I encountered an error while processing your request. Please try again later.'})}\n\n"
            yield "data: [DONE]\n\n"
            
    return StreamingResponse(generate(), media_type="text/event-stream")
