"use client";

import { useCallback, useState } from "react";
import { publicApiUrl } from "@/lib/api";

export type VideoListItem = {
  id: string;
  originalName: string;
  createdAt: string;
  hasTranscript: boolean;
};

export function PublicVideoGallery({ videos }: { videos: VideoListItem[] }) {
  const [challengeLog, setChallengeLog] = useState<Record<string, string>>({});

  const onPlay = useCallback(async (id: string) => {
    setChallengeLog((prev) => ({ ...prev, [id]: "Solicitando perguntas…" }));
    try {
      const res = await fetch(`${publicApiUrl()}/videos/${id}/challenges`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChallengeLog((prev) => ({
          ...prev,
          [id]: `Erro: ${res.status} ${JSON.stringify(data)}`,
        }));
        return;
      }
      setChallengeLog((prev) => ({
        ...prev,
        [id]: `OK: ${JSON.stringify(data)}`,
      }));
    } catch {
      setChallengeLog((prev) => ({
        ...prev,
        [id]: "Falha de rede ao chamar /challenges",
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
      {videos.map((v) => (
        <li
          key={v.id}
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {v.originalName}
          </p>
          <p className="mb-3 text-xs text-zinc-500">
            {v.id} · transcript: {v.hasTranscript ? "sim" : "não"}
          </p>
          <video
            controls
            className="aspect-video w-full max-w-2xl rounded-md bg-black"
            src={`${publicApiUrl()}/videos/${v.id}/stream`}
            onPlay={() => onPlay(v.id)}
          />
          {challengeLog[v.id] ? (
            <pre className="mt-2 max-w-2xl overflow-x-auto rounded bg-zinc-100 p-2 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {challengeLog[v.id]}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
