import sys
from pathlib import Path
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db, SessionLocal
from backend.app.models import User, Video, CaptionTrack, CaptionCue
from backend.app.subtitle_utils import generate_srt, generate_vtt, parse_srt
from backend.app.translation_service import translate_cues

client = TestClient(app)

def run_tests():
    print("========================================")
    print("RUNNING BACKEND TEST SUITE")
    print("========================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    data = res.json()
    print("✓ Health check passed:", data["status"], "| FFmpeg:", data["ffmpeg"]["available"])

    # 2. Subtitle generation & parsing check
    sample_cues = [
        {"cue_index": 1, "start_time": 0.5, "end_time": 2.8, "text": "Welcome to the Unified AI Platform."},
        {"cue_index": 2, "start_time": 3.0, "end_time": 5.5, "text": "This handles captioning and translation."}
    ]
    srt = generate_srt(sample_cues)
    assert "00:00:00,500 --> 00:00:02,800" in srt, "SRT format mismatch"
    assert "Welcome to the Unified AI Platform." in srt
    print("✓ SRT generation passed")

    vtt = generate_vtt(sample_cues)
    assert vtt.startswith("WEBVTT"), "VTT header missing"
    assert "00:00:00.500 --> 00:00:02.800" in vtt, "VTT timestamp mismatch"
    print("✓ WebVTT generation passed")

    parsed = parse_srt(srt)
    assert len(parsed) == 2, f"Parsed {len(parsed)} cues, expected 2"
    assert abs(parsed[0]["start_time"] - 0.5) < 0.01
    print("✓ SRT parser round-trip passed")

    # 3. User Registration
    test_email = f"test_{int(res.headers.get('date', 0) or 12345)}@college.edu"
    test_user = f"demo_student_{int(res.headers.get('date', 0) or 12345)}"
    reg_res = client.post("/api/auth/register", json={
        "email": test_email,
        "username": test_user,
        "password": "StrongPassword123!",
        "full_name": "Senior Mini Project Tester"
    })
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
    token_data = reg_res.json()
    access_token = token_data["access_token"]
    assert access_token, "No access token in registration response"
    print("✓ User registration passed (Token generated)")

    # 4. User Login
    login_res = client.post("/api/auth/login", json={
        "username_or_email": test_user,
        "password": "StrongPassword123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    assert "access_token" in login_res.json()
    print("✓ User login passed")

    # 5. Protected Endpoint /me
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200, f"Protected endpoint failed: {me_res.text}"
    assert me_res.json()["username"] == test_user
    print("✓ Protected route & JWT authorization passed")

    # 6. Supported Languages
    langs_res = client.get("/api/translation/languages")
    assert langs_res.status_code == 200
    langs = langs_res.json()
    assert len(langs) >= 15, "Languages list incomplete"
    print(f"✓ Languages endpoint passed ({len(langs)} target languages available)")

    # 7. Media List (empty initial)
    media_list_res = client.get("/api/media/list", headers=headers)
    assert media_list_res.status_code == 200
    assert isinstance(media_list_res.json(), list)
    print("✓ Media list retrieved successfully")

    # 8. Translation Cues Unit Test
    translated = translate_cues(sample_cues, target_language="es", source_language="en")
    assert len(translated) == 2, "Translation returned wrong cue count"
    assert translated[0]["start_time"] == sample_cues[0]["start_time"]
    assert translated[0]["end_time"] == sample_cues[0]["end_time"]
    assert len(translated[0]["text"]) > 0
    print(f"✓ Timestamp-preserved translation passed: '{sample_cues[0]['text']}' -> '{translated[0]['text']}'")

    print("========================================")
    print("ALL BACKEND TESTS PASSED SUCCESSFULLY! ✓")
    print("========================================")

if __name__ == "__main__":
    run_tests()
