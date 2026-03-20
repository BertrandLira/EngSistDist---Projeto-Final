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

## 🚀 Como Executar
1. Clone o repositório.
2. Crie um arquivo `.env` com sua `OPENAI_API_KEY`.
3. Execute o comando:
   ```bash
   docker-compose up --build
