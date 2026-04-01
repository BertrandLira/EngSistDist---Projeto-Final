-- =============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------
-- Tabela: videos
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_name   VARCHAR(512)  NOT NULL,
    mime_type       VARCHAR(128)  NOT NULL DEFAULT 'video/mp4',
    relative_path   VARCHAR(1024) NOT NULL,
    transcript        TEXT,
    scene_description TEXT,
    transcript_mode VARCHAR(16),
    transcript_generated_at TIMESTAMPTZ,
    transcript_generation_log JSONB DEFAULT '[]'::jsonb,
    transcript_job_status VARCHAR(16),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- Tabela: challenges  (pool de desafios gerados)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS challenges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id        UUID          NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    prompt          TEXT          NOT NULL,
    options         JSONB,                           -- alternativas, se houver
    answer          TEXT,                             -- resposta correta
    embedding       vector,                              -- embedding (1536 OpenAI / 3072 Gemini)
    source          VARCHAR(16)   NOT NULL DEFAULT 'ai'
                    CHECK (source IN ('ai', 'static')),
    consumed        BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_video   ON challenges (video_id);
CREATE INDEX IF NOT EXISTS idx_challenges_source  ON challenges (source);

-- -----------------------------------------------
-- Tabela: static_fallback_questions
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS static_fallback_questions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt          TEXT          NOT NULL,
    options         JSONB,
    answer          TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------
-- Seed: perguntas estáticas de fallback
-- -----------------------------------------------
INSERT INTO static_fallback_questions (prompt, options, answer) VALUES
(
    'O que mais chamou a sua atenção no conteúdo apresentado?',
    NULL,
    NULL
),
(
    'Você consegue resumir o vídeo em uma frase?',
    NULL,
    NULL
),
(
    'Quais produtos ou serviços foram mencionados?',
    '["Nenhum", "Um produto específico", "Vários produtos", "Não prestei atenção"]',
    'Um produto específico'
),
(
    'Em uma escala de 1 a 5, quão relevante foi o conteúdo para você?',
    '["1", "2", "3", "4", "5"]',
    NULL
),
(
    'Qual foi a principal mensagem que o anunciante quis transmitir?',
    NULL,
    NULL
),
(
    'Você recomendaria este conteúdo a um amigo?',
    '["Sim", "Não", "Talvez"]',
    NULL
),
(
    'Que tipo de público você acha que este vídeo busca atingir?',
    '["Jovens", "Adultos", "Profissionais", "Todos"]',
    NULL
);

-- -----------------------------------------------
-- Auditoria: geração de perguntas (IA) e entregas
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS ai_question_generation_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id        UUID          NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    provider        VARCHAR(32)   NOT NULL,
    model             VARCHAR(128),
    prompt            TEXT          NOT NULL,
    response_raw      TEXT          NOT NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_qgen_video ON ai_question_generation_logs (video_id);

CREATE TABLE IF NOT EXISTS challenge_delivery_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id            UUID          NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    delivered_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    delivery_source     VARCHAR(16)   NOT NULL
                        CHECK (delivery_source IN ('pool', 'vector', 'static')),
    challenge_id        UUID          REFERENCES challenges(id) ON DELETE SET NULL,
    static_question_id  UUID          REFERENCES static_fallback_questions(id) ON DELETE SET NULL,
    question_snapshot   TEXT          NOT NULL,
    options_snapshot    JSONB,
    answer_snapshot     TEXT
);

CREATE INDEX IF NOT EXISTS idx_delivery_video ON challenge_delivery_events (video_id);
CREATE INDEX IF NOT EXISTS idx_delivery_at ON challenge_delivery_events (delivered_at);
