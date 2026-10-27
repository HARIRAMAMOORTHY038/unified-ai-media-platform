# Safe Continuation Notes - Unified AI Media Platform

**Project Directory:** `c:\Users\ghari\Videos\unified-ai-media-platform`
**Current Date:** 2026-10-21
**OS & Shell:** Windows 11 / PowerShell & CMD
**Python Runtime:** Python 3.14 (64-bit)
**Node.js / Build:** Vite + React 18 (`npm.cmd`)

---

## 1. Important Source File Paths

### Project Root
- [README.md](file:///c:/Users/ghari/Videos/unified-ai-media-platform/README.md)
- [run_app.bat](file:///c:/Users/ghari/Videos/unified-ai-media-platform/run_app.bat)
- [start_backend.bat](file:///c:/Users/ghari/Videos/unified-ai-media-platform/start_backend.bat)
- [start_frontend.bat](file:///c:/Users/ghari/Videos/unified-ai-media-platform/start_frontend.bat)
- [sample_test_video.mp4](file:///c:/Users/ghari/Videos/unified-ai-media-platform/sample_test_video.mp4)
- [test_e2e_workflow.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/test_e2e_workflow.py)

### Backend (`backend/`)
- [requirements.txt](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/requirements.txt)
- [test_backend.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/test_backend.py)
- [media_platform.db](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/media_platform.db) (SQLite database)
- [app/main.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/main.py): FastAPI application root and middleware
- [app/config.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/config.py): App paths, JWT settings, Whisper configs, supported languages
- [app/database.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/database.py): SQLAlchemy engine and session factory
- [app/models.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/models.py): User, Video, CaptionTrack, CaptionCue, DubbedTrack models
- [app/schemas.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/schemas.py): Pydantic request and response schemas
- [app/auth.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/auth.py): Password hashing, token creation, `get_current_user` dependency
- [app/ffmpeg_utils.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/ffmpeg_utils.py): FFmpeg binary loader, 16kHz mono audio extraction, duration
- [app/whisper_service.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/whisper_service.py): Faster-Whisper model loading and audio transcription
- [app/translation_service.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/translation_service.py): Deep-translator integration (MyMemory + Google)
- [app/tts_service.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/tts_service.py): Edge TTS neural synthesis, gTTS fallback, timeline buffer assembly
- [app/subtitle_utils.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/subtitle_utils.py): SRT and WebVTT parsing and generation
- [app/routers/auth_router.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/routers/auth_router.py): `/api/auth/register`, `/login`, `/me`
- [app/routers/media_router.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/routers/media_router.py): `/api/media/upload`, `/list`, `/{id}`, `/{id}/stream`
- [app/routers/caption_router.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/routers/caption_router.py): `/api/captions/{id}/transcribe`, `/tracks`, cues
- [app/routers/translation_router.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/routers/translation_router.py): `/api/translation/{id}/translate`, `/languages`
- [app/routers/dubbing_router.py](file:///c:/Users/ghari/Videos/unified-ai-media-platform/backend/app/routers/dubbing_router.py): `/api/dubbing/{id}/generate`, `/tracks`, video export

### Frontend (`frontend/`)
- [package.json](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/package.json)
- [vite.config.js](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/vite.config.js): Dev server proxy mapping `/api` to `http://127.0.0.1:8000`
- [src/App.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/App.jsx): Root routing and authentication guards
- [src/services/api.js](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/services/api.js): Axios client and service methods (`mediaApi`, `captionApi`, `translationApi`, `dubbingApi`)
- [src/pages/DashboardPage.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/pages/DashboardPage.jsx): Media library, search bar, metrics, upload trigger
- [src/pages/LoginPage.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/pages/LoginPage.jsx): Login and registration forms with demo auto-fill
- [src/pages/VideoDetailPage.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/pages/VideoDetailPage.jsx): Studio workspace, STT trigger, dubbing trigger, track tabs
- [src/components/VideoPlayer.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/components/VideoPlayer.jsx): Synchronized video player, CC overlay, audio track switcher
- [src/components/CaptionEditor.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/components/CaptionEditor.jsx): In-browser cue table editor
- [src/components/LanguageSelector.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/components/LanguageSelector.jsx): Multi-language translation modal selector
- [src/components/UploadModal.jsx](file:///c:/Users/ghari/Videos/unified-ai-media-platform/frontend/src/components/UploadModal.jsx): Drag-and-drop video upload dialog

---

## 2. How the Frontend and Backend Run

### One-Click Startup (Recommended)
Double-click [run_app.bat](file:///c:/Users/ghari/Videos/unified-ai-media-platform/run_app.bat) in the project root:
- Starts backend on `http://127.0.0.1:8000`
- Starts frontend on `http://localhost:5173`

### Manual Startup via Terminal

#### Backend Server (Terminal 1)
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Health Check: `http://127.0.0.1:8000/api/health`
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`

#### Frontend Dev Server (Terminal 2)
```powershell
cd frontend
npm.cmd run dev
```
- Web Application UI: `http://localhost:5173`
- *Note:* Use `npm.cmd` on Windows PowerShell to bypass execution policy restrictions on `.ps1` scripts.

---

## 3. Dependencies, Models, Database & Existing Search Pipeline

### Dependencies
- **Backend (`backend/requirements.txt`):**
  - `fastapi>=0.110.0`, `uvicorn>=0.28.0`, `pydantic>=2.6.0`, `python-multipart>=0.0.9`
  - `python-jose[cryptography]>=3.3.0`, `passlib[bcrypt]>=1.7.4`, `bcrypt>=4.0.0`
  - `sqlalchemy>=2.0.0`
  - `deep-translator>=1.11.4`
  - `imageio-ffmpeg>=0.5.1` (provides bundled FFmpeg v7.1 on Windows)
  - `faster-whisper>=1.0.0` (CTranslate2 ONNX runtime for CPU speech recognition)
  - `requests>=2.31.0`
  - `edge-tts>=7.0.0` (Microsoft Edge neural speech synthesis)
  - `gTTS>=2.5.0` (Google text-to-speech fallback)
- **Frontend (`frontend/package.json`):**
  - `react`, `react-dom` (v18.2.0)
  - `lucide-react` (v0.344.0)
  - `axios` (v1.6.7)
  - `tailwindcss` (v3.4.1), `postcss`, `autoprefixer`
  - `vite` (v5.1.4), `@vitejs/plugin-react` (v4.2.1)

### AI Models & Ingestion
- **Speech-to-Text:** `faster-whisper` model `base` running locally on CPU with `int8` quantization. Cached in memory via singleton `get_whisper_model()`.
- **Text-to-Speech:** Microsoft Neural TTS voices (`ta-IN-PallaviNeural`, `hi-IN-SwaraNeural`, `es-ES-ElviraNeural`, etc.) via `edge-tts`, with fallback to `gTTS`.
- **Translation:** Deep-Translator using MyMemory with locale mappings (`ta-IN`, `hi-IN`, `es-ES`, etc.) and Google Translator fallback.

### Database
- **Engine:** SQLite 3.
- **Location:** `backend/media_platform.db`.
- **ORM:** SQLAlchemy 2.0 with models: `User`, `Video`, `CaptionTrack`, `CaptionCue`, `DubbedTrack`.

### Existing Search and Indexing Pipeline
- Currently, search is limited to `media_router.py` lines 112–116:
  ```python
  if search:
      search_filter = f"%{search.strip()}%"
      query = query.filter(
          (Video.title.ilike(search_filter)) | (Video.original_filename.ilike(search_filter))
      )
  ```
- **Semantic / Content-Based Indexing:** **NONE currently exists.**
- Video transcripts, translated subtitles, audio meaning, and non-English scripts (like Tamil) are not searched or indexed.

---

## 4. Current Implementation Stage

- **Current Stage:** Pre-implementation & Baseline Safety Verification.
- **Code Modification Status:** No application code was altered in this step.
- **Project Documentation Status:** Fully documented in `project-notes/`.

---

## 5. Last Completed Action

Created both tracking and continuation documents:
1. `project-notes/IMPLEMENTATION_STATUS.md`
2. `project-notes/CONTINUATION_NOTES.md`

All architectural details, root-cause investigations for Tasks A and B, existing search limitations for Task C, and test coverage requirements for Task D have been validated against actual project code on disk.

---

## 6. Unfinished Actions and Known Errors

### Unfinished Actions
- **Task A (Transcription fix for manual non-English selection):** NOT STARTED.
- **Task B (Dubbing fix for target-language speech output):** NOT STARTED.
- **Task C (Multilingual semantic video search including Tamil queries):** NOT STARTED.
- **Task D (Testing new features and regression testing):** NOT STARTED.

### Known Errors & Critical Findings
1. **Dubbed Speech Audio Speaks English Words:**
   `VideoDetailPage.jsx` sends original English track ID as `source_track_id`. `dubbing_router.py` passes the untranslated English cues directly to the neural TTS synthesizer with target language voice (`ta`, `es`, etc.), resulting in English speech with foreign accent instead of translated language speech.
2. **Whisper Language Tokenizer Error:**
   Passing region-tagged codes like `zh-CN` to Faster-Whisper causes `ValueError: 'zh-CN' is not a valid language code`. Whisper requires standard 2-letter codes (e.g. `zh`).
3. **Whisper VAD Silence False Positives:**
   Aggressive VAD filter settings suppress non-English speech, resulting in 400 Bad Request ("No speech could be recognized in the video audio").
4. **Missing Content Search:**
   Media list search only checks video title and filename; content and meaning searches in English and Tamil fail to match videos.

---

## 7. Exact Next Action for the Next Antigravity Session

### Immediate Action Item: Execute Task A
1. **In `backend/app/whisper_service.py`:**
   - Add language code normalization (e.g., map `zh-cn` / `zh-CN` -> `zh`, strip whitespace, map UI codes to Whisper-accepted language codes).
   - Normalize language input so if manual language is specified, `model.transcribe` receives the valid Whisper code, and adjust VAD parameters/fallbacks so valid speech is not filtered out.
   - Guard `transcribe_audio` against charmap/Unicode logging crashes on Windows stdout.
2. **In `backend/app/routers/caption_router.py`:**
   - Ensure the track created/updated reflects the requested source language when manual selection is made and verified.
3. **In `frontend/src/pages/VideoDetailPage.jsx` and `LanguageSelector.jsx`:**
   - Verify consistent language code transmission for transcription requests.
4. Update `project-notes/IMPLEMENTATION_STATUS.md` and `project-notes/CONTINUATION_NOTES.md` upon completion.
