"""
Abstração de IA para geração de perguntas.
Suporta OpenAI e Gemini, controlado por AI_PROVIDER no env.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger(__name__)

QUESTION_PROMPT = """Você é um gerador de desafios de retenção para vídeos publicitários.
Com base na transcrição e/ou descrição de cenas abaixo, gere exatamente {count} perguntas de múltipla escolha para testar se o espectador realmente assistiu ao vídeo.

Transcrição:
{transcript}

Descrição das Cenas:
{scene_description}

Responda APENAS com um JSON array no seguinte formato, sem nenhum texto extra:
[
  {{
    "prompt": "texto da pergunta",
    "options": ["opção A", "opção B", "opção C", "opção D"],
    "answer": "opção correta"
  }}
]"""


class AIProvider(ABC):
    """Interface para providers de IA."""

    @abstractmethod
    def generate_questions(
        self,
        transcript: str,
        scene_description: str,
        count: int = 5,
    ) -> list[dict]:
        ...

    @abstractmethod
    def generate_questions_with_raw(
        self,
        transcript: str,
        scene_description: str,
        count: int = 5,
    ) -> tuple[list[dict], str, str]:
        """Retorna (perguntas parseadas, prompt completo, resposta bruta do modelo)."""

    @abstractmethod
    def generate_embedding(self, text: str) -> list[float]:
        ...


class OpenAIProvider(AIProvider):
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.ai_model or "gpt-4o-mini"
        self.embedding_model = "text-embedding-ada-002"

    def generate_questions(self, transcript: str, scene_description: str, count: int = 5) -> list[dict]:
        questions, _, _ = self.generate_questions_with_raw(transcript, scene_description, count)
        return questions

    def generate_questions_with_raw(
        self, transcript: str, scene_description: str, count: int = 5
    ) -> tuple[list[dict], str, str]:
        prompt = QUESTION_PROMPT.format(
            count=count,
            transcript=transcript or "(sem transcrição)",
            scene_description=scene_description or "(sem descrição de cenas)",
        )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        raw = response.choices[0].message.content.strip()
        return _parse_questions_json(raw), prompt, raw

    def generate_embedding(self, text: str) -> list[float]:
        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=text,
        )
        return response.data[0].embedding


class GeminiProvider(AIProvider):
    def __init__(self):
        from google import genai
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.ai_model or "gemini-2.5-flash"
        self.embedding_model = "gemini-embedding-001"
        
    def generate_questions(self, transcript: str, scene_description: str, count: int = 5) -> list[dict]:
        questions, _, _ = self.generate_questions_with_raw(transcript, scene_description, count)
        return questions

    def generate_questions_with_raw(
        self, transcript: str, scene_description: str, count: int = 5
    ) -> tuple[list[dict], str, str]:
        prompt = QUESTION_PROMPT.format(
            count=count,
            transcript=transcript or "(sem transcrição)",
            scene_description=scene_description or "(sem descrição de cenas)",
        )
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
        )
        raw = response.text.strip()
        return _parse_questions_json(raw), prompt, raw

    def generate_embedding(self, text: str) -> list[float]:
        result = self.client.models.embed_content(
            model=self.embedding_model,
            contents=text,
        )
        return result.embeddings[0].values


def _parse_questions_json(raw: str) -> list[dict]:
    """Extrai JSON array da resposta da IA, removendo markdown fences se houver."""
    cleaned = raw
    if cleaned.startswith("```"):
        # Remove ```json ... ```
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        logger.error("Falha ao parsear JSON da IA: %s", raw[:500])
    return []


def get_ai_provider() -> AIProvider:
    """Factory: retorna o provider configurado."""
    provider = settings.ai_provider.lower()
    if provider == "openai":
        return OpenAIProvider()
    elif provider == "gemini":
        return GeminiProvider()
    else:
        raise ValueError(f"AI_PROVIDER inválido: '{provider}'. Use 'openai' ou 'gemini'.")
