import logging
from typing import List, Dict, Any
from deep_translator import MyMemoryTranslator, GoogleTranslator
from .config import SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

# Map 2-letter ISO codes to MyMemory locale codes
LOCALE_MAP = {
    "en": "en-US",
    "es": "es-ES",
    "fr": "fr-FR",
    "de": "de-DE",
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "ml": "ml-IN",
    "kn": "kn-IN",
    "mr": "mr-IN",
    "bn": "bn-IN",
    "zh-cn": "zh-CN",
    "zh": "zh-CN",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "ar": "ar-SA",
    "ru": "ru-RU",
    "pt": "pt-PT",
    "it": "it-IT",
    "nl": "nl-NL",
    "ur": "ur-PK"
}

def get_language_name(code: str) -> str:
    code_clean = code.lower().strip()
    for lang in SUPPORTED_LANGUAGES:
        if lang["code"].lower() == code_clean:
            return lang["name"]
    return code.upper()

def get_locale_code(code: str) -> str:
    code_clean = code.lower().strip()
    return LOCALE_MAP.get(code_clean, LOCALE_MAP.get(code_clean[:2], "es-ES"))

def translate_single_text(text: str, source_lang: str, target_lang: str) -> str:
    """Translate single piece of text with robust multi-service fallback."""
    if not text.strip():
        return text

    source_locale = get_locale_code(source_lang) if source_lang and source_lang != "auto" else "en-US"
    target_locale = get_locale_code(target_lang)

    # Strategy 1: MyMemoryTranslator
    try:
        translated = MyMemoryTranslator(source=source_locale, target=target_locale).translate(text)
        if translated and translated.strip():
            return translated.strip()
    except Exception as e:
        logger.warning(f"MyMemory failed for '{text[:20]}...': {e}")

    # Strategy 2: GoogleTranslator fallback
    try:
        translated = GoogleTranslator(source=source_lang if source_lang else "auto", target=target_lang[:2]).translate(text)
        if translated and translated.strip():
            return translated.strip()
    except Exception as e:
        logger.warning(f"GoogleTranslator fallback failed: {e}")

    # Fallback to original text if offline or limit reached
    return text

def translate_cues(
    cues: List[Dict[str, Any]],
    target_language: str,
    source_language: str = "auto"
) -> List[Dict[str, Any]]:
    """
    Translates a list of caption cues into the target language.
    Preserves exact start_time, end_time, and cue_index.
    """
    if not cues:
        return []

    translated_cues: List[Dict[str, Any]] = []

    for idx, cue in enumerate(cues, start=1):
        original_text = cue.get("text", "")
        translated_text = translate_single_text(original_text, source_language, target_language)

        translated_cues.append({
            "cue_index": idx,
            "start_time": cue.get("start_time", 0.0),
            "end_time": cue.get("end_time", 0.0),
            "text": translated_text,
            "speaker": cue.get("speaker")
        })

    return translated_cues
