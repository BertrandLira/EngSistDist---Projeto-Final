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

LINKAR O DIAGRAMA NA PASTA

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

## 🚀 Como Executar
1. Clone o repositório.
2. Crie um arquivo `.env` com sua `OPENAI_API_KEY`.
3. Execute o comando:
   ```bash
   docker-compose up --build
