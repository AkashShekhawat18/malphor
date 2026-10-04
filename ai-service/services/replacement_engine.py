import os
import random
import json
from groq import Groq
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import io

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

def generate_question_replacement(original_question: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates a replacement question that has the same topic, difficulty, marks,
    but tests a different logic or uses different values.
    """
    client = get_groq_client()
    
    q_text = original_question.get("questionText", "")
    marks = original_question.get("marks", 5)
    metadata = original_question.get("metadata", {})
    
    prompt = f"""
    You are an AI Professor. A question from a previous year paper has been flagged as repeated.
    You need to generate a high-quality alternative replacement question.
    
    Original Question: {q_text}
    Marks: {marks}
    Concept Tested: {metadata.get('concept', 'General')}
    Difficulty: {metadata.get('difficulty', 'MEDIUM')}
    
    CRITICAL REQUIREMENTS for the NEW question:
    1. Must test the EXACT SAME concept/subconcept.
    2. Must have the EXACT SAME difficulty level.
    3. Must be worth the EXACT SAME marks ({marks}).
    4. Must use DIFFERENT logic, values, or framing so it is not a blind repetition.
    5. For ALL math expressions, use LaTeX with proper delimiters:
       - Inline math: $...$ (e.g. $f(x) = 0$, $|\\psi\\rangle$)
       - Display math: $$...$$ on its own line
       - NEVER output raw LaTeX commands without dollar sign delimiters.
    
    Return a JSON object:
    {{
        "replacementText": "The new question text with $LaTeX$ math properly delimited",
        "reasoning": "Why this is a good substitute"
    }}
    """
    
    try:
        res = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=get_model_name(),
            response_format={"type": "json_object"},
            temperature=0.7
        )
        data = json.loads(res.choices[0].message.content)
        return {
            "originalId": original_question.get("id"),
            "replacementText": data.get("replacementText", ""),
            "reasoning": data.get("reasoning", ""),
            "marks": marks
        }
    except Exception as e:
        print(f"Replacement Error: {e}")
        return {
            "originalId": original_question.get("id"),
            "replacementText": "Error generating replacement.",
            "reasoning": str(e),
            "marks": marks
        }

def generate_updated_pdf(questions: list[Dict[str, Any]], title: str) -> bytes:
    """
    Generates a fresh PDF containing all questions (including replacements).
    Returns the PDF as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    story = []
    
    # Title
    story.append(Paragraph(f"<b>{title}</b>", styles['Title']))
    story.append(Spacer(1, 12))
    
    for idx, q in enumerate(questions):
        q_num = q.get("questionNumber", f"{idx+1}")
        q_text = q.get("replacementText") if q.get("replacementText") else q.get("questionText", "")
        marks = q.get("marks", "")
        
        marks_str = f" [{marks} Marks]" if marks else ""
        
        # Simple rendering for now (ReportLab doesn't natively render LaTeX out of the box, 
        # but this suffices for the download feature as a V1)
        p = Paragraph(f"<b>Q{q_num}.</b> {q_text} <i>{marks_str}</i>", styles['Normal'])
        story.append(p)
        story.append(Spacer(1, 12))
        
    doc.build(story)
    return buffer.getvalue()
