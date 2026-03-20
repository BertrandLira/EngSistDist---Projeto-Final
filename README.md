# 🏥 Health-Resilient Agent (POC 4)

**Disciplina:** Engenharia de Sistemas Distribuídos – 2025.2 (UFPB) 
**Equipe:** 

Ana Gabriela, André Soares, Bertrand Lira, Guilherme Muniz, Felipe Lima, Mateus Freitas.


**POC Selecionada:** 4 - IA como Pool (Não Dependência Síncrona) 

---

## 📋 Visão Geral
Este projeto consiste em um assistente inteligente de triagem de saúde e direcionamento para unidades de atendimento (UPAs/SAMU). O diferencial arquitetural é o foco em **resiliência crítica**: o sistema garante que orientações de emergência permaneçam acessíveis mesmo se o provedor de IA (OpenAI) estiver offline.

### Funcionalidades Principais
* **Triagem de Sintomas:** Processamento via GPT-4o-mini.
* **IA como Pool:** Respostas frequentes são pré-geradas e cacheadas no Redis para latência mínima.
* **Fallback de Segurança:** Em caso de falha na IA, o sistema exibe automaticamente dados de um banco estático de unidades de saúde.

---

## 🏗️ Arquitetura (Diagrama C4 - Nível 2)
O sistema é composto pelos seguintes containers:
1. **Web App (Next.js):** Interface do usuário e lógica de API Routes.
2. **Health Pool (Redis):** Armazenamento do pool de respostas e cache-aside.
3. **Safety Storage (JSON):** Base de dados estática de contingência para fallbacks.
4. **AI Gateway (OpenAI API):** Provedor de inteligência assíncrona.

---

## 📜 ADRs (Architecture Decision Records)

### ADR 01: Implementação de Circuit Breaker para Resiliência
* **Contexto:** A dependência síncrona de APIs de IA pode causar indisponibilidade em momentos críticos de saúde.
* **Decisão:** Implementar o padrão **Circuit Breaker**. Se a API de IA falhar ou demorar > 5s, o sistema serve dados do *Safety Storage*.
* **Consequência:** Alta disponibilidade para informações vitais (telefones e endereços de UPAs).

### ADR 02: Estratégia de Pool com Cache-Aside (Redis)
* **Contexto:** Necessidade de reduzir custos e tempo de resposta para perguntas comuns.
* **Decisão:** Utilizar **Redis** para manter um pool de respostas para sintomas recorrentes.
* **Consequência:** Respostas instantâneas e economia de tokens.

---

## 🛠️ Padrões Arquiteturais Aplicados 
1. **Circuit Breaker:** Proteção contra falhas em serviços externos.
2. **Cache-Aside:** Gerenciamento do pool de dados no Redis.
3. **Bulkhead:** Isolamento entre a lógica de IA e o fluxo de informações estáticas.
4. **Retry Pattern:** Tentativas de reconexão automática em falhas transientes.

---

## 💻Stack Tecnológica e Justificativas
1. Computação da API (Motor): AWS Fargate (Serverless). Justificativa: Garante que a API do fluxo crítico do usuário escale instantaneamente em caso de surtos de acessos (ex: picos de viroses na cidade), sem precisarmos gerenciar a infraestrutura subjacente.

2. Modelo de IA: EC2 Autoscaling Group (Instâncias com GPU). Justificativa: Modelos LLM exigem aceleração por hardware (GPU). O Autoscaling permite que as instâncias liguem apenas quando a fila de novos sintomas crescer, otimizando o alto custo financeiro de instâncias com GPU.

3. Banco de Dados Relacional e Fallback: Amazon RDS. Justificativa: Oferece transações ACID e alta confiabilidade para armazenar as localizações geográficas e contatos das unidades de saúde (dados imutáveis de contingência).

4. Cache Inteligente: pg_vector (Busca de Similaridade). Justificativa: Pacientes descrevem dores de formas diferentes ("dor de cabeça forte" vs "enxaqueca intensa"). O pg_vector encontra a similaridade semântica para perguntas repetitivas, aproveitando respostas do pool sem precisar acionar o modelo na EC2.

---

## 🚀 Como Executar
1. Clone o repositório.
2. Crie um arquivo `.env` com sua `OPENAI_API_KEY`.
3. Execute o comando:
   ```bash
   docker-compose up --build
