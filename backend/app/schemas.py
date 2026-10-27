from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# ----------------- User Schemas -----------------
class UserRegister(BaseModel):
    email: str = Field(..., pattern=r"^[\w\.\+-]+@[\w\.-]+\.\w+$", description="Valid email address")
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ----------------- Caption Cue Schemas -----------------
class CaptionCueBase(BaseModel):
    cue_index: int
    start_time: float
    end_time: float
    text: str
    speaker: Optional[str] = None

class CaptionCueCreate(BaseModel):
    cue_index: Optional[int] = None
    start_time: float
    end_time: float
    text: str
    speaker: Optional[str] = None

class CaptionCueResponse(CaptionCueBase):
    id: int
    track_id: int

    class Config:
        from_attributes = True

# ----------------- Caption Track Schemas -----------------
class CaptionTrackSummaryResponse(BaseModel):
    id: int
    video_id: int
    language: str
    language_name: str
    is_original: bool
    status: str
    cue_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CaptionTrackResponse(BaseModel):
    id: int
    video_id: int
    language: str
    language_name: str
    is_original: bool
    status: str
    error_message: Optional[str] = None
    cues: List[CaptionCueResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CaptionTrackUpdate(BaseModel):
    cues: List[CaptionCueCreate]

class TranscribeRequest(BaseModel):
    source_language: Optional[str] = None  # None or 'auto' for automatic spoken language detection
    language: Optional[str] = None         # Backward-compatibility alias

# ----------------- Dubbed Audio Schemas -----------------
class GenerateDubRequest(BaseModel):
    target_language: str
    source_track_id: Optional[int] = None  # Optional: specific caption track to dub from

class DubbedTrackSummaryResponse(BaseModel):
    id: int
    video_id: int
    language: str
    language_name: str
    status: str
    duration_seconds: float
    has_exported_video: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DubbedTrackResponse(BaseModel):
    id: int
    video_id: int
    language: str
    language_name: str
    audio_path: str
    video_export_path: Optional[str] = None
    source_track_id: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    duration_seconds: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ----------------- Video Schemas -----------------
class VideoResponse(BaseModel):
    id: int
    title: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    duration_seconds: float
    status: str
    error_message: Optional[str] = None
    caption_tracks_count: int = 0
    dubbed_tracks_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class VideoDetailResponse(VideoResponse):
    caption_tracks: List[CaptionTrackSummaryResponse] = []
    dubbed_tracks: List[DubbedTrackSummaryResponse] = []

    class Config:
        from_attributes = True

# ----------------- Translation Schemas -----------------
class TranslateRequest(BaseModel):
    source_track_id: int
    target_languages: List[str]  # List of language codes, e.g. ["es", "fr", "hi"]

class SupportedLanguage(BaseModel):
    code: str
    name: str
    native: str
