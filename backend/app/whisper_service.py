import logging
import wave
from pathlib import Path
from typing import Optional, Dict, Any, List

import numpy as np

from .config import WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE

# PyAV compatibility: remove the deprecated argument when present.
try:
    import av

    _orig_av_open = av.open

    def _safe_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)

    av.open = _safe_av_open
except Exception:
    pass

logger = logging.getLogger(__name__)
_model_instance = None

# Accept common UI labels and ISO language codes.
_LANGUAGE_ALIASES = {
    "auto": None,
    "automatic": None,
    "detect": None,
    "english": "en",
    "en": "en",
    "hindi": "hi",
    "हिन्दी": "hi",
    "हिंदी": "hi",
    "hi": "hi",
    "tamil": "ta",
    "தமிழ்": "ta",
    "ta": "ta",
    "urdu": "ur",
    "اردو": "ur",
    "ur": "ur",
    "telugu": "te",
    "te": "te",
    "malayalam": "ml",
    "ml": "ml",
    "kannada": "kn",
    "kn": "kn",
    "bengali": "bn",
    "bn": "bn",
    "marathi": "mr",
    "mr": "mr",
    "spanish": "es",
    "es": "es",
    "french": "fr",
    "fr": "fr",
    "german": "de",
    "de": "de",
    "japanese": "ja",
    "ja": "ja",
    "chinese": "zh",
    "zh": "zh",
}


def normalize_language(language: Optional[str]) -> Optional[str]:
    """Normalize UI language labels/codes to Faster-Whisper language codes."""
    if language is None:
        return None
    value = str(language).strip()
    if not value:
        return None
    return _LANGUAGE_ALIASES.get(value.lower(), _LANGUAGE_ALIASES.get(value, value.lower()))


def get_whisper_model():
    """Lazily load and cache the Faster-Whisper model."""
    global _model_instance
    if _model_instance is None:
        from faster_whisper import WhisperModel

        logger.info(
            "Loading Faster-Whisper model '%s' on %s (%s)...",
            WHISPER_MODEL_SIZE,
            WHISPER_DEVICE,
            WHISPER_COMPUTE_TYPE,
        )
        _model_instance = WhisperModel(
            model_size_or_path=WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
            download_root=None,
        )
        logger.info("Faster-Whisper model loaded successfully.")
    return _model_instance


def load_audio_waveform(audio_path: str):
    """
    Load standard 16 kHz mono PCM WAV as float32 when possible.
    Otherwise return the path so Faster-Whisper decodes it.
    """
    path = Path(audio_path)
    if path.suffix.lower() == ".wav" and path.exists():
        try:
            with wave.open(str(path), "rb") as wf:
                channels = wf.getnchannels()
                sample_rate = wf.getframerate()
                sample_width = wf.getsampwidth()
                if channels == 1 and sample_rate == 16000 and sample_width == 2:
                    frames = wf.readframes(wf.getnframes())
                    audio_int16 = np.frombuffer(frames, dtype=np.int16)
                    return audio_int16.astype(np.float32) / 32768.0
        except Exception:
            logger.debug("Direct WAV load failed; falling back to file decoding.", exc_info=True)
    return str(path)


def _run_transcription(model, audio_input, language_code, use_vad):
    """Run one transcription attempt with consistent decoding options."""
    kwargs = {
        "language": language_code,
        "beam_size": 5,
        "vad_filter": use_vad,
        "condition_on_previous_text": False,
    }
    if use_vad:
        kwargs["vad_parameters"] = {
            "min_silence_duration_ms": 500,
            "speech_pad_ms": 300,
        }
    segments, info = model.transcribe(audio_input, **kwargs)
    # Faster-Whisper returns a lazy segment generator; consume it here.
    segment_list = list(segments)
    return segment_list, info


def transcribe_audio(audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
    """
    Transcribe speech into timestamped cues.

    `language` may be None/"auto", a Faster-Whisper code (e.g. "hi", "ta"),
    or a common label (e.g. "Hindi", "Tamil", "English").
    Returns language, language_probability, and cues with the existing schema.
    """
    model = get_whisper_model()
    audio_input = load_audio_waveform(audio_path)
    requested_language = normalize_language(language)

    logger.info("Requested transcription language: %r (normalized=%r)", language, requested_language)

    # Explicitly selected languages avoid automatic Hindi/Urdu confusion.
    # In Auto mode, detection remains model-driven and may be imperfect.
    segments, info = _run_transcription(
        model, audio_input, requested_language, use_vad=True
    )

    # If VAD removed all speech, retry without VAD.
    if not any(segment.text.strip() for segment in segments):
        logger.warning("No non-empty transcript with VAD; retrying without VAD.")
        segments, info = _run_transcription(
            model, audio_input, requested_language, use_vad=False
        )

    cues: List[Dict[str, Any]] = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            cues.append({
                "cue_index": len(cues) + 1,
                "start_time": round(float(segment.start), 2),
                "end_time": round(float(segment.end), 2),
                "text": text,
            })

    detected_language = requested_language or getattr(info, "language", None) or "en"
    probability = getattr(info, "language_probability", None)

    logger.info(
        "Transcription complete: language=%s probability=%s cue_count=%d",
        detected_language,
        probability,
        len(cues),
    )

    return {
        "language": detected_language,
        "language_probability": round(float(probability), 3) if probability is not None else 1.0,
        "cues": cues,
    }
