# Unified AI Platform for Captioning, Translation and Digital Media Management

A production-grade, full-stack AI media workstation developed as an **S5 Semester Mini Project**. The platform delivers real, timestamped speech recognition on CPU, multi-language subtitle translation preserving exact cues, an interactive video player with live synchronized caption overlay, an in-browser subtitle editor, and complete digital media management.

---

## 🌟 Key Features

1. **User Authentication & Isolation**
   - JWT-based authentication with bcrypt-hashed passwords.
   - User-isolated media records and subtitle ownership in SQLite.
2. **FFmpeg Video/Audio Pipeline**
   - Automatic 16kHz mono PCM WAV audio extraction from uploaded videos.
   - Works out-of-the-box on Windows using the bundled `imageio-ffmpeg` engine without requiring system PATH configuration.
3. **Real Speech-to-Text with Faster-Whisper**
   - True timestamped transcription running locally on CPU.
   - Voice Activity Detection (VAD) filter to suppress background silence.
   - Auto-detection or explicit selection of source speech language.
4. **Multi-Language Subtitle Translation**
   - Free, zero-API-key multi-language translation engine supporting 19+ languages (Spanish, French, German, Hindi, Tamil, Telugu, Malayalam, Chinese, Japanese, Arabic, Russian, Portuguese, etc.).
   - Exact cue index, start timestamp, and end timestamp preservation.
5. **Interactive Video Player with Synchronized Captions**
   - Custom subtitle overlay with high-contrast, rounded glassmorphic styling.
   - Track switcher: toggle between Original (Whisper), any translated languages, or Off.
   - Full playback controls: play/pause, seek timeline, volume/mute, ±5s jump, playback speeds (0.5x to 2x), and fullscreen.
6. **In-Browser Caption Editor**
   - Live editable cue table: adjust start time, end time, and subtitle text.
   - **Play Cue** button: seeks the video player directly to that cue's timestamp for instant audio-visual alignment.
   - Add new cues at current playback position and delete cues.
   - Instant SQLite database persistence with automatic regeneration of server files.
7. **Exportable Subtitles**
   - Direct download of industry-standard **SRT** (`.srt`) and **WebVTT** (`.vtt`) files.
8. **Media Library Management**
   - Search by video title and filename.
   - Sorting by newest, oldest, or alphabetical order.
   - File deletion with disk cleanup (video, audio, and subtitle files).

---

## 🏗️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Axios |
| **Backend** | Python 3.10–3.14, FastAPI, Pydantic v2, Uvicorn |
| **Database & ORM** | SQLite, SQLAlchemy 2.0 |
| **Speech Recognition** | Faster-Whisper (CTranslate2, ONNX Runtime on CPU) |
| **Media Extraction** | FFmpeg (v7.1 Windows bundled via `imageio-ffmpeg`) |
| **Translation Engine** | Multi-tier Deep Translator (MyMemory & Google, 100% Free) |
| **Formats Supported** | MP4, MKV, WebM, MOV, AVI, WAV, MP3, M4A, SRT, VTT |

---

## 🚀 Quick Start (Windows)

### Method 1: One-Click Startup (Recommended)
Simply double-click the included batch launcher:
```cmd
run_app.bat
```
This script automatically starts both the backend (port 8000) and frontend (port 5173).

### Method 2: Manual Startup

#### 1. Backend (Terminal 1)
```cmd
# Make sure dependencies are installed
pip install -r backend/requirements.txt

# Start FastAPI server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- Interactive Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

#### 2. Frontend (Terminal 2)
```cmd
cd frontend
npm.cmd run dev
```
- Open application in browser: [http://localhost:5173](http://localhost:5173)

---

## 📋 Demonstration Walkthrough (For College Viva / Project Demo)

A sample video (`sample_test_video.mp4`) has already been created for immediate demonstration:

1. **Registration & Login**:
   - Navigate to [http://localhost:5173](http://localhost:5173).
   - Click **"Fill Demo Credentials"** or create a new student account.
2. **Upload Media**:
   - Click **"Upload Video"** in the top navigation or dashboard.
   - Drag and drop `sample_test_video.mp4` (or any video with spoken speech).
   - Observe the progress bar and automatic FFmpeg audio extraction.
3. **Open Studio Workspace**:
   - Click on the video card to enter the full studio editor.
4. **Generate Captions (Speech-to-Text)**:
   - Under *AI Processing Pipeline*, select *Auto Detect Language* or your language.
   - Click **"Generate"**. Faster-Whisper will transcribe audio and populate the timeline.
5. **Translate Subtitles**:
   - Click **"Translate to Other Languages"**.
   - Select target languages (e.g., Spanish, French, Hindi).
   - Click **"Translate"**. Timestamps are preserved exactly while text is translated.
6. **Video Playback & Subtitle Switching**:
   - Press Play. Observe the stylized subtitle overlay synchronized with the speech.
   - Use the **CC** menu on the player to switch between Original and Translated tracks in real time.
7. **Caption Editing**:
   - In the right-hand panel, click any cue text to edit it or adjust timing.
   - Click **"Play"** next to any cue to verify sync.
   - Click **"Save Edits"**. Changes are saved to SQLite and export files are regenerated.
8. **Export Subtitles**:
   - Click the **SRT** or **VTT** buttons to download subtitle files to your machine.

---

## 🧪 Automated Testing & Verification

Run the test suites to verify backend endpoints and integration:

```cmd
# 1. Core backend test suite (Auth, DB, SRT/VTT, Translation)
python backend/test_backend.py

# 2. End-to-end integration workflow test (Upload, Transcribe, Translate, Edit, Export)
python test_e2e_workflow.py
```

### Verified Features vs System Limits

| Feature | Status | Notes |
|---|---|---|
| User Registration & JWT Login | ✅ Verified | Bcrypt hashing, token expiration, route protection |
| FFmpeg Audio Extraction | ✅ Verified | Uses bundled v7.1 FFmpeg; extracts 16kHz mono WAV |
| Faster-Whisper Transcription | ✅ Verified | Runs on CPU via CTranslate2 with VAD filter |
| Timestamp-Preserved Translation | ✅ Verified | Tested for Spanish, French, German, Hindi, etc. |
| SRT & WebVTT Generation / Parsing | ✅ Verified | Standards-compliant formatting and round-trip parsing |
| Live Subtitle Video Player Overlay | ✅ Verified | Real-time timeupdate sync with active track |
| In-Browser Cue Editor | ✅ Verified | Live seek, time edit, add cue, delete cue, save to DB |
| Subtitle Download (SRT & VTT) | ✅ Verified | Direct HTTP file attachment downloads |
| Media Deletion & Disk Cleanup | ✅ Verified | Cascading deletion of video, audio and export files |
| Frontend Production Build | ✅ Verified | Vite build succeeded with 0 errors |

---

## 🛠️ Windows Troubleshooting

- **PowerShell Script Execution Restriction**:
  - Always run `npm.cmd` instead of `npm` if PowerShell warns about `.ps1` execution policies.
- **FFmpeg not on PATH**:
  - The project automatically uses the bundled `imageio-ffmpeg` binary located in Python's site-packages. No manual installation is necessary.
- **Port 8000 or 5173 already in use**:
  - Change the port in `start_backend.bat` (`--port 8001`) and update `frontend/vite.config.js` proxy accordingly.
