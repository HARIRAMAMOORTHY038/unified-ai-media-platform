import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from jose import jwt

from ..database import get_db
from ..models import User, Video, CaptionTrack, CaptionCue, DubbedTrack
from ..schemas import (
    GenerateDubRequest,
    DubbedTrackResponse,
    DubbedTrackSummaryResponse
)
from ..auth import get_current_user
from ..config import EXPORTS_DIR, JWT_SECRET_KEY, JWT_ALGORITHM
from ..translation_service import get_language_name, translate_cues
from ..tts_service import generate_dubbed_audio, export_dubbed_video

router = APIRouter(prefix="/api/dubbing", tags=["Audio Dubbing"])

def verify_audio_token(token: Optional[str], db: Session) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None

@router.post("/{video_id}/generate", response_model=DubbedTrackResponse)
def generate_dub(
    video_id: int,
    req: GenerateDubRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id, Video.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")

    target_lang = req.target_language.strip().lower()
    target_name = get_language_name(target_lang)

    # 1. Prefer an existing caption track in the requested target language.
    # This prevents sending original English cues directly to Tamil/Hindi TTS.
    caption_track = db.query(CaptionTrack).filter(
        CaptionTrack.video_id == video_id,
        CaptionTrack.language == target_lang
    ).first()

    if not caption_track:
        source_track = None

        # If the caller selected a source track, use it as the translation source.
        if req.source_track_id:
            source_track = db.query(CaptionTrack).filter(
                CaptionTrack.id == req.source_track_id,
                CaptionTrack.video_id == video_id
            ).first()
            if source_track is None:
                raise HTTPException(
                    status_code=404,
                    detail="Selected source caption track was not found for this video."
                )

        # Otherwise, fall back to the video's original caption track.
        if source_track is None:
            source_track = db.query(CaptionTrack).filter(
                CaptionTrack.video_id == video_id,
                CaptionTrack.is_original == True
            ).first()

        if source_track is None or not source_track.cues:
            raise HTTPException(
                status_code=400,
                detail="Please transcribe the original video speech before generating dubbed audio."
            )

        source_language = (source_track.language or "auto").strip().lower()

        # If the chosen source is already in the requested language, use it.
        if source_language == target_lang:
            caption_track = source_track
        else:
            source_cues_data = [
                {
                    "cue_index": cue.cue_index,
                    "start_time": cue.start_time,
                    "end_time": cue.end_time,
                    "text": cue.text,
                    "speaker": cue.speaker,
                }
                for cue in source_track.cues
            ]

            try:
                translated_cues = translate_cues(
                    source_cues_data,
                    target_language=target_lang,
                    source_language=source_language,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=f"Automatic translation for dubbing failed: {str(exc)}",
                ) from exc

            if not translated_cues or not any(
                str(item.get("text", "")).strip() for item in translated_cues
            ):
                raise HTTPException(
                    status_code=500,
                    detail="Translation returned no usable caption text. Please check translation settings and retry."
                )

            # Create a translated caption track and preserve cue timing.
            caption_track = CaptionTrack(
                video_id=video.id,
                language=target_lang,
                language_name=target_name,
                is_original=False,
                source_track_id=source_track.id,
                status="READY",
            )
            db.add(caption_track)
            db.flush()

            for item in translated_cues:
                db.add(
                    CaptionCue(
                        track_id=caption_track.id,
                        cue_index=item.get("cue_index"),
                        start_time=item.get("start_time", 0.0),
                        end_time=item.get("end_time", 0.0),
                        text=str(item.get("text", "")).strip(),
                        speaker=item.get("speaker"),
                    )
                )

            db.commit()
            db.refresh(caption_track)

    if not caption_track.cues:
        raise HTTPException(status_code=400, detail="Caption track contains no speech cues to dub.")

    # 2. Synthesize dubbed audio aligned with timeline
    try:
        dub_result = generate_dubbed_audio(
            video_id=video.id,
            language_code=target_lang,
            cues=caption_track.cues,
            video_duration=video.duration_seconds or 10.0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio dubbing synthesis failed: {str(e)}")

    # 3. Store in database (prevent duplicate records for same video and language)
    existing_dub = db.query(DubbedTrack).filter(
        DubbedTrack.video_id == video.id,
        DubbedTrack.language == target_lang
    ).first()

    if existing_dub:
        dub_track = existing_dub
        dub_track.audio_path = dub_result["audio_path"]
        dub_track.duration_seconds = dub_result["duration_seconds"]
        dub_track.source_track_id = caption_track.id
        dub_track.status = "READY"
        dub_track.error_message = None
        # Invalidate previous video export if audio was regenerated
        dub_track.video_export_path = None
    else:
        dub_track = DubbedTrack(
            video_id=video.id,
            language=target_lang,
            language_name=target_name,
            audio_path=dub_result["audio_path"],
            duration_seconds=dub_result["duration_seconds"],
            source_track_id=caption_track.id,
            status="READY"
        )
        db.add(dub_track)

    db.commit()
    db.refresh(dub_track)
    return dub_track

@router.get("/{video_id}/tracks", response_model=List[DubbedTrackSummaryResponse])
def get_video_dubbed_tracks(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id, Video.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")

    tracks = db.query(DubbedTrack).filter(DubbedTrack.video_id == video_id).all()
    results = []
    for t in tracks:
        item = DubbedTrackSummaryResponse(
            id=t.id,
            video_id=t.video_id,
            language=t.language,
            language_name=t.language_name,
            status=t.status,
            duration_seconds=t.duration_seconds,
            has_exported_video=bool(t.video_export_path and os.path.exists(t.video_export_path)),
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        results.append(item)
    return results

@router.get("/tracks/{track_id}/audio")
def stream_dubbed_audio(
    track_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Serve dubbed audio file with range streaming support for HTML5 audio."""
    track = db.query(DubbedTrack).filter(DubbedTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Dubbed track not found")

    user = verify_audio_token(token, db)
    video = db.query(Video).filter(Video.id == track.video_id).first()
    if user and video and video.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    file_path = Path(track.audio_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dubbed audio file on disk not found")

    return FileResponse(
        path=str(file_path),
        media_type="audio/mpeg",
        filename=f"dubbed_{track.video_id}_{track.language}.mp3"
    )

@router.get("/tracks/{track_id}/download")
def download_dubbed_audio(
    track_id: int,
    db: Session = Depends(get_db)
):
    track = db.query(DubbedTrack).filter(DubbedTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Dubbed track not found")

    file_path = Path(track.audio_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on server")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    base_name = Path(video.original_filename).stem if video else f"video_{track.video_id}"
    filename = f"{base_name}_dubbed_{track.language}.mp3"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="audio/mpeg"
    )

@router.post("/tracks/{track_id}/export-video")
def export_video_with_dubbed_audio(
    track_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    track = db.query(DubbedTrack).filter(DubbedTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Dubbed track not found")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    if not video or video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    output_filename = f"dubbed_{video.id}_{track.language}_{Path(video.original_filename).stem}.mp4"
    output_path = str(EXPORTS_DIR / output_filename)

    try:
        export_dubbed_video(video.file_path, track.audio_path, output_path)
        track.video_export_path = output_path
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    return {
        "message": "Dubbed video successfully exported!",
        "track_id": track.id,
        "filename": output_filename,
        "export_url": f"/api/dubbing/tracks/{track.id}/download-video"
    }

@router.get("/tracks/{track_id}/download-video")
def download_dubbed_video(
    track_id: int,
    db: Session = Depends(get_db)
):
    track = db.query(DubbedTrack).filter(DubbedTrack.id == track_id).first()
    if not track or not track.video_export_path or not os.path.exists(track.video_export_path):
        raise HTTPException(status_code=404, detail="Exported video file not found. Please export it first.")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    base_name = Path(video.original_filename).stem if video else f"video_{track.video_id}"
    filename = f"{base_name}_dubbed_{track.language}.mp4"

    return FileResponse(
        path=track.video_export_path,
        filename=filename,
        media_type="video/mp4"
    )

@router.delete("/tracks/{track_id}")
def delete_dubbed_track(
    track_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    track = db.query(DubbedTrack).filter(DubbedTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Dubbed track not found")

    video = db.query(Video).filter(Video.id == track.video_id).first()
    if not video or video.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Clean disk files
    if track.audio_path and os.path.exists(track.audio_path):
        try:
            os.remove(track.audio_path)
        except Exception:
            pass
    if track.video_export_path and os.path.exists(track.video_export_path):
        try:
            os.remove(track.video_export_path)
        except Exception:
            pass

    db.delete(track)
    db.commit()
    return {"message": "Dubbed audio track deleted successfully", "id": track_id}
