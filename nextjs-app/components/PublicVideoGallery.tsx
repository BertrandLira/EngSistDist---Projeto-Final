"use client";

import { useCallback, useState } from "react";
import { publicApiUrl } from "@/lib/api";
import { ChallengeCard, type Question } from "./ChallengeCard";

export type VideoListItem = {
  id: string;
  originalName: string;
  createdAt: string;
  hasTranscript: boolean;
  transcriptMode?: string | null;
  transcriptJobStatus?: string | null;
};

type ChallengeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; questions: Question[]; provider?: string };

function TranscriptBadge({ mode, jobStatus }: { mode?: string | null; jobStatus?: string | null }) {
  if (!mode && !jobStatus) return null;

  const modeColor =
    mode === "stub"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : mode === "gemini" || mode === "api" || mode === "local"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

  const statusColor =
    jobStatus === "completed"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : jobStatus === "failed"
      ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
      : jobStatus === "processing"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

  const statusLabel =
    jobStatus === "completed" ? "Transcrito"
    : jobStatus === "failed" ? "Falhou"
    : jobStatus === "processing" ? "Transcrevendo…"
    : jobStatus === "queued" ? "Na fila"
    : jobStatus ?? null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {mode && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${modeColor}`}>
          {mode === "stub" ? "Stub (sem IA)" : `Transcrição: ${mode}`}
        </span>
      )}
      {statusLabel && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColor}`}>
          {statusLabel}
        </span>
      )}
    </div>
  );
}

export function PublicVideoGallery({ videos }: { videos: VideoListItem[] }) {
  const [challenges, setChallenges] = useState<Record<string, ChallengeState>>({});

  const fetchChallenge = useCallback(async (id: string) => {
    setChallenges((prev) => ({ ...prev, [id]: { status: "loading" } }));

    try {
      const res = await fetch(`${publicApiUrl()}/videos/${id}/challenges`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChallenges((prev) => ({
          ...prev,
          [id]: { status: "error", message: data.message ?? `Erro ${res.status}` },
        }));
        return;
      }
      setChallenges((prev) => ({
        ...prev,
        [id]: {
          status: "ok",
          questions: data.questions ?? [],
          provider: data.questions?.[0]?.source ?? data.provider,
        },
      }));
    } catch {
      setChallenges((prev) => ({
        ...prev,
        [id]: { status: "error", message: "Falha de rede" },
      }));
    }
  }, []);

  const onPlay = useCallback(
    (id: string) => {
      const cur = challenges[id];
      if (cur?.status === "ok" || cur?.status === "loading") return;
      void fetchChallenge(id);
    },
    [challenges, fetchChallenge],
  );

  if (!videos.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-8 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-2xl dark:bg-zinc-800">
          🎬
        </div>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Nenhum vídeo ainda</p>
        <p className="mt-1 text-sm text-zinc-500">
          Envie um vídeo na{" "}
          <a href="/advertiser" className="text-zinc-800 underline underline-offset-2 dark:text-zinc-200">
            Área do Anunciante
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-6">
      {videos.map((v) => {
        const state = challenges[v.id] ?? { status: "idle" };
        return (
          <li
            key={v.id}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Card header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-100 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                  {v.originalName}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {new Date(v.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <TranscriptBadge mode={v.transcriptMode} jobStatus={v.transcriptJobStatus} />
            </div>

            {/* Video player */}
            <div className="p-5">
              <video
                controls
                className="aspect-video w-full rounded-xl bg-zinc-950 shadow-inner"
                src={`${publicApiUrl()}/videos/${v.id}/stream`}
                onPlay={() => onPlay(v.id)}
              />

              {/* Challenge area */}
              <div className="mt-4">
                {state.status === "idle" && (
                  <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
                    Dê play para gerar uma pergunta sobre este vídeo
                  </p>
                )}

                {state.status === "loading" && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-500">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-300" />
                    Buscando desafio…
                  </div>
                )}

                {state.status === "error" && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
                    {state.message}
                  </div>
                )}

                {state.status === "ok" && state.questions.length > 0 && (
                  <ChallengeCard
                    questions={state.questions}
                    provider={state.provider}
                    onNewQuestion={() => fetchChallenge(v.id)}
                  />
                )}

                {state.status === "ok" && state.questions.length === 0 && (
                  <p className="text-center text-sm text-zinc-400">
                    Nenhum desafio disponível para este vídeo.
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
