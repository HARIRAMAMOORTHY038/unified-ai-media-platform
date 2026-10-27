import sys
import os
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def run_e2e_test():
    print("==================================================")
    print("RUNNING EXTENDED END-TO-END WORKFLOW INTEGRATION TEST")
    print("==================================================")

    # 1. Register a test user
    test_user = "e2e_dubbing_tester"
    user_payload = {
        "email": "e2e_dubbing@college.edu",
        "username": test_user,
        "password": "Password123!",
        "full_name": "E2E Dubbing Demonstrator"
    }
    # Attempt login or register
    login_res = client.post("/api/auth/login", json={"username_or_email": test_user, "password": "Password123!"})
    if login_res.status_code == 200:
        token = login_res.json()["access_token"]
        print("✓ Logged in as existing test user")
    else:
        reg_res = client.post("/api/auth/register", json=user_payload)
        assert reg_res.status_code == 201, f"Failed registration: {reg_res.text}"
        token = reg_res.json()["access_token"]
        print("✓ Registered new test user")

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload video
    video_path = Path("sample_test_video.mp4")
    assert video_path.exists(), "sample_test_video.mp4 not found"

    with open(video_path, "rb") as f:
        files = {"file": ("sample_test_video.mp4", f, "video/mp4")}
        upload_res = client.post("/api/media/upload", headers=headers, files=files)

    assert upload_res.status_code == 201, f"Upload failed: {upload_res.text}"
    video_data = upload_res.json()
    video_id = video_data["id"]
    print(f"✓ Video uploaded successfully: ID={video_id}, Title='{video_data['title']}', Duration={video_data['duration_seconds']}s")

    # 3. Transcribe with Faster-Whisper (Source Language Auto-Detect)
    print("-> Running Faster-Whisper speech transcription...")
    transcribe_res = client.post(
        f"/api/captions/{video_id}/transcribe",
        headers=headers,
        json={"source_language": "auto"}
    )
    assert transcribe_res.status_code == 200, f"Transcription failed: {transcribe_res.text}"
    track_data = transcribe_res.json()
    original_track_id = track_data["id"]
    print(f"✓ Original track generated: ID={original_track_id}, Language='{track_data['language_name']}', Cues={len(track_data['cues'])}")

    # 4. Verify Duplicate Prevention on Repeated Transcription
    print("-> Verifying duplicate caption track prevention...")
    second_transcribe_res = client.post(
        f"/api/captions/{video_id}/transcribe",
        headers=headers,
        json={"source_language": "en"}
    )
    assert second_transcribe_res.status_code == 200
    tracks_list_res = client.get(f"/api/captions/{video_id}/tracks", headers=headers)
    tracks_list = tracks_list_res.json()
    orig_tracks_count = sum(1 for t in tracks_list if t["is_original"])
    assert orig_tracks_count == 1, f"Expected 1 original track, but found {orig_tracks_count} duplicates!"
    print(f"✓ Verified: Repeated transcription updated existing original track without duplicate creation (total orig: {orig_tracks_count})")

    # 5. Translate Captions to Tamil (Target Language)
    print("-> Translating captions to Tamil (ta)...")
    trans_res = client.post(f"/api/translation/{video_id}/translate", headers=headers, json={
        "source_track_id": original_track_id,
        "target_languages": ["ta"]
    })
    assert trans_res.status_code == 200, f"Translation failed: {trans_res.text}"
    trans_tracks = trans_res.json()
    assert len(trans_tracks) == 1, f"Expected 1 translated track, got {len(trans_tracks)}"
    tamil_track = trans_tracks[0]
    print(f"✓ Translated to Tamil: Track ID={tamil_track['id']}, Language='{tamil_track['language_name']}'")

    # 6. Caption Editing & Subtitle Export (SRT / VTT)
    print("-> Editing Tamil captions...")
    edit_payload = {
        "cues": [
            {"cue_index": 1, "start_time": 0.5, "end_time": 2.5, "text": "வணக்கம், இது AI ஊடக தளம்."},
            {"cue_index": 2, "start_time": 2.8, "end_time": 4.8, "text": "தமிழ் வசன வரிகள் மற்றும் டப்பிங்."}
        ]
    }
    edit_res = client.put(f"/api/captions/tracks/{tamil_track['id']}", headers=headers, json=edit_payload)
    assert edit_res.status_code == 200, f"Editing failed: {edit_res.text}"
    assert len(edit_res.json()["cues"]) == 2
    print("✓ Captions successfully edited and saved back to SQLite")

    # SRT & VTT Export
    srt_res = client.get(f"/api/captions/tracks/{tamil_track['id']}/export/srt")
    assert srt_res.status_code == 200
    assert "00:00:00,500 --> 00:00:02,500" in srt_res.text
    print("✓ Exported SRT verified with accurate timestamps")

    vtt_res = client.get(f"/api/captions/tracks/{tamil_track['id']}/export/vtt")
    assert vtt_res.status_code == 200
    assert vtt_res.text.startswith("WEBVTT")
    print("✓ Exported WebVTT verified with WEBVTT header")

    # 7. Generate Real Dubbed Audio in Tamil
    print("-> Generating real timeline-aligned dubbed audio in Tamil...")
    dub_res = client.post(f"/api/dubbing/{video_id}/generate", headers=headers, json={
        "target_language": "ta"
    })
    assert dub_res.status_code == 200, f"Dubbed audio generation failed: {dub_res.text}"
    dub_data = dub_res.json()
    dub_track_id = dub_data["id"]
    assert dub_data["language"] == "ta"
    assert dub_data["status"] == "READY"
    assert os.path.exists(dub_data["audio_path"]), f"Audio file not found on disk: {dub_data['audio_path']}"
    print(f"✓ Real dubbed audio created: ID={dub_track_id}, File='{dub_data['audio_path']}', Duration={dub_data['duration_seconds']}s")

    # 8. Verify Duplicate Prevention on Repeated Dub Generation
    print("-> Verifying duplicate dubbed track prevention...")
    second_dub_res = client.post(f"/api/dubbing/{video_id}/generate", headers=headers, json={
        "target_language": "ta"
    })
    assert second_dub_res.status_code == 200
    dub_list_res = client.get(f"/api/dubbing/{video_id}/tracks", headers=headers)
    dub_list = dub_list_res.json()
    ta_dub_count = sum(1 for d in dub_list if d["language"] == "ta")
    assert ta_dub_count == 1, f"Expected 1 Tamil dubbed track, but found {ta_dub_count} duplicates!"
    print(f"✓ Verified: Repeated dubbing updated existing track without duplicates (total Tamil dubs: {ta_dub_count})")

    # 9. Audio Streaming & Download Endpoints
    audio_stream_res = client.get(f"/api/dubbing/tracks/{dub_track_id}/audio?token={token}")
    assert audio_stream_res.status_code == 200
    assert len(audio_stream_res.content) > 1000
    print(f"✓ Dubbed audio streaming verified ({len(audio_stream_res.content)} bytes)")

    audio_download_res = client.get(f"/api/dubbing/tracks/{dub_track_id}/download")
    assert audio_download_res.status_code == 200
    print("✓ Dubbed audio download endpoint verified")

    # 10. Export Dubbed Video (FFmpeg combining video + dubbed audio)
    print("-> Exporting separate dubbed MP4 video using FFmpeg...")
    export_vid_res = client.post(f"/api/dubbing/tracks/{dub_track_id}/export-video", headers=headers)
    assert export_vid_res.status_code == 200, f"Video export failed: {export_vid_res.text}"
    export_info = export_vid_res.json()
    print(f"✓ Dubbed video export completed: {export_info['filename']}")

    # Download Exported Video
    vid_download_res = client.get(f"/api/dubbing/tracks/{dub_track_id}/download-video")
    assert vid_download_res.status_code == 200
    assert len(vid_download_res.content) > 1000
    print(f"✓ Exported video download verified ({len(vid_download_res.content)} bytes)")

    # 11. Media Detail Verification
    detail_res = client.get(f"/api/media/{video_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["caption_tracks"]) >= 2
    assert len(detail["dubbed_tracks"]) >= 1
    assert detail["dubbed_tracks"][0]["has_exported_video"] == True
    print(f"✓ Video detail verified: {len(detail['caption_tracks'])} subtitles, {len(detail['dubbed_tracks'])} dubbed tracks, video export confirmed")

    print("==================================================")
    print("ALL WORKFLOWS AND DUBBING TESTS PASSED 100%! ✓")
    print("==================================================")

if __name__ == "__main__":
    run_e2e_test()
