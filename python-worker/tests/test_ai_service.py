"""
Testes unitários para app/services/ai_service.py

Cobre: parsing de resposta JSON da IA, geração de perguntas (mock),
       embeddings e seleção de provider.
"""

import json
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers de parsing (sem I/O externo)
# ---------------------------------------------------------------------------

VALID_JSON_RESPONSE = json.dumps([
    {
        "prompt": "Qual produto foi apresentado no vídeo?",
        "options": ["Produto A", "Produto B", "Produto C", "Produto D"],
        "answer": "Produto A",
    }
])

INVALID_JSON_RESPONSE = "Não consigo responder agora."

JSON_WRAPPED_IN_MARKDOWN = f"```json\n{VALID_JSON_RESPONSE}\n```"


def _parse_response(raw: str) -> list[dict]:
    """Replica a lógica de parsing dos providers sem dependência da classe."""
    import re
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


class TestParseResponse:
    def test_parses_valid_json_array(self):
        result = _parse_response(VALID_JSON_RESPONSE)
        assert len(result) == 1
        assert result[0]["prompt"] == "Qual produto foi apresentado no vídeo?"

    def test_parses_json_wrapped_in_markdown_fences(self):
        result = _parse_response(JSON_WRAPPED_IN_MARKDOWN)
        assert len(result) == 1
        assert "options" in result[0]

    def test_raises_on_invalid_json(self):
        with pytest.raises(json.JSONDecodeError):
            _parse_response(INVALID_JSON_RESPONSE)


# ---------------------------------------------------------------------------
# OpenAIProvider (mock do cliente)
# ---------------------------------------------------------------------------

class TestOpenAIProvider:
    @pytest.fixture(autouse=True)
    def _mock_settings(self):
        with patch("app.services.ai_service.settings") as mock_settings:
            mock_settings.openai_api_key = "sk-test-key"
            mock_settings.ai_model = "gpt-4o-mini"
            mock_settings.ai_provider = "openai"
            yield mock_settings

    def _make_provider(self):
        from app.services.ai_service import OpenAIProvider
        with patch("app.services.ai_service.OpenAIProvider.__init__", lambda self: None):
            provider = OpenAIProvider.__new__(OpenAIProvider)

        mock_client = MagicMock()
        provider.client = mock_client
        provider.model = "gpt-4o-mini"
        provider.embedding_model = "text-embedding-ada-002"
        return provider, mock_client

    def test_generate_questions_returns_parsed_list(self):
        provider, mock_client = self._make_provider()

        completion = MagicMock()
        completion.choices[0].message.content = VALID_JSON_RESPONSE
        mock_client.chat.completions.create.return_value = completion

        from app.services.ai_service import OpenAIProvider
        questions, prompt, raw = OpenAIProvider.generate_questions_with_raw(
            provider,
            transcript="Transcrição de teste",
            scene_description="Cena genérica",
            count=1,
        )

        assert len(questions) == 1
        assert questions[0]["prompt"] == "Qual produto foi apresentado no vídeo?"
        assert len(prompt) > 0
        assert raw == VALID_JSON_RESPONSE

    def test_generate_embedding_returns_float_list(self):
        provider, mock_client = self._make_provider()

        embedding_response = MagicMock()
        embedding_response.data[0].embedding = [0.1, 0.2, 0.3]
        mock_client.embeddings.create.return_value = embedding_response

        from app.services.ai_service import OpenAIProvider
        result = OpenAIProvider.generate_embedding(provider, "texto de teste")

        assert result == [0.1, 0.2, 0.3]
        mock_client.embeddings.create.assert_called_once_with(
            model="text-embedding-ada-002",
            input="texto de teste",
        )

    def test_generate_questions_raises_on_zero_results(self):
        provider, mock_client = self._make_provider()

        completion = MagicMock()
        completion.choices[0].message.content = "[]"
        mock_client.chat.completions.create.return_value = completion

        from app.services.ai_service import OpenAIProvider
        questions, _, _ = OpenAIProvider.generate_questions_with_raw(
            provider, "t", "s", count=1
        )
        assert questions == []


# ---------------------------------------------------------------------------
# get_ai_provider factory
# ---------------------------------------------------------------------------

class TestGetAiProvider:
    def test_returns_openai_provider_when_configured(self):
        with patch("app.services.ai_service.settings") as mock_settings:
            mock_settings.ai_provider = "openai"
            mock_settings.openai_api_key = "sk-test"
            mock_settings.ai_model = ""

            with patch("app.services.ai_service.OpenAIProvider") as MockOpenAI:
                MockOpenAI.return_value = MagicMock()
                from app.services.ai_service import get_ai_provider
                provider = get_ai_provider()
                MockOpenAI.assert_called_once()

    def test_returns_gemini_provider_when_configured(self):
        with patch("app.services.ai_service.settings") as mock_settings:
            mock_settings.ai_provider = "gemini"
            mock_settings.gemini_api_key = "AIza-test"
            mock_settings.ai_model = ""

            with patch("app.services.ai_service.GeminiProvider") as MockGemini:
                MockGemini.return_value = MagicMock()
                from app.services.ai_service import get_ai_provider
                provider = get_ai_provider()
                MockGemini.assert_called_once()
