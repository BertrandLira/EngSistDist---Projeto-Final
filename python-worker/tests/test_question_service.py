"""
Testes unitários para app/services/question_service.py

Cobre: geração e persistência de perguntas com mocks de IA e banco de dados.
"""

import pytest
from unittest.mock import MagicMock, patch


VIDEO_ID = "test-video-uuid-abc"

FAKE_QUESTIONS = [
    {
        "prompt": "O que foi anunciado no vídeo?",
        "options": ["Produto X", "Produto Y", "Produto Z", "Nenhum"],
        "answer": "Produto X",
    }
]

FAKE_EMBEDDING = [0.1] * 1536
FAKE_CHALLENGE_IDS = ["challenge-uuid-1"]


def _make_mock_provider():
    provider = MagicMock()
    provider.generate_questions_with_raw.return_value = (
        FAKE_QUESTIONS,
        "prompt usado",
        "resposta bruta da IA",
    )
    provider.generate_embedding.return_value = FAKE_EMBEDDING
    provider.model = "gpt-4o-mini"
    return provider


class TestGenerateAndSaveQuestions:
    @pytest.fixture(autouse=True)
    def _patch_dependencies(self):
        """Mocka todas as dependências externas."""
        with (
            patch("app.services.question_service.get_ai_provider") as mock_get_provider,
            patch("app.services.question_service.db_client") as mock_db,
            patch("app.services.question_service.settings") as mock_settings,
        ):
            mock_settings.ai_provider = "openai"
            mock_settings.ai_model = "gpt-4o-mini"

            mock_provider = _make_mock_provider()
            mock_get_provider.return_value = mock_provider

            mock_db.get_video.return_value = {
                "transcript": "Transcrição de teste",
                "scene_description": "Cena publicitária",
            }
            mock_db.get_existing_questions.return_value = []
            mock_db.save_challenges.return_value = FAKE_CHALLENGE_IDS
            mock_db.insert_ai_question_generation_log.return_value = None

            self.mock_provider = mock_provider
            self.mock_db = mock_db

            yield

    def test_retorna_lista_de_perguntas_geradas(self):
        from app.services.question_service import generate_and_save_questions

        result = generate_and_save_questions(VIDEO_ID, count=1)

        assert len(result) == 1
        assert result[0]["id"] == FAKE_CHALLENGE_IDS[0]
        assert result[0]["prompt"] == FAKE_QUESTIONS[0]["prompt"]
        assert result[0]["options"] == FAKE_QUESTIONS[0]["options"]
        assert result[0]["answer"] == FAKE_QUESTIONS[0]["answer"]

    def test_chama_ia_com_transcript_e_cena(self):
        from app.services.question_service import generate_and_save_questions

        generate_and_save_questions(VIDEO_ID, count=1)

        call_kwargs = self.mock_provider.generate_questions_with_raw.call_args[1]
        assert call_kwargs["transcript"] == "Transcrição de teste"
        assert call_kwargs["scene_description"] == "Cena publicitária"
        assert call_kwargs["count"] == 1

    def test_salva_challenges_no_banco(self):
        from app.services.question_service import generate_and_save_questions

        generate_and_save_questions(VIDEO_ID, count=1)

        self.mock_db.save_challenges.assert_called_once()
        call_args = self.mock_db.save_challenges.call_args
        assert call_args[0][0] == VIDEO_ID  # primeiro arg = video_id

    def test_gera_embeddings_para_cada_pergunta(self):
        from app.services.question_service import generate_and_save_questions

        generate_and_save_questions(VIDEO_ID, count=1)

        assert self.mock_provider.generate_embedding.call_count == len(FAKE_QUESTIONS)

    def test_registra_log_de_auditoria(self):
        from app.services.question_service import generate_and_save_questions

        generate_and_save_questions(VIDEO_ID, count=1)

        self.mock_db.insert_ai_question_generation_log.assert_called_once()

    def test_usa_contexto_minimo_quando_video_sem_transcript(self):
        """Quando o vídeo não tem transcrição, passa contexto mínimo para a IA."""
        self.mock_db.get_video.return_value = {
            "transcript": "",
            "scene_description": "",
        }

        from app.services.question_service import generate_and_save_questions

        generate_and_save_questions(VIDEO_ID, count=1)

        call_kwargs = self.mock_provider.generate_questions_with_raw.call_args[1]
        assert VIDEO_ID in call_kwargs["transcript"]

    def test_levanta_erro_quando_ia_retorna_zero_perguntas(self):
        self.mock_provider.generate_questions_with_raw.return_value = ([], "", "")

        from app.services.question_service import generate_and_save_questions

        with pytest.raises(ValueError, match="0 perguntas"):
            generate_and_save_questions(VIDEO_ID, count=1)

    def test_continua_sem_transcript_quando_video_nao_existe(self):
        """Se o vídeo não existe no banco, usa contexto mínimo."""
        self.mock_db.get_video.return_value = None

        from app.services.question_service import generate_and_save_questions

        result = generate_and_save_questions(VIDEO_ID, count=1)
        assert len(result) == 1

    def test_passa_perguntas_existentes_ao_prompt(self):
        """Deve buscar perguntas já geradas e repassá-las para o provider."""
        self.mock_db.get_existing_questions.return_value = [
            "O que foi apresentado no vídeo?",
            "Qual o público-alvo do produto?",
        ]

        from app.services.question_service import generate_and_save_questions

        generate_and_save_questions(VIDEO_ID, count=1)

        call_kwargs = self.mock_provider.generate_questions_with_raw.call_args[1]
        existing = call_kwargs.get("existing_questions", [])
        assert len(existing) == 2
        assert "O que foi apresentado no vídeo?" in existing

    def test_sorteia_angulo_valido(self):
        """O ângulo passado ao provider deve ser um dos definidos em QUESTION_ANGLES."""
        from app.services.question_service import generate_and_save_questions
        from app.services.ai_service import QUESTION_ANGLES

        generate_and_save_questions(VIDEO_ID, count=1)

        call_kwargs = self.mock_provider.generate_questions_with_raw.call_args[1]
        angle = call_kwargs.get("angle")
        assert angle is not None
        assert angle in QUESTION_ANGLES

    def test_nao_propaga_erro_de_log_de_auditoria(self):
        """Erro ao persistir log de auditoria não deve quebrar a geração."""
        self.mock_db.insert_ai_question_generation_log.side_effect = Exception("DB down")

        from app.services.question_service import generate_and_save_questions

        result = generate_and_save_questions(VIDEO_ID, count=1)
        assert len(result) == 1
