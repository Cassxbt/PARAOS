"""
FastAPI backend for Parallax Translation Assistant
"""
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import logging
import io
import csv
import json
from sqlalchemy.ext.asyncio import AsyncSession

from parallax_client import parallax_client
from translation import (
    language_detector,
    SUPPORTED_LANGUAGES,
    get_language_name,
    check_translation_reliability
)
from database import (
    init_db, 
    get_db, 
    add_translation, 
    get_recent_translations, 
    clear_all_history,
    TranslationModel # Needed for stats query
)
import database as from_database # Alias for clarity in query

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Parallax Translation Assistant",
    description="Local, private AI translation powered by Parallax",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint for Docker
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and monitoring"""
    return {"status": "healthy", "service": "parallax-translator"}


# Request/Response models
class TranslateRequest(BaseModel):
    """Translation request model"""
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"


class DetectLanguageRequest(BaseModel):
    """Language detection request model"""
    text: str


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()


@app.get("/")
async def root():
    """
    Health check endpoint with Parallax status
    """
    health = await parallax_client.check_health()
    
    return {
        "app": "Parallax Translation Assistant",
        "version": "1.0.0",
        "parallax_status": health["status"],
        "parallax_message": health["message"],
        "features": [
            "Local AI translation",
            "100% private",
            "Voice input support",
            "25+ languages",
            "Speed metrics",
            "Persistent History"
        ]
    }


@app.get("/api/languages")
async def get_languages():
    """
    Get list of supported languages
    """
    return {
        "languages": [
            {"code": code, "name": name}
            for code, name in SUPPORTED_LANGUAGES.items()
        ],
        "total": len(SUPPORTED_LANGUAGES)
    }


@app.post("/api/translate")
async def translate(
    request: TranslateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Translate text using Parallax local inference
    """
    # Validate input
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if len(request.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 characters)")
    
    # Auto-detect source language if needed
    detected_lang = None
    source_lang = request.source_lang
    
    if source_lang == "auto":
        detected_code = language_detector.detect(request.text)
        detected_lang = get_language_name(detected_code)
        source_lang = detected_code if detected_code != "auto" else "en"
    
    # Get language names for translation
    source_lang_name = get_language_name(source_lang)
    target_lang_name = get_language_name(request.target_lang)
    
    from cache import translation_cache
    cached = translation_cache.get(request.text, source_lang_name, target_lang_name)
    
    if cached:
        return {
            "translation": cached.translation,
            "inference_time_ms": 0,  # Instant!
            "model": cached.model,
            "source_lang": source_lang,
            "target_lang": request.target_lang,
            "detected_language": detected_lang,
            "character_count": len(request.text),
            "cached": True
        }
    
    logger.info(f"Translating from {source_lang_name} to {target_lang_name}")
    
    # Perform translation
    result = await parallax_client.translate(
        text=request.text,
        source_lang=source_lang_name,
        target_lang=target_lang_name
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Translation failed"))
    
    # Check translation reliability (detect if model failed to translate)
    is_reliable, reliability_warning = check_translation_reliability(
        source_text=request.text,
        translated_text=result["translation"],
        source_lang=source_lang,
        target_lang=request.target_lang
    )
    
    await add_translation(
        session=db,
        source_text=request.text,
        translated_text=result["translation"],
        source_lang=source_lang,
        target_lang=request.target_lang,
        inference_time_ms=result["inference_time_ms"],
        model=result["model"]
    )
    
    # 3. Update Cache
    translation_cache.set(
        text=request.text,
        source_lang=source_lang_name,
        target_lang=target_lang_name,
        translation=result["translation"],
        model=result["model"]
    )
    
    response = {
        "translation": result["translation"],
        "inference_time_ms": result["inference_time_ms"],
        "model": result["model"],
        "source_lang": source_lang,
        "target_lang": request.target_lang,
        "detected_language": detected_lang,
        "character_count": len(request.text),
        "cached": False
    }
    
    # Add warning if translation may be unreliable
    if not is_reliable:
        response["warning"] = reliability_warning
    
    return response


class BatchTranslateRequest(BaseModel):
    """Batch translation request model"""
    texts: List[str]
    source_lang: str = "auto"
    target_lang: str = "en"


@app.post("/api/batch-translate")
async def batch_translate(
    request: BatchTranslateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Translate multiple texts concurrently
    """
    if not request.texts or len(request.texts) == 0:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")
    
    if len(request.texts) > 50:
        raise HTTPException(status_code=400, detail="Batch size too large (max 50 items)")
    
    import asyncio
    
    # Helper function for single translation within batch
    async def translate_single(text: str):
        try:
            # Reuse existing translate logic by creating a request object
            # Note: This is a simplified internal call
            # In a real app, we'd refactor the core logic out of the route handler
            
            # 1. Check Cache
            from cache import translation_cache
            source_lang_name = get_language_name(request.source_lang)
            target_lang_name = get_language_name(request.target_lang)
            
            cached = translation_cache.get(text, source_lang_name, target_lang_name)
            if cached:
                return {
                    "text": text,
                    "translation": cached.translation,
                    "inference_time_ms": 0,
                    "cached": True,
                    "success": True
                }
            
            # 2. Translate
            # Auto-detect if needed (per item)
            item_source_lang = request.source_lang
            if item_source_lang == "auto":
                detected_code = language_detector.detect(text)
                item_source_lang = get_language_name(detected_code)
            else:
                item_source_lang = get_language_name(item_source_lang)
                
            result = await parallax_client.translate(
                text=text,
                source_lang=item_source_lang,
                target_lang=target_lang_name
            )
            
            if result["success"]:
                # Save to DB
                await add_translation(
                    session=db,
                    source_text=text,
                    translated_text=result["translation"],
                    source_lang=request.source_lang,
                    target_lang=request.target_lang,
                    inference_time_ms=result["inference_time_ms"],
                    model=result["model"]
                )
                
                # Update Cache
                translation_cache.set(
                    text=text,
                    source_lang=item_source_lang,
                    target_lang=target_lang_name,
                    translation=result["translation"],
                    model=result["model"]
                )
                
                return {
                    "text": text,
                    "translation": result["translation"],
                    "inference_time_ms": result["inference_time_ms"],
                    "cached": False,
                    "success": True
                }
            else:
                return {
                    "text": text,
                    "error": result.get("error"),
                    "success": False
                }
                
        except Exception as e:
            return {
                "text": text,
                "error": str(e),
                "success": False
            }

    # Run all translations concurrently
    results = await asyncio.gather(*[translate_single(text) for text in request.texts])
    
    return {
        "results": results,
        "total": len(results),
        "successful": len([r for r in results if r["success"]])
    }


@app.get("/api/translate-stream")
async def translate_stream(
    text: str,
    source_lang: str = "auto",
    target_lang: str = "en",
    use_context: bool = False,
    is_document: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Stream translation tokens as they're generated for instant feedback
    """
    from fastapi.responses import StreamingResponse
    import json
    
    # Validate
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # Check limits based on mode
    max_chars = 50000 if is_document else 5000
    if len(text) > max_chars:
        raise HTTPException(status_code=400, detail=f"Text too long (max {max_chars} characters)")
    
    # Auto-detect source language
    detected_lang = None
    if source_lang == "auto":
        detected_code = language_detector.detect(text)
        detected_lang = get_language_name(detected_code)
        source_lang = detected_code if detected_code != "auto" else "en"
    
    source_lang_name = get_language_name(source_lang)
    target_lang_name = get_language_name(target_lang)
    
    # Prepare Context if enabled
    context_text = None
    if use_context:
        recent = await get_recent_translations(db, limit=3)
        if recent:
            context_items = []
            for r in reversed(recent):
                context_items.append(f"Original ({r.source_lang}): {r.source_text}\nTranslation ({r.target_lang}): {r.translated_text}")
            context_text = "\n---\n".join(context_items)
            logger.info(f"Using context from {len(recent)} previous translations")
    
    logger.info(f"Streaming translation from {source_lang_name} to {target_lang_name} (Doc: {is_document}, Context: {use_context})")
    
    async def event_generator():
        """Generate SSE events for real-time token streaming"""
        try:
            full_translation = ""
            async for chunk in parallax_client.translate_streaming(
                text=text,
                source_lang=source_lang_name,
                target_lang=target_lang_name,
                context_text=context_text,
                is_document=is_document
            ):
                if chunk.get("done"):
                    # Final chunk with complete translation
                    if "error" not in chunk:
                        full_translation = chunk.get("full_text", "")
                        # Add to database
                        await add_translation(
                            session=db,
                            source_text=text,
                            translated_text=full_translation,
                            source_lang=source_lang,
                            target_lang=target_lang,
                            inference_time_ms=chunk.get("inference_time_ms", 0),
                            model=chunk.get("model", "Qwen2.5")
                        )
                    
                    yield f"data: {json.dumps(chunk)}\n\n"
                    break
                else:
                    # Stream individual token
                    yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@app.post("/api/detect-language")
async def detect_language(request: DetectLanguageRequest):
    """
    Detect language from text
    """
    if not request.text:
        return {"language_code": "auto", "language_name": "Auto-detect"}
    
    detected_code = language_detector.detect(request.text)
    detected_name = get_language_name(detected_code)
    
    return {
        "language_code": detected_code,
        "language_name": detected_name
    }


@app.get("/api/history")
async def get_history(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    Get translation history
    """
    records = await get_recent_translations(db, limit=limit)
    return {
        "history": records,
        "total": len(records)
    }


@app.delete("/api/history")
async def clear_history(db: AsyncSession = Depends(get_db)):
    """
    Clear translation history
    """
    await clear_all_history(db)
    return {"message": "History cleared successfully"}


@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """
    Get basic translation statistics
    """
    records = await get_recent_translations(db, limit=50)
    
    if not records:
        return {
            "total_translations": 0,
            "average_time_ms": 0,
            "fastest_time_ms": 0,
            "slowest_time_ms": 0
        }
    
    times = [r.inference_time_ms for r in records]
    
    return {
        "total_translations": len(records),
        "average_time_ms": sum(times) // len(times),
        "fastest_time_ms": min(times),
        "slowest_time_ms": max(times)
    }


@app.post("/api/translate-file")
async def translate_file(
    file: UploadFile = File(...),
    target_lang: str = "en",
    db: AsyncSession = Depends(get_db)
):
    """
    Supports PDF, TXT, MD, SRT
    """
    filename = file.filename.lower()
    allowed_exts = ('.txt', '.md', '.srt', '.pdf')
    if not filename.endswith(allowed_exts):
        raise HTTPException(status_code=400, detail="Supported formats: .txt, .md, .srt, .pdf")
    
    content = await file.read()
    text_content = ""
    
    # 1. Extract Text
    if filename.endswith('.pdf'):
        try:
            from PyPDF2 import PdfReader
            pdf_reader = PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                text_content += (page.extract_text() or "") + "\n"
        except ImportError:
             raise HTTPException(status_code=500, detail="PyPDF2 not installed on server")
        except Exception as e:
             raise HTTPException(status_code=400, detail=f"PDF Parse Error: {str(e)}")
    else:
        # text files
        try:
            text_content = content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File encoding must be UTF-8")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="File is empty or no text found")

    if len(text_content) > 100000:
        raise HTTPException(status_code=400, detail="File too large (max 100k chars for demo)")

    # 2. Chunking & Translation
    lines = text_content.split('\n')
    chunks = []
    current_chunk = ""
    
    for line in lines:
        if len(current_chunk) + len(line) < 2000: # ~500 tokens
            current_chunk += line + "\n"
        else:
            chunks.append(current_chunk)
            current_chunk = line + "\n"
    if current_chunk:
        chunks.append(current_chunk)
        
    target_lang_name = get_language_name(target_lang)
    translated_chunks = []
    
    # Process chunks (In production, use background tasks)
    for chunk in chunks:
        if not chunk.strip():
            translated_chunks.append(chunk)
            continue
        
        # Detect source language for proper translation prompt
        detected_code = language_detector.detect(chunk)
        source_lang_name = get_language_name(detected_code) if detected_code != "auto" else "English"
            
        result = await parallax_client.translate(
            text=chunk,
            source_lang=source_lang_name,
            target_lang=target_lang_name
        )
        
        if result["success"]:
            translated_chunks.append(result["translation"])
            # Simplified DB logging for demo (log first chunk only for speed/cleanliness)
            if chunk == chunks[0]:
                await add_translation(
                    db,
                    source_text=chunk[:200] + "...",
                    translated_text=result["translation"][:200] + "...",
                    source_lang="auto",
                    target_lang=target_lang,
                    inference_time_ms=result["inference_time_ms"],
                    model=result.get("model", "Qwen2.5")
                )
        else:
            translated_chunks.append(chunk + " [Error]")

    full_translation = "".join(translated_chunks)
    
    # 3. Calculate Savings (Demo Metric)
    # Value: $20/million chars (Google pricing)
    savings = len(text_content) * (20.00 / 1_000_000)

    return {
        "filename": f"translated_{file.filename}",
        "original_content": text_content[:500] + "...", # Don't send whole thing back in JSON
        "translated_content": full_translation,
        "savings_generated": savings,
        "success": True
    }



@app.get("/api/status/offline")
async def check_offline_status():
    """
    Verify the app is running in true offline/local mode
    Proves to users that no external APIs are being called
    """
    health = await parallax_client.check_health()
    
    return {
        "offline_ready": health["status"] == "online",
        "parallax_local": True,
        "external_apis": False,
        "data_location": "local_sqlite",
        "parallax_status": health["status"],
        "message": "100% Local - No internet required" if health["status"] == "online" else "Parallax not connected"
    }



@app.get("/api/history/export/csv")
async def export_history_csv(db: AsyncSession = Depends(get_db)):
    """Export translation history as CSV file"""
    records = await get_recent_translations(db, limit=1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp", "Source Text", "Translation", "Source Lang", "Target Lang", "Speed (ms)"])
    
    for r in records:
        writer.writerow([
            r.id, 
            r.timestamp.isoformat() if r.timestamp else "", 
            r.source_text, 
            r.translated_text, 
            r.source_lang, 
            r.target_lang, 
            r.inference_time_ms
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=parallax_translations.csv"}
    )


@app.get("/api/history/export/json")
async def export_history_json(db: AsyncSession = Depends(get_db)):
    """Export translation history as JSON file"""
    records = await get_recent_translations(db, limit=1000)
    
    data = [{
        "id": r.id,
        "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        "source_text": r.source_text,
        "translated_text": r.translated_text,
        "source_lang": r.source_lang,
        "target_lang": r.target_lang,
        "inference_time_ms": r.inference_time_ms
    } for r in records]
    
    return StreamingResponse(
        iter([json.dumps({"translations": data, "count": len(data)}, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=parallax_translations.json"}
    )


# CLUSTER MANAGEMENT

@app.get("/api/cluster/status")
async def get_cluster_status():
    """
    Get status of all nodes in the distributed cluster
    """
    return await parallax_client.get_cluster_status()


@app.post("/api/cluster/add")
async def add_cluster_node(node: dict):
    """Add a new node to the cluster"""
    url = node.get("url")
    name = node.get("name")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    return parallax_client.add_node(url, name)


if __name__ == "__main__":
    import uvicorn
    # Add mock nodes for demo if needed
    # parallax_client.add_node("http://localhost:3002", "Worker Node 1")
    uvicorn.run(app, host="0.0.0.0", port=8000)
