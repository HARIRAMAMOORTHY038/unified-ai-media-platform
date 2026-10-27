
import os
import re
import shutil
import subprocess
from pathlib import Path


def get_ffmpeg_binary() -> str:
    """Find FFmpeg on PATH or use the bundled imageio-ffmpeg binary."""
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        import imageio_ffmpeg

        bundled_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        if bundled_ffmpeg and os.path.exists(bundled_ffmpeg):
            return bundled_ffmpeg
    except Exception:
        pass

    raise RuntimeError(
        "FFmpeg was not found on your system PATH, and the "
        "imageio-ffmpeg binary could not be loaded. "
        "Install FFmpeg or run: pip install imageio-ffmpeg"
    )


def extract_audio_from_video(
    video_path: str, output_audio_path: str
) -> str:
    """
    Extract 16 kHz mono PCM WAV audio from a video.
    This format is suitable for Whisper speech recognition.
    """
    ffmpeg_exe = get_ffmpeg_binary()
    output_path = Path(output_audio_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_path),
    ]

    try:
        subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
        return str(output_path)
    except subprocess.CalledProcessError as e:
        error_message = e.stderr or e.stdout or "Unknown FFmpeg error"
        raise RuntimeError(
            f"FFmpeg audio extraction failed: {error_message}"
        ) from e


def get_media_duration(file_path: str) -> float:
    """
    Get media duration in seconds by parsing FFmpeg's stderr output.
    Returns 0.0 if the duration cannot be determined.
    """
    try:
        ffmpeg_exe = get_ffmpeg_binary()
        cmd = [ffmpeg_exe, "-hide_banner", "-i", str(file_path)]

        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        output = process.stderr or process.stdout or ""

        # Example: Duration: 00:02:15.42
        match = re.search(
            r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)",
            output,
        )

        if match:
            hours, minutes, seconds = match.groups()
            return (
                int(hours) * 3600
                + int(minutes) * 60
                + float(seconds)
            )

    except (OSError, RuntimeError, subprocess.SubprocessError):
        pass

    return 0.0
