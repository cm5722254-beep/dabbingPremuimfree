import os
import json
import time
import random
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config", "gemini_config.json")

class GeminiKeyRouter:
    """
    Advanced Multi-Key Load Balancer & Failover Router for Google Gemini API.
    Supports: Round-Robin, Priority Failover, Quota Tracking, and Automatic Rate Limit Backoff.
    """
    def __init__(self, config_path: str = CONFIG_PATH):
        self.config_path = config_path
        self.api_keys: List[str] = []
        self.model = "gemini-2.0-flash"
        self.current_index = 0
        self.key_stats: Dict[str, Dict[str, Any]] = {}
        self.load_config()

    def load_config(self):
        if not os.path.exists(self.config_path):
            return
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.model = data.get("model", "gemini-2.0-flash")
                keys = data.get("apiKeys", [])
                if not keys and "apiKey" in data:
                    keys = [data["apiKey"]]
                self.api_keys = [k for k in keys if k and len(k) > 10]
                for key in self.api_keys:
                    if key not in self.key_stats:
                        self.key_stats[key] = {
                            "success_count": 0,
                            "error_count": 0,
                            "rate_limit_until": 0,
                            "last_used": 0
                        }
        except Exception as e:
            print(f"[GeminiRouter] Failed to load config: {e}")

    def get_available_key(self) -> Optional[str]:
        now = time.time()
        n = len(self.api_keys)
        if n == 0:
            return None

        for _ in range(n):
            key = self.api_keys[self.current_index]
            self.current_index = (self.current_index + 1) % n
            stats = self.key_stats.get(key, {})
            if stats.get("rate_limit_until", 0) <= now:
                stats["last_used"] = now
                return key

        # If all keys rate-limited, return the one that expires soonest
        soonest_key = min(self.api_keys, key=lambda k: self.key_stats[k].get("rate_limit_until", 0))
        return soonest_key

    def mark_rate_limited(self, key: str, backoff_seconds: int = 60):
        if key in self.key_stats:
            self.key_stats[key]["error_count"] += 1
            self.key_stats[key]["rate_limit_until"] = time.time() + backoff_seconds

    def mark_success(self, key: str):
        if key in self.key_stats:
            self.key_stats[key]["success_count"] += 1
            self.key_stats[key]["rate_limit_until"] = 0

    def generate_content(self, prompt: str, system_instruction: Optional[str] = None, max_retries: int = 4) -> str:
        for attempt in range(max_retries):
            key = self.get_available_key()
            if not key:
                raise RuntimeError("No Gemini API keys configured or available.")

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={key}"
            
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "topP": 0.95,
                    "maxOutputTokens": 8192
                }
            }
            if system_instruction:
                payload["systemInstruction"] = {
                    "parts": [{"text": system_instruction}]
                }

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

            try:
                with urllib.request.urlopen(req, timeout=45) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    candidates = res_body.get("candidates", [])
                    if candidates:
                        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        self.mark_success(key)
                        return text
            except urllib.error.HTTPError as e:
                status = e.code
                error_content = e.read().decode("utf-8", errors="ignore")
                print(f"[GeminiRouter] HTTP {status} on key ...{key[-6:]}: {error_content[:150]}")
                if status in (429, 503):
                    self.mark_rate_limited(key, backoff_seconds=45)
                    time.sleep(1)
                    continue
                elif status == 400:
                    raise RuntimeError(f"Gemini API Bad Request: {error_content}")
            except Exception as e:
                print(f"[GeminiRouter] Network error: {e}")
                time.sleep(1)

        raise RuntimeError(f"Failed to generate content after {max_retries} attempts across API keys.")

    def get_pool_status(self) -> Dict[str, Any]:
        now = time.time()
        active = sum(1 for k in self.api_keys if self.key_stats.get(k, {}).get("rate_limit_until", 0) <= now)
        return {
            "total_keys": len(self.api_keys),
            "active_keys": active,
            "rate_limited": len(self.api_keys) - active,
            "model": self.model,
            "keys_summary": [
                {
                    "masked_key": f"***{k[-6:]}",
                    "success": self.key_stats.get(k, {}).get("success_count", 0),
                    "errors": self.key_stats.get(k, {}).get("error_count", 0),
                    "is_ready": self.key_stats.get(k, {}).get("rate_limit_until", 0) <= now
                }
                for k in self.api_keys
            ]
        }

# Global singleton router
router_instance = GeminiKeyRouter()

