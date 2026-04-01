-- Estatísticas, auditoria de transcrição e entregas de desafios
-- Aplicar em bases já existentes (uma instrução ALTER por coluna = compatível com mais versões do Postgres).

ALTER TABLE videos ADD COLUMN IF NOT EXISTS scene_description TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_mode VARCHAR(16);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_generated_at TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_generation_log JSONB DEFAULT '[]'::jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_job_status VARCHAR(16);

UPDATE videos SET transcript_job_status = 'completed' WHERE transcript IS NOT NULL AND transcript_job_status IS NULL;

CREATE TABLE IF NOT EXISTS ai_question_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  model VARCHAR(128),
  prompt TEXT NOT NULL,
  response_raw TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_qgen_video ON ai_question_generation_logs (video_id);
CREATE INDEX IF NOT EXISTS idx_ai_qgen_created ON ai_question_generation_logs (created_at);

CREATE TABLE IF NOT EXISTS challenge_delivery_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_source VARCHAR(16) NOT NULL CHECK (delivery_source IN ('pool', 'vector', 'static')),
  challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
  static_question_id UUID REFERENCES static_fallback_questions(id) ON DELETE SET NULL,
  question_snapshot TEXT NOT NULL,
  options_snapshot JSONB,
  answer_snapshot TEXT
);

CREATE INDEX IF NOT EXISTS idx_delivery_video ON challenge_delivery_events (video_id);
CREATE INDEX IF NOT EXISTS idx_delivery_at ON challenge_delivery_events (delivered_at);
