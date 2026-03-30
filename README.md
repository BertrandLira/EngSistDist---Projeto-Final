# 🎯 Gerador de Desafios de Retenção (POC 4 - IA como Pool)

**Disciplina:** Engenharia de Sistemas Distribuídos – 2025.2 (UFPB) 
**Equipe:** 

Ana Gabriela, André Soares, Bertrand Lira, Guilherme Muniz, Felipe Lima, Mateus Freitas.

---

## 📋 Visão Geral
Este projeto consiste em um motor de retenção focado em geração de desafios e perguntas sobre conteúdos de vídeos de anunciantes. O diferencial arquitetural é provar que a geração de desafios por Inteligência Artificial pode ser desacoplada do fluxo crítico do usuário. A IA opera alimentando um pool assíncrono e, caso a geração em tempo real falhe ou o pool esgote, o sistema utiliza um banco de dados estático como fallback, garantindo resiliência e disponibilidade contínua.

### Funcionalidades Principais
* **Geração Assíncrona:** Um worker gera continuamente perguntas sobre os vídeos usando o modelo deployado e as armazena no pool.
* **Consumo em Tempo Real e Busca Semântica:** O motor consome os desafios do pool. Para perguntas repetitivas ou vídeos similares, utiliza busca vetorial por similaridade.
* **Fallback de Segurança:** Se o pool esgotar ou a IA ficar indisponível, o motor faz o fallback para perguntas pré-aprovadas no banco estático.

---

## 🏗️ Arquitetura (Diagrama C4)

[Diagrama Nível 1](Diagrams\DiagramaC4N1.pdf)

[Diagrama Nível 2](Diagrams\DiagramaC4N2.pdf)

---

## 📜 ADRs (Architecture Decision Records)

### ADR 01: Desacoplamento da Geração de IA via Pool Assíncrono
* **Contexto:** A geração de perguntas por IA tem alta latência (segundos) e depender dela de forma síncrona degradaria a experiência do usuário (retenção exige rapidez).
* **Decisão:** A IA não será chamada na hora em que o usuário abre o vídeo. A API (Fargate) consumirá perguntas pré-geradas de um pool no banco de dados (pg_vector). O cluster EC2 (GPU) trabalhará de forma assíncrona apenas para manter o pool cheio.
* **Consequência:** Latência mínima para o usuário. Maior complexidade em gerenciar o tamanho do pool e métricas de refresh.

### ADR 02: Fallback Estático e Circuit Breaker
* **Contexto:** Instâncias EC2 com GPU podem falhar, escalar lentamente ou o pool pode secar se o vídeo viralizar de repente.
* **Decisão:** Implementar padrão Circuit Breaker no consumo do pool. Se o pool vetorial estiver vazio ou a API da IA estiver fora, o motor puxa automaticamente perguntas genéricas do banco relacional tradicional (Amazon RDS).
* **Consequência:** O sistema nunca para de exibir desafios (alta disponibilidade do negócio), mas os desafios de fallback podem ser menos personalizados em caso de crise.

---

## 🛠️ Padrões Arquiteturais Aplicados 
1. **ASYNC Geração / SYNC Consumo:** Separação clara entre a esteira pesada de IA (assíncrona) e a entrega para o usuário (síncrona).
2. **Circuit Breaker & Fallback:** Proteção do fluxo crítico do usuário contra falhas do cluster de GPU ou exaustão do pool, acionando o banco RDS estático.
3. **Cache-Aside / Vector Search:** O motor primeiro busca no pg_vector por similaridade (cache de contexto). Se não achar, agenda a criação
4. **Retry Pattern:** Tentativas de reconexão automática em falhas transientes.

---

## 💻Stack Tecnológica e Justificativas
1. **Computação da API (Motor): AWS Fargate (Serverless).** Justificativa: Permite focar na lógica do motor de consumo sem gerenciar servidores, escalando rapidamente em picos de acessos de usuários assistindo aos vídeos.

2. Modelo de IA: EC2 Autoscaling Group (Instâncias com GPU). Justificativa: Modelos LLM exigem aceleração por hardware (GPU). O Autoscaling permite que as instâncias liguem apenas quando a fila de novos sintomas crescer, otimizando o alto custo financeiro de instâncias com GPU.

3. Banco de Dados Relacional e Fallback: Amazon RDS. Justificativa: Garante integridade transacional para os dados estáticos de fallback e configurações dos anunciantes com alta disponibilidade.

4. Cache Inteligente: pg_vector (Busca de Similaridade). Justificativa: Substitui abordagens tradicionais de cache exato. Como as perguntas podem ter variações semânticas, o pg_vector permite recuperar desafios previamente gerados para contextos similares, poupando chamadas caras ao cluster de GPU.

---

## 🏗️ Divisão de Responsabilidades
Para garantir o domínio de todos os tópicos técnicos exigidos e a participação equitativa no videocast, a equipe foi dividida conforme as camadas da arquitetura distribuída:

| Integrante | Papel Técnico | Atribuição Principal (Inicialmente) |
| :--- | :--- | :--- |
| **Mateus Freitas** | **Backend Lead** | Criar a API e a lógica de Fallback  |
| **Bertrand Lira** | **IA Engineer** | Conectar o sistema com o GPT para gerar desafios. |
| **Felipe Lima** | **Data Engineer** | Cuidar do banco SQL e do Cache Redis. |
| **Guilherme Muniz** | **Middleware Eng** |Configurar as filas do RabbitMQ. |
| **André Soares** | **DevOps / SRE** | Fazer o Docker Compose e o setup do ambiente. |
| **Ana Gabriela Maia** | **QA / Resiliency** | Plano de testes de carga, simulação de falhas de IA e validação do Circuit Breaker. |

---

## 🚀 Como Executar

### Pré-requisitos

- Docker e Docker Compose instalados
- Arquivo `.env` na raiz do projeto (veja `.env.example`)

```env
# Provedor de IA: "gemini" ou "openai"
AI_PROVIDER=gemini
GEMINI_API_KEY=sua-chave-aqui
GEMINI_MODEL=gemini-1.5-flash

# Ou, para OpenAI:
# AI_PROVIDER=openai
# OPENAI_API_KEY=sua-chave-aqui
```

### Passo 1 — Subir infraestrutura e preparar banco

```bash
# Sobe banco e cache em background
docker compose up db cache -d

# Aguarda o postgres inicializar (~3s) e cria as tabelas
docker cp nestjs-api/prisma/migrations/20250330000000_init/migration.sql postgres_db:/tmp/migration.sql
docker exec postgres_db psql -U user -d db -f /tmp/migration.sql

# Insere as 8 perguntas estáticas de fallback
docker cp nestjs-api/prisma/seed.sql postgres_db:/tmp/seed.sql 2>/dev/null || \
docker exec postgres_db psql -U user -d db -c "
INSERT INTO \"StaticQuestion\" (id,question,options,answer,category) VALUES
('sq-1','Qual das alternativas melhor descreve o tema central do vídeo?','[\"Inovação tecnológica\",\"História e cultura\",\"Saúde e bem-estar\",\"Finanças pessoais\"]','Inovação tecnológica','general'),
('sq-2','O que você aprendeu de mais relevante neste conteúdo?','[\"Uma nova perspectiva sobre o tema\",\"Dados e estatísticas atualizados\",\"Técnicas práticas aplicáveis\",\"Contexto histórico do assunto\"]','Técnicas práticas aplicáveis','general'),
('sq-3','Como o apresentador estruturou a argumentação principal?','[\"Problema → Solução → Resultado\",\"Histórico → Presente → Futuro\",\"Teoria → Prática → Conclusão\",\"Dados → Análise → Recomendação\"]','Problema → Solução → Resultado','structure'),
('sq-4','Qual é a principal mensagem que o vídeo tenta transmitir?','[\"A importância da educação continuada\",\"O impacto das novas tecnologias\",\"A necessidade de mudança de comportamento\",\"A relevância da colaboração\"]','A importância da educação continuada','comprehension'),
('sq-5','Que evidência o autor usa para sustentar seu argumento?','[\"Estudos de caso e exemplos reais\",\"Pesquisas acadêmicas citadas\",\"Comparações históricas\",\"Testemunhos de especialistas\"]','Estudos de caso e exemplos reais','analysis'),
('sq-6','Qual conceito apresentado no vídeo você considerou mais desafiador?','[\"A definição técnica do tema\",\"As implicações práticas\",\"A relação com outros conceitos\",\"O contexto em que se aplica\"]','As implicações práticas','reflection'),
('sq-7','De que forma o conteúdo do vídeo pode ser aplicado no dia a dia?','[\"Melhorando hábitos de estudo\",\"Otimizando processos de trabalho\",\"Aprimorando relações interpessoais\",\"Desenvolvendo habilidades técnicas\"]','Otimizando processos de trabalho','application'),
('sq-8','Qual foi o momento mais impactante do vídeo?','[\"A revelação de um dado surpreendente\",\"A demonstração prática do conceito\",\"A conclusão e chamada à ação\",\"A apresentação do problema central\"]','A demonstração prática do conceito','engagement')
ON CONFLICT DO NOTHING;"
```

### Passo 2 — Subir todos os serviços

```bash
docker compose up --build -d
```

Aguarde ~15s até os serviços inicializarem. Verifique com:

```bash
curl http://localhost:4000/health   # {"status":"ok"}
curl http://localhost:8000/api/v1/health  # {"status":"ok"}
```

### Passo 3 — Testar o fluxo completo

```bash
# 1. Upload de vídeo
curl -X POST http://localhost:4000/videos/upload \
  -F "file=@algum-video.mp4"
# Salve o "id" retornado:
VIDEO_ID="<id-retornado>"

# 2. Empurrar perguntas no pool
curl -X POST http://localhost:4000/challenges/$VIDEO_ID/questions \
  -H "Content-Type: application/json" \
  -d '{
    "questions": [
      {"question": "O que é X?", "options": ["A","B","C","D"], "answer": "A"},
      {"question": "Como funciona Y?", "options": ["W","X","Y","Z"], "answer": "W"}
    ]
  }'

# 3. Consumir do pool Redis (Camada 1)
curl http://localhost:4000/challenges/$VIDEO_ID
# Retorno esperado → "source": "pool"

# 4. Consumir novamente com pool vazio (Camada 3 — fallback estático)
curl http://localhost:4000/challenges/$VIDEO_ID
curl http://localhost:4000/challenges/$VIDEO_ID
curl http://localhost:4000/challenges/$VIDEO_ID
# Retorno esperado → "source": "static"

# 5. Ver tamanho do pool
curl http://localhost:4000/challenges/$VIDEO_ID/pool-size
```

### Serviços e portas

| Serviço | URL |
| :--- | :--- |
| Frontend (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:4000 |
| Worker IA (FastAPI) | http://localhost:8000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## 🧪 Testes

Os testes unitários rodam em Docker, sem necessidade de banco de dados ou Redis.

### Rodar testes com cobertura

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

O `--build` pode ser omitido nas execuções seguintes se o código não foi alterado:

```bash
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

O container exibe o relatório de cobertura no terminal e encerra automaticamente. O exit code reflete o resultado: `0` para tudo verde, `1` para falhas.

### Suítes existentes

| Arquivo | O que testa |
| :--- | :--- |
| `challenges.service.spec.ts` | Circuit breaker (pool Redis → banco vetorial → fallback estático) |
| `challenges.controller.spec.ts` | Endpoints de desafios |
| `pool.service.spec.ts` | Gestão da fila Redis por vídeo |
| `prisma.service.spec.ts` | Ciclo de vida da conexão com o banco |
| `videos.service.spec.ts` | Upload, listagem e busca de vídeos |
| `app.controller.spec.ts` | Health check da aplicação |
