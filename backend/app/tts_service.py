import os
import asyncio
import logging
import subprocess
import wave
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Tuple
import edge_tts
from gtts import gTTS

from .config import DUBBED_DIR, EXPORTS_DIR
from .ffmpeg_utils import get_ffmpeg_binary
from .translation_service import get_language_name

logger = logging.getLogger(__name__)

# Neural voices for Edge TTS across major languages
EDGE_VOICES = {
    "ta": "ta-IN-PallaviNeural",       # Tamil
    "hi": "hi-IN-SwaraNeural",         # Hindi
    "en": "en-US-JennyNeural",         # English
    "es": "es-ES-ElviraNeural",        # Spanish
    "fr": "fr-FR-DeniseNeural",        # French
    "de": "de-DE-KatjaNeural",         # German
    "te": "te-IN-ShrutiNeural",        # Telugu
    "ml": "ml-IN-SobhanaNeural",       # Malayalam
    "kn": "kn-IN-SapnaNeural",         # Kannada
    "mr": "mr-IN-AarohiNeural",        # Marathi
    "bn": "bn-IN-TanishaaNeural",      # Bengali
    "ur": "ur-PK-UzmaNeural",          # Urdu
    "zh-cn": "zh-CN-XiaoxiaoNeural",   # Chinese
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",        # Japanese
    "ko": "ko-KR-SunHiNeural",         # Korean
    "ar": "ar-SA-ZariyahNeural",       # Arabic
    "ru": "ru-RU-SvetlanaNeural",      # Russian
    "pt": "pt-PT-RaquelNeural",        # Portuguese
    "it": "it-IT-ElsaNeural",          # Italian
    "nl": "nl-NL-ColetteNeural"        # Dutch
}

def get_voice_for_language(lang_code: str) -> str:
    clean = lang_code.lower().strip()
    return EDGE_VOICES.get(clean, EDGE_VOICES.get(clean[:2], "en-US-JennyNeural"))

async def _synthesize_edge_tts(text: str, voice: str, output_path: str):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

def synthesize_cue_audio(text: str, lang_code: str, temp_base: str) -> str:
    """
    Synthesize audio for a single cue text.
    First tries Microsoft Edge Neural TTS, falls back to Google TTS.
    Returns path to an MP3 file.
    """
    mp3_path = f"{temp_base}.mp3"
    voice = get_voice_for_language(lang_code)

    # Strategy 1: Edge TTS (High quality neural voice)
    try:
        asyncio.run(_synthesize_edge_tts(text, voice, mp3_path))
        if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 100:
            return mp3_path
    except Exception as e:
        logger.warning(f"Edge TTS failed for language {lang_code}: {e}. Trying gTTS fallback...")

    # Strategy 2: gTTS fallback
    try:
        tts = gTTS(text=text, lang=lang_code[:2])
        tts.save(mp3_path)
        if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 100:
            return mp3_path
    except Exception as e:
        logger.error(f"gTTS fallback failed for text '{text[:20]}...': {e}")
        raise RuntimeError(f"Text-to-speech synthesis failed: {str(e)}")

    raise RuntimeError("Text-to-speech synthesis generated empty audio.")

def convert_to_pcm_wav(input_path: str, output_wav_path: str, speed_multiplier: float = 1.0) -> Tuple[np.ndarray, float]:
    """
    Convert audio file to 16kHz mono PCM 16-bit WAV with optional tempo adjustment.
    Returns (samples_array, duration_seconds).
    """
    ffmpeg_exe = get_ffmpeg_binary()
    cmd = [ffmpeg_exe, "-y", "-i", input_path]

    # Apply reasonable tempo adjustment (between 0.8x and 1.3x) if requested
    if abs(speed_multiplier - 1.0) > 0.05:
        speed = max(0.8, min(1.3, speed_multiplier))
        cmd.extend(["-filter:a", f"atempo={speed:.2f}"])

    cmd.extend(["-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", output_wav_path])

    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    with wave.open(output_wav_path, "rb") as wf:
        n_frames = wf.getnframes()
        frames = wf.readframes(n_frames)
        samples = np.frombuffer(frames, dtype=np.int16)
        duration = len(samples) / 16000.0
        return samples, duration

def get_cue_val(c, attr, default=0.0):
    if hasattr(c, attr):
        return getattr(c, attr)
    if isinstance(c, dict):
        return c.get(attr, default)
    return default

def generate_dubbed_audio(
    video_id: int,
    language_code: str,
    cues: List[Any],
    video_duration: float
) -> Dict[str, Any]:
    """
    Generates a full dubbed audio track aligned with video cue timestamps.
    Inserts exact digital silence between cues to stay perfectly synchronized.
    Saves both master WAV and MP3 files.
    """
    if not cues:
        raise ValueError("No subtitle cues available to generate dubbed audio.")

    sample_rate = 16000
    # Determine master track length: at least video duration or end of last cue
    last_cue_end = max((float(get_cue_val(c, "end_time", 0.0)) for c in cues), default=video_duration)
    total_seconds = max(video_duration, last_cue_end + 1.0)
    total_samples = int(total_seconds * sample_rate)

    # Master timeline audio buffer (initialized to silence = zeros)
    master_buffer = np.zeros(total_samples, dtype=np.int16)

    temp_dir = DUBBED_DIR / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    cues_processed = 0
    timing_adjustments = []

    for idx, cue in enumerate(cues, start=1):
        text = str(get_cue_val(cue, "text", ""))
        start_time = float(get_cue_val(cue, "start_time", 0.0))
        end_time = float(get_cue_val(cue, "end_time", start_time + 3.0))

        if not text.strip():
            continue

        temp_base = str(temp_dir / f"cue_{video_id}_{idx}_{language_code}")
        cue_wav = f"{temp_base}.wav"

        try:
            cue_mp3 = synthesize_cue_audio(text, language_code, temp_base)
            # First pass: normal speed
            samples, actual_dur = convert_to_pcm_wav(cue_mp3, cue_wav, speed_multiplier=1.0)
            allocated_dur = max(0.5, end_time - start_time)

            # Check if duration slightly exceeds allocated cue slot
            if actual_dur > allocated_dur * 1.08:
                speed_factor = min(1.25, actual_dur / allocated_dur)
                try:
                    # Slightly speed up to fit within cue slot naturally
                    samples, actual_dur = convert_to_pcm_wav(cue_mp3, cue_wav, speed_multiplier=speed_factor)
                    timing_adjustments.append(f"Cue #{idx}: adjusted tempo by {speed_factor:.2f}x to fit timeline")
                except Exception:
                    pass

            # Place samples into master timeline at start_time
            start_idx = int(start_time * sample_rate)
            if start_idx < total_samples:
                end_idx = min(start_idx + len(samples), total_samples)
                sample_count = end_idx - start_idx
                master_buffer[start_idx:end_idx] = samples[:sample_count]
                cues_processed += 1

            # Clean temporary files for this cue
            for temp_f in [cue_mp3, cue_wav]:
                if os.path.exists(temp_f):
                    try:
                        os.remove(temp_f)
                    except Exception:
                        pass

        except Exception as cue_err:
            logger.error(f"Failed to synthesize cue #{idx} ('{text[:20]}'): {cue_err}")

    if cues_processed == 0:
        raise RuntimeError("No speech cues could be synthesized for dubbed audio.")

    # Write master WAV file
    output_wav = str(DUBBED_DIR / f"dubbed_{video_id}_{language_code}.wav")
    with wave.open(output_wav, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(master_buffer.tobytes())

    # Encode to MP3 for web browser streaming
    output_mp3 = str(DUBBED_DIR / f"dubbed_{video_id}_{language_code}.mp3")
    ffmpeg_exe = get_ffmpeg_binary()
    subprocess.run(
        [ffmpeg_exe, "-y", "-i", output_wav, "-c:a", "libmp3lame", "-b:a", "192k", output_mp3],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True
    )

    lang_name = get_language_name(language_code)

    return {
        "audio_path": output_mp3,
        "wav_path": output_wav,
        "duration_seconds": round(total_seconds, 2),
        "cues_processed": cues_processed,
        "language": language_code,
        "language_name": lang_name,
        "adjustments": timing_adjustments
    }

def export_dubbed_video(video_path: str, dubbed_audio_path: str, output_path: str) -> str:
    """
    Exports a new video file replacing the original audio stream with the dubbed audio track.
    Does NOT modify the original video.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Original video not found: {video_path}")
    if not os.path.exists(dubbed_audio_path):
        raise FileNotFoundError(f"Dubbed audio not found: {dubbed_audio_path}")

    ffmpeg_exe = get_ffmpeg_binary()
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", str(video_path),
        "-i", str(dubbed_audio_path),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        str(output_path)
    ]

    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return output_path
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode("utf-8", errors="replace") if e.stderr else str(e)
        raise RuntimeError(f"FFmpeg video dubbing export failed: {err}")
