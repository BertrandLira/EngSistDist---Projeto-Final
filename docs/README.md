# Implementação local: Next.js, NestJS, FastAPI e Docker

Este documento descreve **o que foi construído** no repositório para a POC de ambiente (docker-compose), alinhado ao plano de arquitetura com **duas áreas no Next**, **API principal no Nest**, **worker em FastAPI**, volume compartilhado para `.mp4` e **streaming do vídeo pela API**.

O [README principal](../README.md) na raiz continua sendo a visão da disciplina, equipe e ADRs em nível de produto.

---

## O que foi feito

### Contêineres e portas

| Serviço | Pasta | Porta | Função |
|--------|--------|-------|--------|
| `nextjs-web` | `nextjs-app/` | 3000 | Interface: área **anunciante** (`/advertiser`) e **pública** (`/public`); chama a API Nest no browser (`NEXT_PUBLIC_API_URL`) e, no servidor, usa `INTERNAL_API_URL` para listar vídeos. |
| `nestjs-api` | `nestjs-api/` | 4000 | API principal: upload multipart, **persistência em Postgres via TypeORM**, gravação no volume `video_data`, **stream HTTP** com suporte a `Range` (206), proxy de desafios ao worker. |
| `fastapi-worker` | `python-worker/` | 8000 | Worker IA: transcrição (stub), **geração real de perguntas via Gemini/OpenAI**, **geração de embeddings** e **persistência no pgvector**. |
| `db` | — | 5432 | PostgreSQL com **pgvector** — schema com tabelas `videos`, `challenges` (pool IA) e `static_fallback_questions` (fallback). |
| `cache` | — | 6379 | Redis (preparado para cache-aside — ainda não integrado). |

### Persistência Postgres

O schema é criado automaticamente pelo `init.sql` na primeira subida do container:

| Tabela | Função |
|--------|--------|
| `videos` | Metadados dos vídeos: nome, caminho, `transcript`, `scene_description` |
| `challenges` | Pool de desafios gerados pela IA, com embeddings vetoriais (`vector`) para busca por similaridade |
| `static_fallback_questions` | 8 perguntas genéricas pré-populadas para uso como fallback quando a IA estiver indisponível |

- **NestJS** usa TypeORM com entidades `Video`, `Challenge` e `StaticFallbackQuestion`
- `VideosService` persiste via `Repository<Video>` (substituiu o `Map` em memória)
- Volume `pgdata` garante que dados sobrevivem a restarts

### Geração de Desafios por IA

O worker suporta **dois providers**, controlados pela variável `AI_PROVIDER`:

| Provider | Modelo padrão | Embedding | Dimensões |
|----------|--------------|-----------|-----------|
| `gemini` | `gemini-2.5-flash` | `gemini-embedding-001` | 3072 |
| `openai` | `gpt-4o-mini` | `text-embedding-ada-002` | 1536 |

Fluxo do endpoint `/jobs/questions`:
1. Lê `transcript` e `scene_description` do vídeo no Postgres
2. Monta prompt e chama o LLM para gerar perguntas de múltipla escolha
3. Gera embeddings para cada pergunta
4. Persiste tudo na tabela `challenges` com vetores pgvector

### Volume compartilhado

- Nome: **`video_data`**.
- **Nest:** montado em `/app/uploads` — escrita no upload e leitura para **`GET /videos/:id/stream`**.
- **Worker:** montado em `/app/media` — mesmo conteúdo; Nest e worker usam o **mesmo arquivo** por caminho relativo (`uuid.mp4`).

O **Next não monta** o volume de vídeos; o browser consome o stream via URL pública da Nest.

### Fluxos implementados

1. **Anunciante:** formulário em `/advertiser` envia `POST /videos/upload` (multipart) para a Nest; arquivo salvo no volume e metadados persistidos no Postgres; Nest chama o worker para transcrição (stub).
2. **Público:** `/public` lista `GET /videos` (SSR usando `INTERNAL_API_URL`). Cada item usa `<video src=...>` apontando para o stream da Nest. No **play**, o cliente chama `POST /videos/:id/challenges`, que repassa ao worker para gerar perguntas reais via IA; o resultado é exibido em **cards interativos** com opções clicáveis, feedback de acerto/erro e navegação entre perguntas.

### Endpoints Nest (resumo)

- `GET /health`
- `POST /videos/upload` — campo `file`
- `GET /videos` — lista metadados do Postgres
- `GET /videos/:id/stream` — `video/mp4`, `Accept-Ranges`, **206** quando há `Range`
- `POST /videos/:id/challenges` — proxy ao worker

### Endpoints FastAPI (prefixo `/api/v1`)

- `GET /health`
- `POST /jobs/transcribe` — body: `video_id`, `relative_path` (stub)
- `POST /jobs/questions` — body: `video_id`, `relative_path`, `count` — **gera perguntas via IA e salva no banco**

---

## Diagrama do plano (containers e fluxos)

```mermaid
flowchart TB
  subgraph browser [Browser]
    Adv[AreaAnuncianteNext]
    Pub[AreaPublicaNext]
  end
  subgraph next [nextjs-app :3000]
    Adv
    Pub
  end
  subgraph nest [nestjs-api :4000]
    Upload[UploadMetadados]
    Orch[OrquestracaoCBCachePool]
  end
  subgraph worker [fastapi-worker :8000]
    Tr[Transcricao]
    Q[GeracaoPerguntas]
  end
  Vol[(video_data)]
  PG[(Postgres_pgvector)]
  Redis[(Redis)]
  Adv -->|multipart_REST| Upload
  Pub -->|REST_lista_e_stream| Orch
  Upload --> Vol
  Upload --> PG
  Tr --> Vol
  Q --> PG
  Orch --> PG
  Orch -->|HTTP_interno| Tr
  Orch -->|HTTP_interno| Q
```

---

## Estrutura de pastas relevante

```
nextjs-app/
  app/(advertiser)/advertiser/   # upload
  app/(public)/public/           # lista + player
  components/                    # AdvertiserUpload, PublicVideoGallery, ChallengeCard, SiteHeader
  lib/api.ts                     # publicApiUrl / serverApiUrl
nestjs-api/
  init.sql                       # schema Postgres + seed fallback
  src/database/                  # DatabaseModule + entidades TypeORM
  src/videos/                    # upload, stream Range, challenges
  src/health/
python-worker/
  app/main.py
  app/api/routes/                # health, jobs
  app/services/                  # ai_service (Gemini/OpenAI), db_client (Postgres)
  app/core/config.py             # MEDIA_ROOT, AI_PROVIDER, API keys, DATABASE_URL
```

---

## Como subir o ambiente

1. Crie um arquivo `.env` na raiz com suas chaves:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=sua-chave
# ou para OpenAI:
# AI_PROVIDER=openai
# OPENAI_API_KEY=sua-chave
```

2. Na raiz do repositório:

```bash
docker compose up --build -d
```

3. Acesse `http://localhost:3000`

---

## Próximos passos

- **Pool assíncrono de desafios:** Worker gerando perguntas em loop contínuo (background), alimentando o pool sem depender do play do usuário.
- **Busca por similaridade vetorial:** API consumindo perguntas do pool via `SELECT ... ORDER BY embedding <=> $1` em vez de chamar o worker sincronamente.
- **Circuit Breaker + Fallback:** Se o pool/IA falhar, retornar perguntas de `static_fallback_questions` automaticamente (ADR 02).
- **Cache-aside com Redis:** Cache de respostas frequentes para reduzir queries ao pgvector.
- **Retry Pattern:** Tentativas automáticas com backoff exponencial em falhas transientes.
- **Transcrição real:** Integração com Whisper (API ou local) para extrair áudio dos vídeos automaticamente.
