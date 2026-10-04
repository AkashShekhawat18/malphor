from groq import AsyncGroq
import os
import json
import asyncio
from sse_starlette.sse import EventSourceResponse

def get_groq_client():
    """
    Initialize Groq client from environment.
    Supports key rotation if multiple keys are provided via GROQ_API_KEYS.
    """
    api_key_str = os.getenv("GROQ_API_KEYS", "")
    if not api_key_str:
        api_key_str = os.getenv("GROQ_API_KEY", "")
        
    if not api_key_str:
        raise ValueError("No Groq API keys found in environment.")
        
    keys = [k.strip() for k in api_key_str.split(",") if k.strip()]
    # For simplicity, we just use the first key in the Python service.
    # A full rotation system could be implemented here as well.
    return AsyncGroq(api_key=keys[0])

async def stream_groq_response(messages: list):
    """
    Generator that yields chunks from the Groq API for Server-Sent Events (SSE).
    """
    try:
        client = get_groq_client()
        
        # We yield a starting token
        yield json.dumps({"type": "start"})
        
        stream = await client.chat.completions.create(
            messages=messages,
            model="qwen/qwen3.8-27b",
            temperature=0.7,
            max_tokens=2048,
            stream=True
        )
        
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield json.dumps({"type": "token", "content": content})
                # Yield control slightly to allow event loop to flush SSE
                await asyncio.sleep(0.001)
                
        yield json.dumps({"type": "done"})
        
    except Exception as e:
        print(f"Groq Streaming Error: {e}")
        yield json.dumps({"type": "error", "content": str(e)})

def create_sse_response(messages: list):
    """
    Wrap the generator in an EventSourceResponse for the FastAPI route.
    """
    return EventSourceResponse(stream_groq_response(messages))
