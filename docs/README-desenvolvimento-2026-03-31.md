# Desenvolvimento — 31 de março de 2026

Este documento resume alterações feitas ao projeto relativamente à **transcrição de vídeo**, **integração com o Gemini**, **fallback para stub** e **visibilidade nas Estatísticas**. O README principal do projeto continua em [`README.md`](./README.md).

## Motivação

- Erros **429 (quota)** na API OpenAI ao usar `TRANSCRIBE_MODE=api` com Whisper.
- Necessidade de transcrever com **Gemini** (reutilizando `GEMINI_API_KEY` já usada nas perguntas).
- Em **qualquer falha** (ffmpeg, Gemini, OpenAI, Whisper local, modo inválido, etc.), gravar **texto de substituição coerente** com o resto do fluxo (perguntas e Estatísticas) e **auditoria** no JSON de transcrição.

## Configuração

| Variável | Função |
|----------|--------|
| `TRANSCRIBE_MODE` | `stub` \| `gemini` \| `local` \| `api` (OpenAI Whisper legado). |
| `GEMINI_API_KEY` | Obrigatória para `gemini` (e para a geração de perguntas com Gemini). |
| `TRANSCRIBE_GEMINI_MODEL` | Opcional; se vazio, o worker usa `AI_MODEL` ou, em último caso, `gemini-2.5-flash`. |
| `OPENAI_API_KEY` | Necessária apenas para `TRANSCRIBE_MODE=api`. |

Detalhes adicionais estão em [`.env.example`](../.env.example) e na secção do transcribe-worker em [`README.md`](./README.md).

## Backend (Python worker)

**Ficheiro principal:** `python-worker/app/services/transcribe_pipeline.py`

- **`transcribe_wav_gemini`:** cliente `google.genai`, upload do WAV (Files API), espera pelo estado do ficheiro, `generate_content` com instrução para transcrever em português (texto simples, sem markdown), limpeza best-effort do ficheiro remoto.
- **`_safe_extract_wav`:** falhas do ffmpeg **não** rebentam o fluxo sem tratamento; alimentam o mesmo caminho de fallback que as APIs.
- **`transcribe_video_file_with_audit`:**
  - Modo **`stub`:** devolve logo transcrição e descrição de cena de **exemplo** (sem chamar APIs).
  - Modos **`gemini` / `local` / `api`:** extrai WAV → tenta transcrever → em sucesso, `transcript_mode` real e `scene_description` não forçada pelo stub.
  - Em **erro:** acrescenta ao log um evento **`fallback_stub`** com `attemptedMode`, `errorType`, `message` (truncada), depois evento **`done`** com `stubSample` / `fallback`; grava na BD **`transcript_mode = stub`** e preenche transcrição + descrição de cena com os constantes de exemplo.

**Constantes de stub** (`STUB_SAMPLE_*`): texto no estilo **voz em off de anúncio genérico** e **descrição de cenas com marcas de tempo**, sem marcas comerciais concretas — úteis como POC quando não há transcrição real ou após falha.

**Config:** `python-worker/app/core/config.py` inclui `transcribe_gemini_model` (`TRANSCRIBE_GEMINI_MODEL`).

## Docker

- O serviço **`transcribe-worker`** no `docker-compose.yml` recebe `GEMINI_API_KEY`, `AI_MODEL` e `TRANSCRIBE_GEMINI_MODEL` conforme necessário para o modo Gemini.

**Nota:** a imagem copia o código no **build**. Após alterar ficheiros Python, é preciso `docker compose build transcribe-worker` (e subir o serviço de novo) para o container usar o código novo. A transcrição já guardada na base de dados **não** muda sozinha; é preciso **reprocessar** o vídeo (novo upload ou novo job, conforme o vosso fluxo).

## Frontend

- **`nextjs-app/app/(stats)/estatisticas/page.tsx`:** se o array JSON `transcriptGenerationLog` contiver um item com `event === "fallback_stub"`, mostra um **aviso** (houve erro e foi usado stub).
- **`nextjs-app/app/(public)/public/page.tsx`** e **`nextjs-app/components/PublicVideoGallery.tsx`:** texto de ajuda alinhado com `gemini`, `local`, `api` e stub genérico.

## Formato de auditoria (exemplo)

No log persistido em `transcript_generation_log`, após falha espera-se algo na linha de:

```json
{
  "event": "fallback_stub",
  "attemptedMode": "gemini",
  "errorType": "RateLimitError",
  "message": "..."
}
```

seguido de um `done` com indicação de stub/fallback, conforme implementação atual.

## Ficheiros tocados (referência)

- `python-worker/app/services/transcribe_pipeline.py`
- `python-worker/app/core/config.py`
- `docker-compose.yml`
- `.env.example`
- `docs/README.md` (documentação geral do projeto)
- `nextjs-app/app/(stats)/estatisticas/page.tsx`
- `nextjs-app/app/(public)/public/page.tsx`
- `nextjs-app/components/PublicVideoGallery.tsx`

---

*Documento gerado para registo do trabalho do dia; não substitui o README principal.*
