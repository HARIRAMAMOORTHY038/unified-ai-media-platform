from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import APP_NAME, APP_VERSION, UPLOAD_DIR
from .database import init_db
#from .routers import auth_router, media_router, caption_router, translation_router, dubbing_router
from .routers import auth_router, caption_router, translation_router, dubbing_router
from .routers import media_router_new as media_router
from .ffmpeg_utils import get_ffmpeg_binary

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB tables
    init_db()
    try:
        ffmpeg_bin = get_ffmpeg_binary()
        print(f"[AI Platform] Initialized successfully. FFmpeg executable: {ffmpeg_bin}")
    except Exception as e:
        print(f"[AI Platform] Warning: FFmpeg initialization check: {e}")
    yield
    # Shutdown
    print("[AI Platform] Application shut down.")

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Unified AI Platform for Captioning, Translation and Digital Media Management",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production if necessary
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Files for Uploads
app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include Routers
app.include_router(auth_router.router)
app.include_router(media_router.router)
app.include_router(caption_router.router)
app.include_router(translation_router.router)
app.include_router(dubbing_router.router)

@app.get("/api/health")
def health_check():
    ffmpeg_available = False
    ffmpeg_path = None
    try:
        ffmpeg_path = get_ffmpeg_binary()
        ffmpeg_available = True
    except Exception:
        pass

    return {
        "status": "healthy",
        "app": APP_NAME,
        "version": APP_VERSION,
        "ffmpeg": {
            "available": ffmpeg_available,
            "path": ffmpeg_path
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
