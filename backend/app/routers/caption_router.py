import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Video, CaptionTrack, CaptionCue
from ..schemas import CaptionTrackResponse, CaptionTrackSummaryResponse, CaptionTrackUpdate, TranscribeRequest
from ..auth import get_current_user
from ..config import EXPORTS_DIR
from ..ffmpeg_utils import extract_audio_from_video
from ..whisper_service import transcribe_audio
from ..translation_service import get_language_name
from ..subtitle_utils import generate_srt, generate_vtt

router = APIRouter(prefix="/api/captions", tags=["Captions & Subtitles"])

@router.post("/{video_id}/transcribe", response_model=CaptionTrackResponse)
def transcribe_video(
    video_id: int,
    req: TranscribeRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id, Video.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")

    # Ensure audio exists, or extract it if missing
    if not video.audio_path or not os.path.exists(video.audio_path):
        audio_save_path = Path(video.file_path).parent.parent / "audio" / f"{video.id}_audio.wav"
        try:
            extract_audio_from_video(video.file_path, str(audio_save_path))
            video.audio_path = str(audio_save_path)
            db.commit()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to extract audio from video: {str(e)}")

    source_lang = None
    if req:
        source_lang = req.source_language or req.language
    if source_lang == "auto" or not source_lang:
        source_lang = None

    # Perform real speech-to-text with Faster-Whisper
    try:
        result = transcribe_audio(video.audio_path, language=source_lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech recognition error: {str(e)}")

    detected_lang = result.get("language", "en")
    lang_name = get_language_name(detected_lang)
    cues_data = result.get("cues", [])

    if not cues_data:
        raise HTTPException(
            status_code=400,
            detail="No speech could be recognized in the video audio. Faster-Whisper detected no audible speech segments."
        )

    # Check if an original caption track already exists for this video to prevent duplicates
    existing_track = db.query(CaptionTrack).filter(
        CaptionTrack.video_id == video.id,
        CaptionTrack.is_original == True
    ).first()

    if existing_track:
        track = existing_track
        track.language = detected_lang
        track.language_name = lang_name
        track.status = "READY"
        track.error_message = None
        # Remove old cues for this track
        db.query(CaptionCue).filter(CaptionCue.track_id == track.id).delete()
    else:
        track = CaptionTrack(
            video_id=video.id,
            language=detected_lang,
            language_name=lang_name,
            is_original=True,
            status="READY"
        )
        db.add(track)
        db.commit()
        db.refresh(track)

    # Insert cues
    cues_to_add = []
    for cue_item in cues_data:
        cue = CaptionCue(
            track_id=track.id,
            cue_index=cue_item["cue_index"],
            start_time=cue_item["start_time"],
            end_time=cue_item["end_time"],
            text=cue_item["text"],
            speaker=cue_item.get("speaker")
        )
        cues_to_add.append(cue)
        db.add(cue)

    db.commit()

    # Generate and save SRT & VTT files
    srt_text = generate_srt(cues_to_add)
    vtt_text = generate_vtt(cues_to_add)

    srt_file = EXPORTS_DIR / f"track_{track.id}_{detected_lang}.srt"
    vtt_file = EXPORTS_DIR / f"track_{track.id}_{detected_lang}.vtt"

    with open(srt_file, "w", encoding="utf-8") as f:
        f.write(srt_text)
    with open(vtt_file, "w", encoding="utf-8") as f:
        f.write(vtt_text)

    track.srt_path = str(srt_file)
    track.vtt_path = str(vtt_file)
    db.commit()
    db.refresh(track)

    return track

@router.get("/{video_id}/tracks", response_model=List[CaptionTrackSummaryResponse])
def get_video_tracks(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id, Video.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")

    tracks = db.query(CaptionTrack).filter(CaptionTrack.video_id == video_id).all()
    results = []
    for t in tracks:
        item = CaptionTrackSummaryResponse.model_validate(t)
        item.cue_count = len(t.cues)
        results.append(item)
    return results

@router.get("/tracks/{track_id}", response_model=CaptionTrackResponse)
def get_track_detail(
    track_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    track = db.query(CaptionTrack).filter(CaptionTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Caption track not found")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    if not video or video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return track

@router.put("/tracks/{track_id}", response_model=CaptionTrackResponse)
def update_track_cues(
    track_id: int,
    update_data: CaptionTrackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    track = db.query(CaptionTrack).filter(CaptionTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Caption track not found")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    if not video or video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Delete existing cues
    db.query(CaptionCue).filter(CaptionCue.track_id == track_id).delete()

    # Re-insert sorted cues
    sorted_cues = sorted(update_data.cues, key=lambda c: c.start_time)
    new_cues = []
    for idx, cue_data in enumerate(sorted_cues, start=1):
        cue = CaptionCue(
            track_id=track_id,
            cue_index=idx,
            start_time=cue_data.start_time,
            end_time=cue_data.end_time,
            text=cue_data.text.strip(),
            speaker=cue_data.speaker
        )
        new_cues.append(cue)
        db.add(cue)

    db.commit()

    # Regenerate SRT and VTT
    srt_text = generate_srt(new_cues)
    vtt_text = generate_vtt(new_cues)

    srt_file = EXPORTS_DIR / f"track_{track.id}_{track.language}.srt"
    vtt_file = EXPORTS_DIR / f"track_{track.id}_{track.language}.vtt"

    with open(srt_file, "w", encoding="utf-8") as f:
        f.write(srt_text)
    with open(vtt_file, "w", encoding="utf-8") as f:
        f.write(vtt_text)

    track.srt_path = str(srt_file)
    track.vtt_path = str(vtt_file)
    db.commit()
    db.refresh(track)

    return track

@router.get("/tracks/{track_id}/export/srt")
def export_srt(
    track_id: int,
    db: Session = Depends(get_db)
):
    track = db.query(CaptionTrack).filter(CaptionTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    filename = f"{Path(video.original_filename).stem if video else 'captions'}_{track.language}.srt"

    # If file exists on disk, send it
    if track.srt_path and os.path.exists(track.srt_path):
        return FileResponse(
            path=track.srt_path,
            filename=filename,
            media_type="text/plain; charset=utf-8"
        )

    # Otherwise generate on-the-fly
    cues = track.cues
    srt_text = generate_srt(cues)
    return Response(
        content=srt_text,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/tracks/{track_id}/export/vtt")
def export_vtt(
    track_id: int,
    download: bool = False,
    db: Session = Depends(get_db)
):
    track = db.query(CaptionTrack).filter(CaptionTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    filename = f"{Path(video.original_filename).stem if video else 'captions'}_{track.language}.vtt"

    cues = track.cues
    vtt_text = generate_vtt(cues)

    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return Response(
        content=vtt_text,
        media_type="text/vtt; charset=utf-8",
        headers=headers
    )

@router.delete("/tracks/{track_id}", status_code=status.HTTP_200_OK)
def delete_track(
    track_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    track = db.query(CaptionTrack).filter(CaptionTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    if not video or video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Remove files if present
    if track.srt_path and os.path.exists(track.srt_path):
        try:
            os.remove(track.srt_path)
        except Exception:
            pass
    if track.vtt_path and os.path.exists(track.vtt_path):
        try:
            os.remove(track.vtt_path)
        except Exception:
            pass

    db.delete(track)
    db.commit()
    return {"message": "Caption track deleted successfully", "id": track_id}
