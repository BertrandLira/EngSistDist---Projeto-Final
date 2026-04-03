# Plano de Testes e Estratégia de Validação

Com o objetivo de avaliar o comportamento do sistema sob diferentes condições de uso e falha, foram definidos testes focados em carga, resiliência e tolerância a falhas. Esses testes buscam validar se a arquitetura proposta, baseada na geração de desafios por Inteligência Artificial e no uso de fallback estático, mantém a disponibilidade do sistema mesmo em cenários adversos.

Para a execução dos experimentos foi utilizada a ferramenta de teste de carga k6, que permite simular múltiplos usuários virtuais realizando requisições simultâneas à API do sistema.

O teste foi executado no endpoint responsável pelo consumo de desafios (`POST /videos/{videoId}/challenges`), simulando o comportamento real do usuário ao iniciar a reprodução de um vídeo.

## Arquivos de Teste Criados

Para a realização dos testes, dentro da parta `test`, foram criados dois scripts de carga utilizando o k6:

```
load-test.js
```

Esse arquivo é responsável por simular múltiplos usuários acessando o endpoint responsável pela obtenção de desafios, tanto para o teste de carga simulando o comportamento normal do sistema e quanto para o teste Chaos engineering.

```
dos-test.js
```

Esse script aumenta progressivamente a quantidade de usuários virtuais para simular uma carga extrema sobre o sistema.

## Execução dos Testes

Antes da execução dos testes é necessário iniciar os serviços da aplicação utilizando o Docker.

```bash
docker compose up --build -d
```

## Teste 1 — Teste de Carga

O teste de carga tem como objetivo simular o comportamento do sistema sob uso normal com múltiplos usuários simultâneos.

Para executar o teste:

```bash
k6 run load-test.js
```

Durante o teste são avaliadas métricas como:

tempo de resposta
taxa de erro
número de requisições por segundo

Esse experimento permite verificar se o sistema suporta múltiplos usuários simultaneamente mantendo a disponibilidade do serviço.

## Teste 2 — Chaos Engineering (Falha do Worker de IA)

O objetivo desse teste é validar a resiliência da arquitetura diante da falha do componente responsável pela geração de desafios via Inteligência Artificial.

Durante a execução do teste de carga, o container do worker de IA é interrompido manualmente.

Primeiramente, executar o teste de carga:

```bash
k6 run load-test.js
```

E em seguida, interromper o worker de IA:

```bash
docker stop python_ai_worker
```

Esse experimento permite verificar se o sistema continua respondendo utilizando o fallback estático armazenado no banco de dados, comprovando que a geração de desafios por IA está desacoplada do fluxo crítico da aplicação.

## Teste 3 — Simulação de Ataque DoS

O terceiro experimento consiste em simular um cenário de negação de serviço (DoS), no qual um grande número de usuários tenta acessar o sistema simultaneamente.

Para executar o teste:

```bash
k6 run dos-test.js
```

Nesse experimento o número de usuários virtuais aumenta progressivamente até atingir 1000 usuários simultâneos.

Esse teste permite avaliar:

- limite de capacidade do sistema
- comportamento sob carga extrema
- degradação de desempenho

## Métricas Avaliadas

Durante os experimentos foram observadas as seguintes métricas fornecidas pelo k6:

- http_req_duration — tempo de resposta das requisições
- http_req_failed — taxa de erro das requisições
- http_reqs — número total de requisições realizadas
- vus — número de usuários virtuais simultâneos
- iteration_duration — tempo total de execução de cada requisição simulada

Essas métricas permitem avaliar tanto a performance quanto a resiliência do sistema sob diferentes cenários de carga e falha.

## Resultados do Teste de Carga

| Métrica                      | Resultado   |
| ---------------------------- | ----------- |
| Requisições totais           | 20.119      |
| Taxa de requisições          | 83.56 req/s |
| Usuários virtuais máximos    | 500         |
| Tempo médio de resposta      | 1.92 s      |
| Mediana do tempo de resposta | 1.3 s       |
| Percentil 95                 | 7 s         |
| Percentil 90                 | 3.93 s      |
| Tempo máximo                 | 10.87 s     |
| Taxa de erro (HTTP)          | 0%          |

Os resultados indicam que o sistema conseguiu processar todas as requisições com sucesso, apresentando uma taxa de erro igual a 0%.

Embora o tempo médio de resposta tenha aumentado sob carga, o sistema manteve-se estável e continuou respondendo às requisições, demonstrando capacidade de lidar com múltiplos usuários simultâneos.

## Resultados do Teste de Chaos Engineering

| Métrica                      | Resultado   |
| ---------------------------- | ----------- |
| Requisições totais           | 11.211      |
| Taxa de requisições          | 92.65 req/s |
| Usuários virtuais máximos    | 100         |
| Tempo médio de resposta      | 74.08 ms    |
| Mediana do tempo de resposta | 8.93 ms     |
| Percentil 95                 | 197.94 ms   |
| Percentil 90                 | 72.77 ms    |
| Tempo máximo                 | 15.23 s     |
| Taxa de erro (HTTP)          | 0.02%       |

Mesmo após a interrupção do worker de IA, o sistema continuou respondendo às requisições dos usuários. As requisições passaram a ser atendidas utilizando os desafios previamente armazenados no banco de dados.

Esse comportamento confirma que a geração de desafios por IA está desacoplada do fluxo crítico da aplicação, conforme previsto na arquitetura do sistema.

## Resultados da Simulação de Ataque DoS

| Métrica                      | Resultado    |
| ---------------------------- | ------------ |
| Requisições totais           | 17.952       |
| Taxa de requisições          | 119.66 req/s |
| Usuários virtuais máximos    | 10.000       |
| Tempo médio de resposta      | 17.92 s      |
| Mediana do tempo de resposta | 2.93 s       |
| Percentil 95                 | 59.99 s      |
| Percentil 90                 | 59.99 s      |
| Tempo máximo                 | 60 s         |
| Taxa de erro (HTTP)          | 37.13%       |

Sob carga extrema foi observado um aumento significativo no tempo de resposta do sistema, indicando saturação de recursos. A taxa de erro também aumentou para aproximadamente 37%, demonstrando que parte das requisições não pôde ser processada.

Apesar da degradação de desempenho, o sistema permaneceu parcialmente operacional, continuando a atender uma parcela das requisições recebidas.

Esse comportamento indica degradação progressiva sob carga extrema, característica desejável em sistemas distribuídos resilientes.
