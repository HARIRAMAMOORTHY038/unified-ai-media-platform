import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from jose import jwt
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import (
    ALLOWED_EXTENSIONS,
    AUDIO_DIR,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    MAX_FILE_SIZE_BYTES,
    VIDEOS_DIR,
)
from ..database import get_db
from ..ffmpeg_utils import extract_audio_from_video, get_media_duration
from ..models import User, Video
from ..schemas import (
    CaptionTrackSummaryResponse,
    VideoDetailResponse,
    VideoResponse,
)
from ..search_service import search_user_captions


router = APIRouter(prefix="/api/media", tags=["Media Management"])


def verify_stream_token(
    token: Optional[str],
    db: Session,
) -> Optional[User]:
    """Validate an optional token used by the video stream endpoint."""
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        subject = payload.get("sub")

        if subject is None:
            return None

        user_id = int(subject)
        return db.query(User).filter(User.id == user_id).first()

    except Exception:
        return None


# ---------------------------------------------------------
# Upload a video
# ---------------------------------------------------------
@router.post(
    "/upload",
    response_model=VideoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original_filename = file.filename or "media_upload"
    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file format '{extension}'. "
                f"Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    unique_id = uuid.uuid4().hex
    safe_name = (
        f"{unique_id}_{Path(original_filename).stem[:50]}{extension}"
    )
    video_save_path = VIDEOS_DIR / safe_name

    bytes_read = 0

    try:
        with open(video_save_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                bytes_read += len(chunk)

                if bytes_read > MAX_FILE_SIZE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=(
                            "File exceeds maximum allowed size of "
                            f"{MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB"
                        ),
                    )

                buffer.write(chunk)

    except HTTPException:
        if video_save_path.exists():
            video_save_path.unlink()
        raise

    except Exception as exc:
        if video_save_path.exists():
            video_save_path.unlink()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(exc)}",
        ) from exc

    finally:
        await file.close()

    # Extract audio and determine duration when possible.
    audio_save_path = AUDIO_DIR / f"{unique_id}.wav"
    duration = 0.0

    try:
        extract_audio_from_video(
            str(video_save_path),
            str(audio_save_path),
        )
        duration = get_media_duration(str(video_save_path))

    except Exception as exc:
        print(f"[Upload] Audio extraction warning: {exc}")

    video_record = Video(
        user_id=current_user.id,
        title=Path(original_filename).stem.replace("_", " ").title(),
        original_filename=original_filename,
        file_path=str(video_save_path),
        file_size_bytes=bytes_read,
        mime_type=file.content_type or "video/mp4",
        duration_seconds=duration,
        audio_path=(
            str(audio_save_path)
            if audio_save_path.exists()
            else None
        ),
        status="READY",
    )

    try:
        db.add(video_record)
        db.commit()
        db.refresh(video_record)

    except Exception as exc:
        db.rollback()

        if video_save_path.exists():
            video_save_path.unlink()

        if audio_save_path.exists():
            audio_save_path.unlink()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save video information to the database.",
        ) from exc

    response = VideoResponse.model_validate(video_record)
    response.caption_tracks_count = 0

    return response


# ---------------------------------------------------------
# List videos belonging to the signed-in user
# ---------------------------------------------------------
@router.get("/list", response_model=List[VideoResponse])
def list_videos(
    search: Optional[str] = Query(None, max_length=200),
    sort_by: Optional[str] = Query("newest"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Video).filter(
        Video.user_id == current_user.id
    )

    if search and search.strip():
        search_filter = f"%{search.strip()}%"

        query = query.filter(
            (Video.title.ilike(search_filter))
            | (Video.original_filename.ilike(search_filter))
        )

    if sort_by == "oldest":
        query = query.order_by(Video.created_at.asc())

    elif sort_by == "title":
        query = query.order_by(Video.title.asc())

    else:
        query = query.order_by(desc(Video.created_at))

    videos = query.all()
    results = []

    for video in videos:
        item = VideoResponse.model_validate(video)
        item.caption_tracks_count = len(video.caption_tracks)
        item.dubbed_tracks_count = len(video.dubbed_tracks)
        results.append(item)

    return results


# ---------------------------------------------------------
# Multilingual semantic search
#
# Supports both:
#   /api/media/semantic-search?q=superhero
#   /api/media/semantic-search?query=superhero
#
# Keep this static route BEFORE /{video_id}.
# ---------------------------------------------------------
@router.get("/semantic-search")
def semantic_search_videos(
    q: Optional[str] = Query(
        None,
        min_length=1,
        max_length=500,
    ),
    query: Optional[str] = Query(
        None,
        min_length=1,
        max_length=500,
    ),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Accept either frontend parameter name.
    query_text = (q if q is not None else query) or ""
    query_text = query_text.strip()

    if not query_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Search text is required. "
                "Pass it using the 'q' or 'query' parameter."
            ),
        )

    try:
        matches = search_user_captions(
            db=db,
            user_id=current_user.id,
            query_text=query_text,
            limit=limit,
        )

        results = []
        video_metadata = {}

        for match in matches:
            video = match["video"]
            video_id = video.id

            # Prepare each video's metadata only once.
            if video_id not in video_metadata:
                video_response = VideoResponse.model_validate(video)
                video_response.caption_tracks_count = len(
                    video.caption_tracks
                )
                video_response.dubbed_tracks_count = len(
                    video.dubbed_tracks
                )

                video_metadata[video_id] = (
                    video_response.model_dump(mode="json")
                )

            cue = match["cue"]
            track = match["track"]

            results.append(
                {
                    "video": video_metadata[video_id],
                    "video_id": video_id,
                    "timestamp_seconds": round(
                        float(cue.start_time), 2
                    ),
                    "end_seconds": round(
                        float(cue.end_time), 2
                    ),
                    "snippet": match["text"],
                    "language": track.language,
                    "language_name": track.language_name,
                    "score": round(float(match["score"]), 4),
                }
            )

        return {
            "query": query_text,
            "results": results,
        }

    except ImportError as exc:
        print(f"[Semantic Search] Missing dependency: {exc}")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Semantic search dependency is missing. "
                "Check the backend requirements and restart the backend."
            ),
        ) from exc

    except Exception as exc:
        print(f"[Semantic Search] Search failed: {exc}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Semantic search failed. "
                "Check the backend terminal for details."
            ),
        ) from exc


# ---------------------------------------------------------
# Get video details
# ---------------------------------------------------------
@router.get(
    "/{video_id}",
    response_model=VideoDetailResponse,
)
def get_video_detail(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = (
        db.query(Video)
        .filter(
            Video.id == video_id,
            Video.user_id == current_user.id,
        )
        .first()
    )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied",
        )

    detail = VideoDetailResponse.model_validate(video)
    detail.caption_tracks_count = len(video.caption_tracks)

    tracks_summary = []

    for track in video.caption_tracks:
        track_summary = CaptionTrackSummaryResponse(
            id=track.id,
            video_id=track.video_id,
            language=track.language,
            language_name=track.language_name,
            is_original=track.is_original,
            status=track.status,
            cue_count=len(track.cues),
            created_at=track.created_at,
            updated_at=track.updated_at,
        )
        tracks_summary.append(track_summary)

    detail.caption_tracks = tracks_summary

    dubbed_summary = []

    for dub in video.dubbed_tracks:
        has_exported = bool(
            dub.video_export_path
            and os.path.exists(dub.video_export_path)
        )

        dubbed_summary.append(
            {
                "id": dub.id,
                "video_id": dub.video_id,
                "language": dub.language,
                "language_name": dub.language_name,
                "status": dub.status,
                "duration_seconds": dub.duration_seconds,
                "has_exported_video": has_exported,
                "created_at": dub.created_at,
                "updated_at": dub.updated_at,
            }
        )

    detail.dubbed_tracks = dubbed_summary

    return detail


# ---------------------------------------------------------
# Stream a video
# ---------------------------------------------------------
@router.get("/{video_id}/stream")
def stream_video(
    video_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    user = verify_stream_token(token, db)

    video = (
        db.query(Video)
        .filter(Video.id == video_id)
        .first()
    )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # A valid token must belong to the owner of the video.
    if user is not None and video.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    # Preserve token-based streaming behavior for existing players.
    # If your application requires authentication for every stream,
    # reject missing or invalid tokens here.
    file_path = Path(video.file_path)

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file on disk not found",
        )

    return FileResponse(
        path=str(file_path),
        media_type=video.mime_type or "video/mp4",
        filename=video.original_filename,
    )


# ---------------------------------------------------------
# Delete a video and its associated assets
# ---------------------------------------------------------
@router.delete("/{video_id}", status_code=status.HTTP_200_OK)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = (
        db.query(Video)
        .filter(
            Video.id == video_id,
            Video.user_id == current_user.id,
        )
        .first()
    )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied",
        )

    # Remove the video and extracted audio files when present.
    paths_to_delete = []

    if video.file_path:
        paths_to_delete.append(video.file_path)

    if video.audio_path:
        paths_to_delete.append(video.audio_path)

    for track in video.caption_tracks:
        if track.srt_path:
            paths_to_delete.append(track.srt_path)

        if track.vtt_path:
            paths_to_delete.append(track.vtt_path)

    for dub in video.dubbed_tracks:
        if dub.audio_path:
            paths_to_delete.append(dub.audio_path)

        if dub.video_export_path:
            paths_to_delete.append(dub.video_export_path)

    # Commit the database deletion before deleting physical files.
    # This avoids leaving the database transaction half-completed
    # if an individual file cannot be removed.
    try:
        db.delete(video)
        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete video information from the database.",
        ) from exc

    for file_path in paths_to_delete:
        try:
            if file_path and os.path.isfile(file_path):
                os.remove(file_path)
        except OSError as exc:
            print(
                f"[Delete Video] Could not remove file "
                f"{file_path}: {exc}"
            )

    return {
        "message": "Video and associated database records deleted successfully",
        "id": video_id,
    }
