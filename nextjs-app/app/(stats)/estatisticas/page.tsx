import { serverApiUrl } from "@/lib/server-api-url";

type Delivery = {
  id: string;
  deliveredAt: string;
  deliverySource: string;
  challengeId: string | null;
  staticQuestionId: string | null;
  questionSnapshot: string;
  optionsSnapshot: string[] | null;
  answerSnapshot: string | null;
};

type AiLog = {
  id: string;
  createdAt: string;
  provider: string;
  model: string | null;
  prompt: string;
  responseRaw: string;
};

type VideoStat = {
  id: string;
  originalName: string;
  createdAt: string;
  transcript: string | null;
  sceneDescription: string | null;
  transcriptMode: string | null;
  transcriptGeneratedAt: string | null;
  transcriptGenerationLog: unknown;
  transcriptJobStatus: string | null;
  deliveryCount: number;
  deliveries: Delivery[];
  aiGenerationLogs: AiLog[];
};

async function fetchStats(): Promise<{ videos: VideoStat[] }> {
  const res = await fetch(`${serverApiUrl()}/stats/videos`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return { videos: [] };
  }
  return res.json();
}

function sourceLabel(s: string): string {
  if (s === "static") return "Fallback estático";
  if (s === "pool") return "Pool Redis (IA)";
  if (s === "vector") return "Base / vetor (IA)";
  return s;
}

function transcriptJobLabel(s: string | null | undefined): string {
  if (s === "queued") return "Na fila";
  if (s === "processing") return "A gerar";
  if (s === "completed") return "Concluída";
  if (s === "failed") return "Falhou";
  return s || "—";
}

function logHasFallbackStub(log: unknown): boolean {
  if (!Array.isArray(log)) return false;
  return log.some(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      "event" in item &&
      (item as { event: string }).event === "fallback_stub",
  );
}

export default async function EstatisticasPage() {
  const { videos } = await fetchStats();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Estatísticas
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Transcrições, auditoria de geração de perguntas (IA) e cada entrega de
        desafio ao utilizador (circuit breaker).
      </p>

      {videos.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          Nenhum vídeo ou a API não respondeu. Confirme o Nest em{" "}
          <code className="text-xs">{serverApiUrl()}</code>.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-6">
          {videos.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {v.originalName}
                </h2>
                <span className="font-mono text-xs text-zinc-500">{v.id}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Criado: {new Date(v.createdAt).toLocaleString()} · Entregas de
                desafio: {v.deliveryCount} · Job transcrição:{" "}
                {transcriptJobLabel(v.transcriptJobStatus)}
              </p>

              <section className="mt-4">
                <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Transcrição
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Modo: {v.transcriptMode ?? "—"} · Gerada em:{" "}
                  {v.transcriptGeneratedAt
                    ? new Date(v.transcriptGeneratedAt).toLocaleString()
                    : "—"}
                </p>
                {logHasFallbackStub(v.transcriptGenerationLog) ? (
                  <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100">
                    A transcrição automática falhou e foi gravado texto de exemplo (
                    <code className="text-[10px]">transcript_mode=stub</code> no
                    registo). Ver evento{" "}
                    <code className="text-[10px]">fallback_stub</code> no JSON
                    abaixo (tipo de erro e mensagem).
                  </p>
                ) : null}
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {v.transcript?.trim() || "(sem transcript)"}
                </pre>
                {v.transcriptGenerationLog != null &&
                JSON.stringify(v.transcriptGenerationLog) !== "null" &&
                JSON.stringify(v.transcriptGenerationLog) !== "[]" ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-zinc-600">
                      Log de geração do transcript (JSON)
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                      {JSON.stringify(v.transcriptGenerationLog, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </section>

              <section className="mt-4">
                <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Descrição da cena
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {v.transcriptMode === "stub"
                    ? "Stub explícito ou após falha (Gemini/local/OpenAI): descrição de exemplo (POC)."
                    : "Texto usado no prompt da IA junto à transcrição."}
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-100 p-2 text-xs text-zinc-800 whitespace-pre-wrap dark:bg-zinc-900 dark:text-zinc-200">
                  {v.sceneDescription?.trim() || "(sem descrição de cena)"}
                </pre>
              </section>

              <section className="mt-4">
                <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Geração de perguntas (IA) — prompt / resposta
                </h3>
                {v.aiGenerationLogs.length === 0 ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Nenhum registo (ainda não foi chamado /jobs/questions).
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {v.aiGenerationLogs.map((log) => (
                      <li
                        key={log.id}
                        className="rounded border border-zinc-100 p-2 dark:border-zinc-800"
                      >
                        <p className="text-xs text-zinc-500">
                          {new Date(log.createdAt).toLocaleString()} ·{" "}
                          {log.provider} / {log.model ?? "—"}
                        </p>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium">
                            Prompt
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto text-xs">
                            {log.prompt}
                          </pre>
                        </details>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium">
                            Resposta bruta
                          </summary>
                          <pre className="mt-1 max-h-40 overflow-auto text-xs">
                            {log.responseRaw}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-4">
                <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Entregas de desafio (cada pedido)
                </h3>
                {v.deliveries.length === 0 ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Nenhuma entrega registada (ainda sem POST /challenges).
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700">
                          <th className="py-1 pr-2">Quando</th>
                          <th className="py-1 pr-2">Origem</th>
                          <th className="py-1">Pergunta (snapshot)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.deliveries.map((d) => (
                          <tr
                            key={d.id}
                            className="border-b border-zinc-100 dark:border-zinc-800"
                          >
                            <td className="align-top py-2 pr-2 text-zinc-500 whitespace-nowrap">
                              {new Date(d.deliveredAt).toLocaleString()}
                            </td>
                            <td className="align-top py-2 pr-2 whitespace-nowrap">
                              {sourceLabel(d.deliverySource)}
                            </td>
                            <td className="align-top py-2">
                              <span className="line-clamp-2">{d.questionSnapshot}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
