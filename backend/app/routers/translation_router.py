import os
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Video, CaptionTrack, CaptionCue
from ..schemas import TranslateRequest, CaptionTrackResponse, SupportedLanguage
from ..auth import get_current_user
from ..config import SUPPORTED_LANGUAGES, EXPORTS_DIR
from ..translation_service import translate_cues, get_language_name
from ..subtitle_utils import generate_srt, generate_vtt

router = APIRouter(prefix="/api/translation", tags=["Subtitle Translation"])

@router.get("/languages", response_model=List[SupportedLanguage])
def get_languages():
    """Return all supported translation target languages."""
    return [SupportedLanguage(**lang) for lang in SUPPORTED_LANGUAGES]

@router.post("/{video_id}/translate", response_model=List[CaptionTrackResponse])
def translate_video_captions(
    video_id: int,
    req: TranslateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id, Video.user_id == current_user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")

    source_track = None
    if req.source_track_id:
        source_track = db.query(CaptionTrack).filter(
            CaptionTrack.id == req.source_track_id,
            CaptionTrack.video_id == video_id
        ).first()

    if not source_track:
        source_track = db.query(CaptionTrack).filter(
            CaptionTrack.video_id == video_id,
            CaptionTrack.is_original == True
        ).first()

    if not source_track:
        raise HTTPException(status_code=404, detail="Source caption track not found. Please transcribe the video first.")

    source_cues = source_track.cues
    if not source_cues:
        raise HTTPException(status_code=400, detail="Source caption track has no cues to translate.")

    cues_dict_list = [
        {"cue_index": c.cue_index, "start_time": c.start_time, "end_time": c.end_time, "text": c.text, "speaker": c.speaker}
        for c in source_cues
    ]

    created_tracks: List[CaptionTrack] = []

    for target_lang in req.target_languages:
        target_code = target_lang.strip()
        lang_name = get_language_name(target_code)

        # Check if translation track already exists for this language
        existing_track = db.query(CaptionTrack).filter(
            CaptionTrack.video_id == video_id,
            CaptionTrack.language == target_code,
            CaptionTrack.is_original == False
        ).first()

        if existing_track:
            target_track = existing_track
            # Delete old cues
            db.query(CaptionCue).filter(CaptionCue.track_id == target_track.id).delete()
        else:
            target_track = CaptionTrack(
                video_id=video.id,
                language=target_code,
                language_name=lang_name,
                is_original=False,
                source_track_id=source_track.id,
                status="READY"
            )
            db.add(target_track)
            db.commit()
            db.refresh(target_track)

        # Run translation preserving timestamps
        try:
            translated_cues = translate_cues(
                cues=cues_dict_list,
                target_language=target_code,
                source_language=source_track.language
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Translation failed for {lang_name}: {str(e)}")

        new_cues_models = []
        for cue_item in translated_cues:
            cue = CaptionCue(
                track_id=target_track.id,
                cue_index=cue_item["cue_index"],
                start_time=cue_item["start_time"],
                end_time=cue_item["end_time"],
                text=cue_item["text"],
                speaker=cue_item.get("speaker")
            )
            new_cues_models.append(cue)
            db.add(cue)

        db.commit()

        # Generate SRT and VTT files
        srt_text = generate_srt(new_cues_models)
        vtt_text = generate_vtt(new_cues_models)

        srt_file = EXPORTS_DIR / f"track_{target_track.id}_{target_code}.srt"
        vtt_file = EXPORTS_DIR / f"track_{target_track.id}_{target_code}.vtt"

        with open(srt_file, "w", encoding="utf-8") as f:
            f.write(srt_text)
        with open(vtt_file, "w", encoding="utf-8") as f:
            f.write(vtt_text)

        target_track.srt_path = str(srt_file)
        target_track.vtt_path = str(vtt_file)
        db.commit()
        db.refresh(target_track)

        created_tracks.append(target_track)

    return created_tracks
