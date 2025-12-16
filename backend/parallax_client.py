"""
Parallax Client - Interface for connecting to Parallax distributed AI cluster
"""
import httpx
import time
from typing import Dict, Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ParallaxClient:
    """Client for interacting with Parallax inference engine"""
    
    def __init__(self, base_urls: list = ["http://localhost:3001"]):
        """
        Initialize Parallax client with support for multiple nodes
        
        Args:
            base_urls: List of Base URLs for Parallax scheduler nodes
        """
        # Initialize nodes
        self.nodes = []
        for i, url in enumerate(base_urls):
            self.nodes.append({
                "id": f"node-{i+1}",
                "url": url,
                "name": f"Node {i+1}",
                "status": "unknown",
                "last_check": 0,
                "active_requests": 0
            })
            
        self.current_node_index = 0
        self.timeout = 120.0
        
    @property
    def base_url(self):
        """Return primary node URL for backward compatibility"""
        return self.nodes[0]['url'] if self.nodes else "http://localhost:3001"
        
    @property
    def api_url(self):
        """Return OpenAI-compatible API endpoint"""
        return f"{self.base_url}/v1/chat/completions"
        
    def get_active_node(self):
        """Get next active node using round-robin"""
        # Simple round-robin among online nodes
        start_index = self.current_node_index
        
        while True:
            node = self.nodes[self.current_node_index]
            self.current_node_index = (self.current_node_index + 1) % len(self.nodes)
            
            # In a real scenario, we'd check if node['status'] == 'online'
            # For now, we assume the primary node is always the one to use
            # unless we have real multi-node setup
            if node['status'] != 'offline':
                return node
                
            if self.current_node_index == start_index:
                # All nodes offline, return primary
                return self.nodes[0]

    async def get_cluster_status(self) -> Dict[str, Any]:
        """Get status of all nodes in the cluster"""
        total_nodes = len(self.nodes)
        online_nodes = 0
        
        for node in self.nodes:
            try:
                # Quick health check
                async with httpx.AsyncClient(timeout=2.0) as client:
                    resp = await client.get(f"{node['url']}/v1/models")
                    if resp.status_code == 200:
                        node['status'] = 'online'
                        online_nodes += 1
                        # Mock some load metrics
                        import random
                        node['load'] = random.randint(10, 40)
                    else:
                        node['status'] = 'error'
            except:
                node['status'] = 'offline'
                node['load'] = 0
        
        return {
            "nodes": self.nodes,
            "total_nodes": total_nodes,
            "online_nodes": online_nodes,
            "cluster_health": "healthy" if online_nodes > 0 else "critical"
        }

    def add_node(self, url: str, name: str = None):
        """Add a new node to the cluster"""
        new_id = f"node-{len(self.nodes) + 1}"
        self.nodes.append({
            "id": new_id,
            "url": url,
            "name": name or f"Node {len(self.nodes) + 1}",
            "status": "unknown",
            "last_check": 0,
            "active_requests": 0
        })
        return {"id": new_id, "message": "Node added"}
        
    async def check_health(self) -> Dict[str, Any]:
        """
        Check if Parallax is running and accessible
        
        Returns:
            Dict with status and message
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self.base_url)
                return {
                    "status": "online",
                    "message": "Parallax is running",
                    "code": response.status_code
                }
        except httpx.ConnectError:
            return {
                "status": "offline",
                "message": "Cannot connect to Parallax. Make sure it's running on port 3001.",
                "code": 0
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error checking Parallax: {str(e)}",
                "code": 0
            }
    
    async def translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        max_tokens: int = 512
    ) -> Dict[str, Any]:
        """
        Translate text using Parallax local inference
        
        Args:
            text: Text to translate
            source_lang: Source language name (e.g., "English")
            target_lang: Target language name (e.g., "Spanish")
            max_tokens: Maximum tokens for response
            
        Returns:
            Dict with translation, inference_time_ms, and model info
        """
        start_time = time.time()
        
        # Optimized prompt for fast, accurate translation
        prompt = self._build_translation_prompt(text, source_lang, target_lang)
        
        payload = {
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "system",
                    "content": f"You are a professional {target_lang} translator. Respond only with translations, never explanations."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False,
            "temperature": 0.2,  # Lower temperature for more consistent translations
            "chat_template_kwargs": {
                "enable_thinking": False  # Disable reasoning mode for faster responses
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                
                result = response.json()
                
                # Extract translation from response
                translation = result["choices"][0]["message"]["content"].strip()
                
                # Calculate inference time
                inference_time_ms = int((time.time() - start_time) * 1000)
                
                logger.info(f"Translation completed in {inference_time_ms}ms")
                
                return {
                    "success": True,
                    "translation": translation,
                    "inference_time_ms": inference_time_ms,
                    "model": result.get("model", "unknown"),
                    "source_lang": source_lang,
                    "target_lang": target_lang
                }
                
        except httpx.ConnectError:
            return {
                "success": False,
                "error": "Cannot connect to Parallax. Ensure it's running on port 3001.",
                "inference_time_ms": 0
            }
        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "Translation timed out. Try shorter text or check Parallax performance.",
                "inference_time_ms": int((time.time() - start_time) * 1000)
            }
        except Exception as e:
            logger.error(f"Translation error: {str(e)}")
            return {
                "success": False,
                "error": f"Translation failed: {str(e)}",
                "inference_time_ms": int((time.time() - start_time) * 1000)
            }
    
    def _build_translation_prompt(
        self, 
        text: str, 
        source_lang: str, 
        target_lang: str,
        context_text: Optional[str] = None,
        is_document: bool = False
    ) -> str:
        """
        Build an optimized translation prompt for small models
        
        Uses explicit, structured format that small language models follow reliably
        """
        # Build context section if provided
        context_section = ""
        if context_text:
            context_section = f"\n\nContext from previous translations:\n{context_text}\n"
        
        # Build language-aware instruction
        # Don't say "avoid source language" when they're the same or when translating to common languages
        avoid_source = ""
        if source_lang.lower() != target_lang.lower():
            avoid_source = f"\n- Do NOT include any {source_lang} words in your response"
        
        # Adjust instructions based on mode
        if is_document:
            mode_hint = "Translate this document. Preserve all formatting (paragraphs, lists, etc)."
        else:
            mode_hint = "Translate the text below."
        
        return f"""You are a professional translator. {mode_hint}

From: {source_lang}
To: {target_lang}

Rules:
- Output ONLY the {target_lang} translation
- No explanations or commentary{avoid_source}
- Do not repeat these instructions
{context_section}
Text to translate:
{text}

{target_lang} translation:"""
    
    async def translate_streaming(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        max_tokens: int = 2048,
        context_text: Optional[str] = None,
        is_document: bool = False
    ):
        """
        Stream translation tokens in real-time using SSE
        
        Yields chunks as they're generated by Parallax
        """
        start_time = time.time()
        
        # Adjust max_tokens for documents
        if is_document:
            max_tokens = 4096
        
        # Get active node
        node = self.get_active_node()
        api_url = f"{node['url']}/v1/chat/completions"
        
        prompt = self._build_translation_prompt(text, source_lang, target_lang, context_text, is_document)
        
        payload = {
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "system",
                    "content": f"You are a professional {target_lang} translator. Respond only with translations, never explanations."
                },
                {"role": "user", "content": prompt}
            ],
            "stream": True,  # Enable streaming!
            "temperature": 0.2,
            "chat_template_kwargs": {"enable_thinking": False}
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    api_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    response.raise_for_status()
                    
                    full_translation = ""
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix
                            if data_str == "[DONE]":
                                break
                            
                            try:
                                import json
                                chunk_data = json.loads(data_str)
                                if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                                    delta = chunk_data["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        full_translation += content
                                        yield {
                                            "token": content,
                                            "full_text": full_translation,
                                            "done": False,
                                            "node_id": node['id']
                                        }
                            except Exception as e:
                                logger.error(f"Error parsing chunk: {e}")
                    
                    # Final chunk with timing
                    inference_time_ms = int((time.time() - start_time) * 1000)
                    yield {
                        "token": "",
                        "full_text": full_translation,
                        "done": True,
                        "inference_time_ms": inference_time_ms,
                        "node_id": node['id'],
                        "node_name": node['name']
                    }
                    
        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            yield {
                "error": str(e),
                "done": True
            }


# Global client instance
parallax_client = ParallaxClient()
