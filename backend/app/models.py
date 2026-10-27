from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    videos = relationship("Video", back_populates="user", cascade="all, delete-orphan")

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    mime_type = Column(String(100), default="video/mp4")
    duration_seconds = Column(Float, default=0.0)
    audio_path = Column(String(500), nullable=True)
    status = Column(String(50), default="READY")  # UPLOADED, EXTRACTING_AUDIO, TRANSCRIBING, READY, ERROR
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="videos")
    caption_tracks = relationship("CaptionTrack", back_populates="video", cascade="all, delete-orphan")
    dubbed_tracks = relationship("DubbedTrack", back_populates="video", cascade="all, delete-orphan")

class CaptionTrack(Base):
    __tablename__ = "caption_tracks"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    language = Column(String(10), nullable=False)  # ISO code like 'en', 'es', 'hi'
    language_name = Column(String(50), nullable=False)
    is_original = Column(Boolean, default=False)
    source_track_id = Column(Integer, ForeignKey("caption_tracks.id"), nullable=True)
    status = Column(String(50), default="READY")  # PENDING, PROCESSING, READY, ERROR
    error_message = Column(Text, nullable=True)
    srt_path = Column(String(500), nullable=True)
    vtt_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    video = relationship("Video", back_populates="caption_tracks")
    cues = relationship("CaptionCue", back_populates="track", cascade="all, delete-orphan", order_by="CaptionCue.start_time")

class CaptionCue(Base):
    __tablename__ = "caption_cues"

    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("caption_tracks.id"), nullable=False, index=True)
    cue_index = Column(Integer, nullable=False)
    start_time = Column(Float, nullable=False)  # In seconds (e.g. 3.45)
    end_time = Column(Float, nullable=False)    # In seconds (e.g. 7.12)
    text = Column(Text, nullable=False)
    speaker = Column(String(50), nullable=True)

    track = relationship("CaptionTrack", back_populates="cues")

class DubbedTrack(Base):
    __tablename__ = "dubbed_tracks"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    language = Column(String(10), nullable=False)  # ISO code, e.g. 'ta', 'hi', 'es'
    language_name = Column(String(50), nullable=False)
    audio_path = Column(String(500), nullable=False)
    video_export_path = Column(String(500), nullable=True)
    source_track_id = Column(Integer, ForeignKey("caption_tracks.id"), nullable=True)
    status = Column(String(50), default="READY")  # PENDING, PROCESSING, READY, ERROR
    error_message = Column(Text, nullable=True)
    duration_seconds = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    video = relationship("Video", back_populates="dubbed_tracks")
