"""
Translation Caching Layer
Provides in-memory caching with TTL for translation results
"""
import time
import hashlib
from typing import Dict, Optional, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class CachedTranslation:
    """Structure for cached translation data"""
    translation: str
    source_lang: str
    target_lang: str
    model: str
    timestamp: float
    inference_time_ms: int = 0  # 0ms for cached hits


class TranslationCache:
    """
    Simple in-memory LRU-like cache with TTL
    """
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 86400):
        """
        Initialize cache
        
        Args:
            max_size: Maximum number of items to store
            ttl_seconds: Time to live in seconds (default: 24h)
        """
        self.cache: Dict[str, CachedTranslation] = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        
    def _generate_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Generate unique cache key"""
        content = f"{text}:{source_lang}:{target_lang}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, text: str, source_lang: str, target_lang: str) -> Optional[CachedTranslation]:
        """
        Retrieve from cache
        
        Returns:
            CachedTranslation object or None if miss/expired
        """
        key = self._generate_key(text, source_lang, target_lang)
        
        if key in self.cache:
            item = self.cache[key]
            
            # Check TTL
            if time.time() - item.timestamp > self.ttl_seconds:
                del self.cache[key]
                return None
            
            logger.info("Cache HIT")
            return item
            
        return None
    
    def set(
        self, 
        text: str, 
        source_lang: str, 
        target_lang: str,
        translation: str,
        model: str
    ):
        """Add to cache"""
        key = self._generate_key(text, source_lang, target_lang)
        
        # Evict if full (simple approach: clear 10% oldest)
        if len(self.cache) >= self.max_size:
            # Sort by timestamp and remove oldest
            sorted_keys = sorted(self.cache.keys(), key=lambda k: self.cache[k].timestamp)
            for k in sorted_keys[:int(self.max_size * 0.1)]:
                del self.cache[k]
        
        self.cache[key] = CachedTranslation(
            translation=translation,
            source_lang=source_lang,
            target_lang=target_lang,
            model=model,
            timestamp=time.time()
        )
        logger.info(f"Cached translation for key {key[:8]}...")


# Global instance
translation_cache = TranslationCache()
