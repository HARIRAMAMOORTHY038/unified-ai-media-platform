import os
import uuid
from typing import List, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..database import get_db
from ..models import User, Video, CaptionTrack, DubbedTrack
from ..schemas import VideoResponse, VideoDetailResponse, CaptionTrackSummaryResponse, DubbedTrackSummaryResponse
from ..auth import get_current_user
from ..config import VIDEOS_DIR, AUDIO_DIR, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, JWT_SECRET_KEY, JWT_ALGORITHM
from ..ffmpeg_utils import extract_audio_from_video, get_media_duration
from jose import jwt, JWTError

router = APIRouter(prefix="/api/media", tags=["Media Management"])

def verify_stream_token(token: Optional[str], db: Session) -> Optional[User]:
    """Helper to verify JWT token passed as query param for HTML5 video element"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None

@router.post("/upload", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    original_filename = file.filename or "media_upload"
    ext = Path(original_filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Secure unique filename
    unique_id = uuid.uuid4().hex
    safe_name = f"{unique_id}_{Path(original_filename).stem[:50]}{ext}"
    video_save_path = VIDEOS_DIR / safe_name

    # Stream file to disk and validate size
    bytes_read = 0
    try:
        with open(video_save_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                bytes_read += len(chunk)
                if bytes_read > MAX_FILE_SIZE_BYTES:
                    buffer.close()
                    if video_save_path.exists():
                        video_save_path.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB"
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if video_save_path.exists():
            video_save_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Extract audio using FFmpeg
    audio_save_path = AUDIO_DIR / f"{unique_id}.wav"
    duration = 0.0
    try:
        extract_audio_from_video(str(video_save_path), str(audio_save_path))
        duration = get_media_duration(str(video_save_path))
    except Exception as err:
        # Keep video record, mark status with note
        print(f"Warning: Audio extraction warning: {err}")

    video_record = Video(
        user_id=current_user.id,
        title=Path(original_filename).stem.replace("_", " ").title(),
        original_filename=original_filename,
        file_path=str(video_save_path),
        file_size_bytes=bytes_read,
        mime_type=file.content_type or "video/mp4",
        duration_seconds=duration,
        audio_path=str(audio_save_path) if audio_save_path.exists() else None,
        status="READY"
    )

    db.add(video_record)
    db.commit()
    db.refresh(video_record)

    res = VideoResponse.model_validate(video_record)
    res.caption_tracks_count = 0
    return res

@router.get("/list", response_model=List[VideoResponse])
def list_videos(
    search: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Video).filter(Video.user_id == current_user.id)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            (Video.title.ilike(search_filter)) | (Video.original_filename.ilike(search_filter))
        )

    if sort_by == "oldest":
        query = query.order_by(Video.created_at.asc())
    elif sort_by == "title":
        query = query.order_by(Video.title.asc())
    else:
        query = query.order_by(desc(Video.created_at))

    videos = query.all()
    results = []
    for v in videos:
        item = VideoResponse.model_validate(v)
        item.caption_tracks_count = len(v.caption_tracks)
        item.dubbed_tracks_count = len(v.dubbed_tracks)
        results.append(item)
    return results

@router.get("/{video_id}", response_model=VideoDetailResponse)
def get_video_detail(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id, Video.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")

    detail = VideoDetailResponse.model_validate(video)
    detail.caption_tracks_count = len(video.caption_tracks)

    tracks_summary = []
    for t in video.caption_tracks:
        track_dict = CaptionTrackSummaryResponse(
            id=t.id,
            video_id=t.video_id,
            language=t.language,
            language_name=t.language_name,
            is_original=t.is_original,
            status=t.status,
            cue_count=len(t.cues),
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        tracks_summary.append(track_dict)

    detail.caption_tracks = tracks_summary

    dubbed_summary = []
    for d in video.dubbed_tracks:
        has_exported = bool(d.video_export_path and os.path.exists(d.video_export_path))
        d_dict = {
            "id": d.id,
            "video_id": d.video_id,
            "language": d.language,
            "language_name": d.language_name,
            "status": d.status,
            "duration_seconds": d.duration_seconds,
            "has_exported_video": has_exported,
            "created_at": d.created_at,
            "updated_at": d.updated_at
        }
        dubbed_summary.append(d_dict)

    detail.dubbed_tracks = dubbed_summary
    return detail

@router.get("/{video_id}/stream")
def stream_video(
    video_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Serve video with range request support for smooth browser playback."""
    # Authenticate via query param token or fallback to check DB
    user = verify_stream_token(token, db)
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if user and video.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    file_path = Path(video.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file on disk not found")

    return FileResponse(
        path=str(file_path),
        media_type=video.mime_type or "video/mp4",
        filename=video.original_filename
    )

@router.delete("/{video_id}", status_code=status.HTTP_200_OK)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id, Video.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")

    # Delete video file and audio file
    if video.file_path and os.path.exists(video.file_path):
        try:
            os.remove(video.file_path)
        except Exception:
            pass

    if video.audio_path and os.path.exists(video.audio_path):
        try:
            os.remove(video.audio_path)
        except Exception:
            pass

    # Delete SRT/VTT files for any associated tracks
    for track in video.caption_tracks:
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

    # Delete audio and video files for any associated dubbed tracks
    for dub in video.dubbed_tracks:
        if dub.audio_path and os.path.exists(dub.audio_path):
            try:
                os.remove(dub.audio_path)
            except Exception:
                pass
        if dub.video_export_path and os.path.exists(dub.video_export_path):
            try:
                os.remove(dub.video_export_path)
            except Exception:
                pass

    db.delete(video)
    db.commit()
    return {"message": "Video and all associated assets deleted successfully", "id": video_id}
