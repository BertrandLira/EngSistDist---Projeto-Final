"""
Abstração de IA para geração de perguntas.
Suporta OpenAI e Gemini, controlado por AI_PROVIDER no env.
"""

from __future__ import annotations

import json
import logging
import random
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Ângulos de questionamento — sorteados a cada geração para variar o foco
# ---------------------------------------------------------------------------
QUESTION_ANGLES = [
    {
        "name": "factual",
        "instruction": "Foque em FATOS CONCRETOS e informações explicitamente ditas ou mostradas no vídeo (datas, nomes, números, características do produto).",
    },
    {
        "name": "inferencia",
        "instruction": "Foque em INFERÊNCIAS E CONCLUSÕES — o que pode ser deduzido do contexto, mesmo que não dito diretamente? Explore subtextos e implicações.",
    },
    {
        "name": "detalhe",
        "instruction": "Foque em DETALHES ESPECÍFICOS E MINÚCIAS — elementos visuais, sonoros, palavras exatas usadas, ordem dos eventos, detalhes que só quem assistiu com atenção perceberia.",
    },
    {
        "name": "critico",
        "instruction": "Foque em ANÁLISE CRÍTICA — questione as escolhas feitas no vídeo, compare alternativas mencionadas ou implícitas, explore pontos fortes e fracos do que foi apresentado.",
    },
    {
        "name": "opiniao",
        "instruction": "Foque em OPINIÃO E AVALIAÇÃO PESSOAL — peça ao espectador que avalie, julgue ou expresse sua perspectiva sobre o que foi apresentado.",
    },
]

# ---------------------------------------------------------------------------
# Template do prompt — suporta perguntas existentes e ângulo de foco
# ---------------------------------------------------------------------------
QUESTION_PROMPT = """Você é um gerador de desafios de retenção para vídeos publicitários.
Com base na transcrição e/ou descrição de cenas abaixo, gere exatamente {count} perguntas de múltipla escolha sobre o CONTEÚDO DO ANÚNCIO — produto, marca, mensagem, benefícios, público-alvo, cenas e proposta de valor.

FOCO DESTA GERAÇÃO: {angle_instruction}

Transcrição:
{transcript}

Descrição das Cenas:
{scene_description}
{existing_block}
REGRAS OBRIGATÓRIAS:
- As perguntas devem ser sobre o CONTEÚDO DO ANÚNCIO: produto anunciado, benefícios, mensagem central, cenas, situações mostradas, público-alvo, tom e proposta de valor.
- PROIBIDO perguntar sobre: gramática, quantidade de palavras, frases exatas, pontuação, estrutura do texto, duração em segundos, número de cenas ou qualquer característica formal da transcrição.
- Gere perguntas DIFERENTES das já existentes listadas acima (se houver).
- Não repita temas, palavras-chave ou estruturas de perguntas já usadas.
- Aplique rigorosamente o FOCO indicado.
- Cada pergunta deve ter exatamente 4 opções, sendo apenas uma correta.

Responda APENAS com um JSON array no seguinte formato, sem nenhum texto extra:
[
  {{
    "prompt": "texto da pergunta",
    "options": ["opção A", "opção B", "opção C", "opção D"],
    "answer": "opção correta"
  }}
]"""


def _build_existing_block(existing_questions: list[str]) -> str:
    """Formata as perguntas já existentes para inclusão no prompt."""
    if not existing_questions:
        return "\n"
    lines = "\n".join(f"  - {q}" for q in existing_questions)
    return f"\nPerguntas JÁ GERADAS (NÃO repita esses temas):\n{lines}\n\n"


class AIProvider(ABC):
    """Interface para providers de IA."""

    @abstractmethod
    def generate_questions_with_raw(
        self,
        transcript: str,
        scene_description: str,
        count: int = 5,
        existing_questions: list[str] | None = None,
        angle: dict | None = None,
    ) -> tuple[list[dict], str, str]:
        """Retorna (perguntas parseadas, prompt completo, resposta bruta do modelo)."""

    def generate_questions(
        self,
        transcript: str,
        scene_description: str,
        count: int = 5,
        existing_questions: list[str] | None = None,
        angle: dict | None = None,
    ) -> list[dict]:
        questions, _, _ = self.generate_questions_with_raw(
            transcript, scene_description, count, existing_questions, angle
        )
        return questions

    @abstractmethod
    def generate_embedding(self, text: str) -> list[float]:
        ...


class OpenAIProvider(AIProvider):
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.ai_model or "gpt-4o-mini"
        self.embedding_model = "text-embedding-ada-002"

    def generate_questions_with_raw(
        self,
        transcript: str,
        scene_description: str,
        count: int = 5,
        existing_questions: list[str] | None = None,
        angle: dict | None = None,
    ) -> tuple[list[dict], str, str]:
        chosen_angle = angle or random.choice(QUESTION_ANGLES)
        prompt = QUESTION_PROMPT.format(
            count=count,
            angle_instruction=chosen_angle["instruction"],
            transcript=transcript or "(sem transcrição)",
            scene_description=scene_description or "(sem descrição de cenas)",
            existing_block=_build_existing_block(existing_questions or []),
        )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.9,
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
        from google.genai import types
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.types = types
        self.model = settings.ai_model or "gemini-2.5-flash"
        self.embedding_model = "gemini-embedding-001"

    def generate_questions_with_raw(
        self,
        transcript: str,
        scene_description: str,
        count: int = 5,
        existing_questions: list[str] | None = None,
        angle: dict | None = None,
    ) -> tuple[list[dict], str, str]:
        chosen_angle = angle or random.choice(QUESTION_ANGLES)
        prompt = QUESTION_PROMPT.format(
            count=count,
            angle_instruction=chosen_angle["instruction"],
            transcript=transcript or "(sem transcrição)",
            scene_description=scene_description or "(sem descrição de cenas)",
            existing_block=_build_existing_block(existing_questions or []),
        )
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self.types.GenerateContentConfig(temperature=0.9),
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
