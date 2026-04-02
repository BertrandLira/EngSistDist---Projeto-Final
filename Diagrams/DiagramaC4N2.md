## Diagramas C4 Nível 2 — Containers

Mesmo modelo que o nível 1: **flowchart TB**, atores em linha, camadas por baixo (front → API → workers → dados), **LLM** ao lado dos workers para reduzir cruzamento de setas.

```mermaid
flowchart TB
  subgraph atores [Atores]
    direction LR
    jogador["Usuário — browser, área pública."]
    anunciante["Anunciante — browser, área de upload."]
  end
  next["nextjs-web — Next.js, UI :3000"]
  nest["nestjs-api — NestJS :4000; upload, stream, circuit breaker; video_data em /app/uploads."]
  subgraph workers_ia [Workers Python — mesma imagem, comandos distintos — e IA externa]
    direction LR
    fastapi["fastapi-worker — HTTP :8000; jobs de IA; video_data em /app/media."]
    transcribe["transcribe-worker — Redis; transcrição e geração inicial."]
    aigen["ai-generation-worker — RabbitMQ; repõe pool."]
    llm["API de LLM (externo) — OpenAI ou Gemini"]
  end
  subgraph dados [Persistência e mensagens]
    direction LR
    pg[("db — PostgreSQL + pgvector; vídeos, desafios, fallback estático.")]
    redis[("cache — Redis; pool LPOP e fila de transcrição.")]
    rmq[("rabbitmq — fila de refresh do pool.")]
  end
  jogador -->|"HTTPS"| next
  anunciante -->|"HTTPS"| next
  next -->|"REST JSON"| nest
  nest -->|"TypeORM"| pg
  nest -->|"pool e jobs"| redis
  nest -->|"publica refresh"| rmq
  nest -->|"proxy jobs"| fastapi
  transcribe -->|"consome / publica jobs"| redis
  transcribe -->|"atualiza vídeos"| pg
  transcribe -->|"transcrição se configurada"| llm
  aigen -->|"consome tarefas"| rmq
  aigen -->|"gera perguntas"| llm
  aigen -->|"grava desafios"| pg
  aigen -->|"empurra pool"| redis
  fastapi -->|"gera perguntas"| llm
  fastapi -->|"lê e grava"| pg
```
