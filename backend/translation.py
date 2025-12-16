"""
Translation utilities - language detection and reliability checking
"""
from typing import Dict, Tuple


def check_translation_reliability(
    source_text: str, 
    translated_text: str, 
    source_lang: str, 
    target_lang: str
) -> Tuple[bool, str]:
    """
    Check if translation appears reliable by detecting if output is in wrong language
    
    Returns:
        (is_reliable, warning_message)
    """
    if not translated_text or not source_text:
        return True, ""
    
    # If source and target are same, always reliable
    if source_lang.lower() == target_lang.lower():
        return True, ""
    
    # Use language detection on output
    detector = LanguageDetector()
    detected_output = detector.detect(translated_text)
    detected_input = detector.detect(source_text)
    
    # For non-Latin target languages (zh, ja, ko, ar, ru, etc.)
    # Check if output contains expected characters
    non_latin_targets = {'zh', 'ja', 'ko', 'ar', 'ru', 'el', 'he', 'th'}
    
    if target_lang.lower() in non_latin_targets:
        if detected_output != target_lang.lower() and detected_output == detected_input:
            return False, f"Translation may be unreliable - output appears to still be in {source_lang}"
    
    # For Latin targets, harder to detect - check for high similarity
    if target_lang.lower() not in non_latin_targets and source_lang.lower() not in non_latin_targets:
        # Simple check: if output is nearly identical to input, probably didn't translate
        if source_text.strip().lower() == translated_text.strip().lower():
            return False, "Translation may be unreliable - output matches input"
    
    return True, ""


class LanguageDetector:
    """Simple language detection based on character patterns"""
    
    @staticmethod
    def detect(text: str) -> str:
        """
        Detect language from text using character patterns
        
        Returns:
            Language code (en, es, zh, etc.) or "auto"
        """
        if not text or len(text.strip()) < 3:
            return "auto"
        
        # Check for Chinese characters
        if any('\u4e00' <= char <= '\u9fff' for char in text):
            return "zh"
        
        # Check for Japanese characters (Hiragana, Katakana)
        if any('\u3040' <= char <= '\u309f' or '\u30a0' <= char <= '\u30ff' for char in text):
            return "ja"
        
        # Check for Korean characters
        if any('\uac00' <= char <= '\ud7af' for char in text):
            return "ko"
        
        # Check for Arabic characters
        if any('\u0600' <= char <= '\u06ff' for char in text):
            return "ar"
        
        # Check for Cyrillic (Russian)
        if any('\u0400' <= char <= '\u04ff' for char in text):
            return "ru"
        
        # Check for Greek
        if any('\u0370' <= char <= '\u03ff' for char in text):
            return "el"
        
        # Check for Hebrew
        if any('\u0590' <= char <= '\u05ff' for char in text):
            return "he"
        
        # Check for Thai
        if any('\u0e00' <= char <= '\u0e7f' for char in text):
            return "th"
        
        # Default to auto for Latin scripts (will need context to distinguish)
        return "auto"


# Supported languages mapping
SUPPORTED_LANGUAGES = {
    "auto": "Auto-detect",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "ru": "Russian",
    "hi": "Hindi",
    "tr": "Turkish",
    "pl": "Polish",
    "nl": "Dutch",
    "sv": "Swedish",
    "no": "Norwegian",
    "da": "Danish",
    "fi": "Finnish",
    "el": "Greek",
    "he": "Hebrew",
    "th": "Thai",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "ms": "Malay",
    "yo": "Yoruba",      # Nigerian language
    "ig": "Igbo"         # Nigerian language
}


def get_language_name(code: str) -> str:
    """Get language name from code"""
    return SUPPORTED_LANGUAGES.get(code, "Unknown")


# Global instances
language_detector = LanguageDetector()

