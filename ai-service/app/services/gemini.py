import json
import logging
import time
from typing import Any

import google.generativeai as genai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

from app.config import settings
from app.metrics import llm_call_duration

logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self._model_name = settings.GEMINI_MODEL

    def _build_model(self, system_instruction: str) -> genai.GenerativeModel:
        return genai.GenerativeModel(
            model_name=self._model_name,
            system_instruction=system_instruction,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=30, max=120),
        retry=retry_if_exception_type(Exception),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        agent_name: str = "unknown",
    ) -> Any:
        start = time.time()
        try:
            model = self._build_model(system_prompt)
            response = await model.generate_content_async(user_prompt)
            duration = time.time() - start
            llm_call_duration.labels(agent_name=agent_name).observe(duration)

            text = response.text.strip()
            # Strip markdown code fences if Gemini adds them despite json mode
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"[{agent_name}] Gemini returned non-JSON: {e}")
            raise
        except Exception as e:
            logger.error(f"[{agent_name}] Gemini call failed: {e}")
            raise

    async def check_health(self) -> bool:
        try:
            model = genai.GenerativeModel(self._model_name)
            await model.generate_content_async("ping")
            return True
        except Exception:
            return False


gemini_service = GeminiService()
