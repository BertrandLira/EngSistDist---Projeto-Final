## Diagramas C4 Nível 1 — Contexto

Disposição: **duas pessoas na mesma linha** e **sistema + LLM na linha de baixo**, para as setas não se cruzarem tanto no diagrama gerado.

```mermaid
C4Context
title Sistema de desafios — contexto (C4 nível 1)

Person(jogador, "Usuário", "Consome desafios ao assistir vídeos.")
Person(anunciante, "Anunciante", "Envia vídeos e conteúdo para campanhas.")
System(core, "Sistema de desafios", "Pool assíncrono em Redis, fallback estático, circuit breaker na API, armazenamento de vídeo e desafios.")
System_Ext(llm, "API de LLM", "OpenAI ou Gemini; gera perguntas e apoia transcrição.")

Rel(jogador, core, "Consome desafios", "HTTPS")
Rel(anunciante, core, "Envia vídeo", "HTTPS")
Rel(core, llm, "Chama IA", "HTTPS")

UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

Se o teu renderizador **ignorar** `UpdateLayoutConfig` (acontece nalgumas versões do Mermaid), usa a variante em *flowchart* abaixo — mesmo conteúdo C4 nível 1, com layout fixo em T.

```mermaid
flowchart TB
  subgraph topo [Atores]
    direction LR
    jogador["Usuário — consome desafios ao assistir vídeos."]
    anunciante["Anunciante — envia vídeos e conteúdo para campanhas."]
  end
  core["Sistema de desafios — pool Redis, fallback estático, circuit breaker, vídeo e desafios."]
  llm["API de LLM (externo) — OpenAI ou Gemini"]
  jogador -->|"HTTPS — consome desafios"| core
  anunciante -->|"HTTPS — envia vídeo"| core
  core -->|"HTTPS — chama IA"| llm
```
