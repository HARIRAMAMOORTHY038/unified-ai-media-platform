import re
from typing import List, Dict, Any

def format_timestamp_srt(seconds: float) -> str:
    """Format seconds float into SRT time string: HH:MM:SS,mmm"""
    if seconds < 0:
        seconds = 0.0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis = 0
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def format_timestamp_vtt(seconds: float) -> str:
    """Format seconds float into WebVTT time string: HH:MM:SS.mmm"""
    if seconds < 0:
        seconds = 0.0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis = 0
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"

def parse_timestamp(timestamp_str: str) -> float:
    """Parse either SRT (00:00:00,000) or VTT (00:00:00.000) timestamp to seconds float."""
    timestamp_str = timestamp_str.strip().replace(",", ".")
    parts = timestamp_str.split(":")
    if len(parts) == 3:
        hrs, mins, secs = parts
        return float(hrs) * 3600 + float(mins) * 60 + float(secs)
    elif len(parts) == 2:
        mins, secs = parts
        return float(mins) * 60 + float(secs)
    return float(timestamp_str)

def generate_srt(cues: List[Any]) -> str:
    """Generate SRT formatted text from a list of cue objects or dictionaries."""
    srt_lines = []
    for idx, cue in enumerate(cues, start=1):
        start = cue.start_time if hasattr(cue, "start_time") else cue["start_time"]
        end = cue.end_time if hasattr(cue, "end_time") else cue["end_time"]
        text = cue.text if hasattr(cue, "text") else cue["text"]

        srt_lines.append(str(idx))
        srt_lines.append(f"{format_timestamp_srt(start)} --> {format_timestamp_srt(end)}")
        srt_lines.append(text.strip())
        srt_lines.append("")
    return "\n".join(srt_lines)

def generate_vtt(cues: List[Any]) -> str:
    """Generate WebVTT formatted text from a list of cue objects or dictionaries."""
    vtt_lines = ["WEBVTT", ""]
    for idx, cue in enumerate(cues, start=1):
        start = cue.start_time if hasattr(cue, "start_time") else cue["start_time"]
        end = cue.end_time if hasattr(cue, "end_time") else cue["end_time"]
        text = cue.text if hasattr(cue, "text") else cue["text"]

        vtt_lines.append(str(idx))
        vtt_lines.append(f"{format_timestamp_vtt(start)} --> {format_timestamp_vtt(end)}")
        vtt_lines.append(text.strip())
        vtt_lines.append("")
    return "\n".join(vtt_lines)

def parse_srt(srt_text: str) -> List[Dict[str, Any]]:
    """Parse SRT string into list of cues."""
    cues = []
    blocks = re.split(r"\n\s*\n", srt_text.strip())
    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if len(lines) >= 2:
            time_line_idx = 0
            # If line 0 is a number index
            if lines[0].isdigit() and len(lines) >= 3:
                time_line_idx = 1

            time_match = re.search(r"(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})", lines[time_line_idx])
            if time_match:
                start_sec = parse_timestamp(time_match.group(1))
                end_sec = parse_timestamp(time_match.group(2))
                text = " ".join(lines[time_line_idx + 1:])
                cues.append({
                    "start_time": start_sec,
                    "end_time": end_sec,
                    "text": text
                })
    return cues
