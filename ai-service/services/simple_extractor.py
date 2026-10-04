import fitz  # PyMuPDF
import uuid
import json
import logging
import requests
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:3b"

def extract_questions_simple(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Step 1: PyMuPDF extraction -> Ollama Qwen parsing.
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        logger.error(f"Failed to open PDF: {e}")
        return []

    full_text = ""
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        full_text += page.get_text("text") + "\n"

    if not full_text.strip():
        logger.warning("No text extracted from PDF. Might be an image-only PDF.")
        return []

    prompt = f"""
You are an expert academic document analyzer.
Extract all questions from the following text extracted from an exam paper.
Return ONLY a valid JSON array of objects. Do NOT wrap it in markdown code blocks.
For each question, extract:
- "questionNumber": The question number (e.g., "Q1", "1", "1(a)").
- "questionText": The full text of the question.
- "marks": Integer marks if mentioned, otherwise null.
- "pageNumber": 1

Text to extract:
{full_text}
"""
    
    try:
        response = requests.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=120)
        
        response.raise_for_status()
        result_text = response.json().get("response", "").strip()
        
        # Clean up any potential markdown if the model hallucinated it despite instructions
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
            
        questions = json.loads(result_text.strip())
        
        # Ensure it's a list and elements are dicts
        if not isinstance(questions, list):
            questions = [questions]
            
        valid_questions = []
        for q in questions:
            if not isinstance(q, dict):
                continue
            if "id" not in q:
                q["id"] = str(uuid.uuid4())
            if "metadata" not in q:
                q["metadata"] = {}
            if "embedding" not in q:
                q["embedding"] = []
            valid_questions.append(q)
            
        if len(valid_questions) == 0:
            return _fallback_extraction(full_text)
            
        return valid_questions
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama API error: {e}")
        return _fallback_extraction(full_text)
    except json.JSONDecodeError as e:
        logger.error(f"Ollama returned invalid JSON: {e}")
        return _fallback_extraction(full_text)
    except Exception as e:
        logger.error(f"Unexpected error parsing Ollama response: {e}")
        return _fallback_extraction(full_text)

def _fallback_extraction(full_text: str) -> List[Dict[str, Any]]:
    return [{
        "id": str(uuid.uuid4()),
        "questionNumber": "Raw Text",
        "questionText": full_text,
        "marks": None,
        "pageNumber": 1,
        "metadata": {},
        "embedding": []
    }]
