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

export function PublicVideoGallery({ videos }: { videos: VideoListItem[] }) {
  const [challenges, setChallenges] = useState<Record<string, ChallengeState>>(
    {},
  );

  const onPlay = useCallback(async (id: string) => {
    // Evita chamar duas vezes
    setChallenges((prev) => {
      if (prev[id]?.status === "ok" || prev[id]?.status === "loading")
        return prev;
      return { ...prev, [id]: { status: "loading" } };
    });

    try {
      const res = await fetch(`${publicApiUrl()}/videos/${id}/challenges`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChallenges((prev) => ({
          ...prev,
          [id]: {
            status: "error",
            message: data.message ?? `Erro ${res.status}`,
          },
        }));
        return;
      }
      setChallenges((prev) => ({
        ...prev,
        [id]: {
          status: "ok",
          questions: data.questions ?? [],
          provider: data.provider,
        },
      }));
    } catch {
      setChallenges((prev) => ({
        ...prev,
        [id]: { status: "error", message: "Falha de rede" },
      }));
    }
  }, []);

  if (!videos.length) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nenhum vídeo ainda. Envie um na área do anunciante.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-8">
      {videos.map((v) => {
        const state = challenges[v.id] ?? { status: "idle" };
        return (
          <li
            key={v.id}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {v.originalName}
            </p>
            <p className="mb-3 text-xs text-zinc-500">
              {v.id} · transcrição: {v.hasTranscript ? "sim" : "não"}
              {v.transcriptJobStatus != null && v.transcriptJobStatus !== "" && (
                <>
                  {" "}
                  · job: {v.transcriptJobStatus}
                </>
              )}
              {v.transcriptMode != null && v.transcriptMode !== "" && (
                <>
                  {" "}
                  · modo:{" "}
                  <span
                    className={
                      v.transcriptMode === "stub"
                        ? "font-medium text-amber-700 dark:text-amber-400"
                        : ""
                    }
                  >
                    {v.transcriptMode}
                  </span>
                  {v.transcriptMode === "stub" && (
                    <span className="text-zinc-400">
                      {" "}
                      (texto de exemplo; use{" "}
                      <code className="text-[10px]">gemini</code>,{" "}
                      <code className="text-[10px]">local</code> ou{" "}
                      <code className="text-[10px]">api</code> no worker)
                    </span>
                  )}
                </>
              )}
            </p>
            <video
              controls
              className="aspect-video w-full max-w-2xl rounded-md bg-black"
              src={`${publicApiUrl()}/videos/${v.id}/stream`}
              onPlay={() => onPlay(v.id)}
            />

            {/* Challenge display */}
            {state.status === "loading" && (
              <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
                Gerando desafios…
              </div>
            )}
            {state.status === "error" && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                {state.message}
              </div>
            )}
            {state.status === "ok" && state.questions.length > 0 && (
              <ChallengeCard
                questions={state.questions}
                provider={state.provider}
              />
            )}
            {state.status === "ok" && state.questions.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">
                Nenhum desafio gerado para este vídeo.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
