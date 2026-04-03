# 🎯 Gerador de Desafios de Retenção (POC 4 - IA como Pool)

**Disciplina:** Engenharia de Sistemas Distribuídos – 2025.2 (UFPB)  
**Equipe:**

Ana Gabriela, André Soares, Bertrand Lira, Guilherme Muniz, Felipe Lima, Mateus Freitas.

---

## [VideoCast](https://canva.link/59rczuawtuhql7c)



## 📋 Visão Geral

Este projeto consiste em um motor de retenção focado em geração de desafios e perguntas sobre conteúdos de vídeos de anunciantes. O diferencial arquitetural é provar que a geração de desafios por Inteligência Artificial pode ser desacoplada do fluxo crítico do usuário. A IA opera em **workers assíncronos**, alimentando um **pool em Redis**; a API NestJS entrega desafios de forma síncrona ao front. Se o pool esgotar ou serviços auxiliares falharem, o sistema recorre a desafios já persistidos no **Postgres** e, por fim, a um **fallback estático** (tabela de perguntas genéricas), garantindo resiliência.

### Funcionalidades Principais

* **Geração assíncrona:** Workers Python (transcrição via fila Redis; refresh do pool via RabbitMQ) geram perguntas com **Gemini ou OpenAI** (`AI_PROVIDER`), persistem no Postgres e empurram o pool no Redis.
* **Consumo em tempo real:** A API consome o pool (FIFO por vídeo). Os desafios incluem **embeddings no Postgres (pgvector)**; a busca avançada por similaridade entre vídeos é evolução planejada (hoje a camada de banco prioriza desafios do vídeo corrente).
* **Fallback de segurança:** Se o Redis estiver indisponível ou vazio e não houver desafio útil no banco, o motor usa perguntas pré-carregadas na tabela de **fallback estático**.

---

## 🏗️ Arquitetura (Diagrama C4)

* [Diagrama Nível 1](Diagrams/DiagramaC4N1.md) 
* [Diagrama Nível 2](Diagrams/DiagramaC4N2.md) 

---

## 📜 ADRs (Architecture Decision Records)

### ADR 01: Desacoplamento da Geração de IA via Pool Assíncrono

* **Contexto:** A geração de perguntas por IA tem alta latência (segundos) e depender dela de forma síncrona degradaria a experiência do usuário (retenção exige rapidez).
* **Decisão:** A IA **não** é chamada no momento em que o usuário pede um desafio. A API NestJS consome primeiro um **pool em Redis** (pré-preenchido). Workers Python mantêm o pool e o banco: após transcrição, geração inicial; quando o pool baixa, **RabbitMQ** dispara novos lotes. O Postgres (com **pgvector**) guarda desafios e embeddings.
* **Consequência:** Latência baixa na entrega ao usuário. Maior complexidade em filas, observabilidade e política de refresh do pool.

### ADR 02: Fallback Estático e Circuit Breaker

* **Contexto:** O pool pode esvaziar, o Redis ou o worker podem falhar, ou a API de IA pode ficar indisponível.
* **Decisão:** Implementar consumo em **cascata**: pool Redis → desafios no **Postgres** para o vídeo → **perguntas estáticas** genéricas. Falhas transitórias no Redis não bloqueiam o fluxo (pula-se para o banco).
* **Consequência:** O sistema continua a exibir desafios; em degradação, menos personalização.

---

## 🛠️ Padrões Arquiteturais Aplicados

1. **ASYNC geração / SYNC consumo:** Separação entre esteira pesada (transcrição, IA, filas) e entrega ao usuário (HTTP via Nest + Next).
2. **Circuit breaker em camadas:** Proteção do fluxo crítico contra esgotamento do pool ou indisponibilidade do Redis, com degradação controlada até ao fallback estático.
3. **Cache-aside (pool Redis) + persistência:** O motor prioriza o pool rápido; o Postgres é a camada seguinte, com embeddings para evolução de busca por similaridade.
4. **Retry pattern:** Reconexão e resiliência nos workers (por exemplo fila RabbitMQ) e healthchecks no Docker Compose.

---

## 💻 Stack Tecnológica e Justificativas

1. **Interface:** **Next.js** (App Router) — áreas **anunciante** e **pública**; consome a API Nest no browser e no servidor conforme variáveis de ambiente.
2. **API principal:** **NestJS** — upload multipart, metadados e transcrição orquestrados com **TypeORM** e **Postgres**, stream de vídeo com suporte a **Range (206)**, endpoint de desafios com circuit breaker e integração Redis / RabbitMQ / worker Python.
3. **Workers:** **Python (FastAPI)** — API HTTP para jobs (`/api/v1`); **consumidor Redis** para transcrição; **consumidor RabbitMQ** para repor o pool de IA; transcrição configurável (`TRANSCRIBE_MODE`: stub, Gemini, Whisper local, API OpenAI).
4. **Dados:** **PostgreSQL (pgvector)** — vídeos, desafios, fallback estático; **Redis** — pool de desafios e fila de transcrição; **RabbitMQ** — mensagens de refresh do pool.
5. **Execução local:** **Docker Compose** — serviços com healthchecks, volume **`video_data`** partilhado entre Nest e workers para os ficheiros `.mp4`.

*Como referência de evolução em nuvem, o desenho da disciplina pode incluir Fargate, RDS e filas gerenciadas; neste repositório a POC corre em contentores locais.*

---

## 🏗️ Divisão de Responsabilidades

Para garantir o domínio de todos os tópicos técnicos exigidos e a participação equitativa no videocast, a equipe foi dividida conforme as camadas da arquitetura distribuída:

| Integrante | Papel Técnico | Atribuição Principal (Inicialmente) |
| :--- | :--- | :--- |
| **Mateus Freitas** | **Backend Lead** | Criar a API e a lógica de fallback |
| **Bertrand Lira** | **IA Engineer** | Integração com APIs de IA (Gemini/OpenAI) para gerar desafios |
| **Felipe Lima** | **Data Engineer** | Banco SQL (Postgres/pgvector), Redis e modelagem de desafios |
| **Guilherme Muniz** | **Middleware Eng** | Filas RabbitMQ e fluxos assíncronos |
| **André Soares** | **DevOps / SRE** | Docker Compose e setup do ambiente |
| **Ana Gabriela Maia** | **QA / Resiliency** | Plano de testes de carga, simulação de falhas de IA e validação do circuit breaker |

---

## 🚀 Como Executar

1. Clone o repositório.
2. Copie [`.env.example`](.env.example) para **`.env`** na raiz e preencha pelo menos **`GEMINI_API_KEY`** e/ou **`OPENAI_API_KEY`**, conforme o `AI_PROVIDER` escolhido. Ajuste **`TRANSCRIBE_MODE`** se for usar transcrição real (local, Gemini ou API).
3. Na raiz do projeto, execute:

   ```bash
   docker compose up --build -d
   ```

   *(Em ambientes mais antigos, o comando pode ser `docker-compose`.)*

4. Abra **`http://localhost:3000`** (Next). A API Nest expõe **`http://localhost:4000`**; gestão RabbitMQ, se necessário, em **`http://localhost:15672`**.

Detalhes de endpoints, fluxos e variáveis: [docs/README.md](docs/README.md).
