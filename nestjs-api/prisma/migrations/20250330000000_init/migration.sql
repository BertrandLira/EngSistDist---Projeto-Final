-- ============================================================
-- Migração inicial — habilita pgvector e cria todas as tabelas
-- ============================================================

-- Habilita a extensão pgvector
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable: Video
CREATE TABLE "Video" (
    "id"             TEXT         NOT NULL,
    "storedFilename" TEXT         NOT NULL,
    "originalName"   TEXT         NOT NULL,
    "mimeType"       TEXT         NOT NULL DEFAULT 'video/mp4',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transcript"     TEXT,
    "relativePath"   TEXT         NOT NULL,
    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GeneratedQuestion (pool de perguntas geradas pela IA)
CREATE TABLE "GeneratedQuestion" (
    "id"        TEXT         NOT NULL,
    "videoId"   TEXT         NOT NULL,
    "question"  TEXT         NOT NULL,
    "options"   JSONB        NOT NULL,
    "answer"    TEXT         NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt"    TIMESTAMP(3),
    "inPool"    BOOLEAN      NOT NULL DEFAULT true,
    CONSTRAINT "GeneratedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StaticQuestion (banco estático de fallback)
CREATE TABLE "StaticQuestion" (
    "id"       TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options"  JSONB NOT NULL,
    "answer"   TEXT NOT NULL,
    "category" TEXT DEFAULT 'general',
    CONSTRAINT "StaticQuestion_pkey" PRIMARY KEY ("id")
);

-- Index: busca por videoId
CREATE INDEX "GeneratedQuestion_videoId_idx" ON "GeneratedQuestion"("videoId");

-- Index: IVFFlat para busca por similaridade vetorial (cosine distance)
CREATE INDEX "GeneratedQuestion_embedding_idx"
    ON "GeneratedQuestion" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

-- ForeignKey: GeneratedQuestion -> Video
ALTER TABLE "GeneratedQuestion"
    ADD CONSTRAINT "GeneratedQuestion_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "Video"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
