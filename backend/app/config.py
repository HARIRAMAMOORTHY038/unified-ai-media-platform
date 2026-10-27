
import os
from pathlib import Path

from dotenv import load_dotenv

# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# Load the .env file from the project root.
# config.py is in backend/app/, so PROJECT_ROOT.parent is the project root.
ENV_FILE = PROJECT_ROOT.parent / ".env"
load_dotenv(dotenv_path=ENV_FILE)

UPLOAD_DIR = PROJECT_ROOT / "uploads"
VIDEOS_DIR = UPLOAD_DIR / "videos"
AUDIO_DIR = UPLOAD_DIR / "audio"
EXPORTS_DIR = UPLOAD_DIR / "exports"
DUBBED_DIR = UPLOAD_DIR / "dubbed"

for directory in [UPLOAD_DIR, VIDEOS_DIR, AUDIO_DIR, EXPORTS_DIR, DUBBED_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Application Config
APP_NAME = "Unified AI Media Platform"
APP_VERSION = "1.0.0"

# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{PROJECT_ROOT / 'media_platform.db'}"
)

# Security & JWT
# Require a secret from the environment; never use a predictable fallback.
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY or JWT_SECRET_KEY == "replace-with-a-random-secret":
    raise RuntimeError(
        "JWT_SECRET_KEY is missing or still uses the placeholder. "
        "Set a secure JWT_SECRET_KEY in the project-root .env file."
    )

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# AI Engine Settings
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

# Video & Audio Constraints
ALLOWED_EXTENSIONS = {
    ".mp4", ".mkv", ".avi", ".mov", ".webm", ".mp3", ".wav", ".m4a"
}
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "250"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# Supported Target Languages for Translation
SUPPORTED_LANGUAGES = [
    {"code": "es", "name": "Spanish", "native": "Español"},
    {"code": "fr", "name": "French", "native": "Français"},
    {"code": "de", "name": "German", "native": "Deutsch"},
    {"code": "hi", "name": "Hindi", "native": "हिन्दी"},
    {"code": "ta", "name": "Tamil", "native": "தமிழ்"},
    {"code": "te", "name": "Telugu", "native": "తెలుగు"},
    {"code": "ml", "name": "Malayalam", "native": "മലയാളം"},
    {"code": "kn", "name": "Kannada", "native": "ಕನ್ನಡ"},
    {"code": "mr", "name": "Marathi", "native": "मराठी"},
    {"code": "bn", "name": "Bengali", "native": "বাংলা"},
    {"code": "zh-CN", "name": "Chinese (Simplified)", "native": "中文 (简体)"},
    {"code": "ja", "name": "Japanese", "native": "日本語"},
    {"code": "ko", "name": "Korean", "native": "한국어"},
    {"code": "ar", "name": "Arabic", "native": "العربية"},
    {"code": "ru", "name": "Russian", "native": "Русский"},
    {"code": "pt", "name": "Portuguese", "native": "Português"},
    {"code": "it", "name": "Italian", "native": "Italiano"},
    {"code": "nl", "name": "Dutch", "native": "Nederlands"},
    {"code": "ur", "name": "Urdu", "native": "اردو"},
    {"code": "en", "name": "English", "native": "English"},
]
