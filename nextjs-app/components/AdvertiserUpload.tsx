"use client";

import { useEffect, useState } from "react";
import { publicApiUrl } from "@/lib/api";

const POLL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000;

function jobStatusLabel(status: string | null): string {
  switch (status) {
    case "queued":
      return "Na fila (aguardando worker)…";
    case "processing":
      return "A gerar transcrição…";
    case "completed":
      return "Transcrição concluída.";
    case "failed":
      return "Falha na transcrição.";
    default:
      return "Estado desconhecido; a sincronizar…";
  }
}

export function AdvertiserUpload() {
  const [status, setStatus] = useState<string | null>(null);
  const [transcriptLine, setTranscriptLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pollVideoId, setPollVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (!pollVideoId) return;

    let alive = true;
    let iv: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      if (!alive) return;
      try {
        const res = await fetch(
          `${publicApiUrl()}/videos/${pollVideoId}/transcript-status`,
        );
        if (!res.ok || !alive) return;
        const j = (await res.json()) as { status: string | null };
        if (!alive) return;
        setTranscriptLine(jobStatusLabel(j.status));
        if (j.status === "completed" || j.status === "failed") {
          alive = false;
          if (iv) clearInterval(iv);
        }
      } catch {
        if (alive) {
          setTranscriptLine("Erro ao consultar o estado da transcrição.");
        }
      }
    };

    void run();
    iv = setInterval(() => void run(), POLL_MS);

    const to = setTimeout(() => {
      alive = false;
      if (iv) clearInterval(iv);
      setTranscriptLine((prev) => {
        if (
          prev?.includes("concluí") ||
          prev?.includes("Concluí") ||
          prev?.includes("Falha")
        ) {
          return prev;
        }
        return `${prev ?? "A aguardar…"} (tempo esgotado — confira transcribe-worker e Redis.)`;
      });
    }, MAX_WAIT_MS);

    return () => {
      alive = false;
      if (iv) clearInterval(iv);
      clearTimeout(to);
    };
  }, [pollVideoId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setTranscriptLine(null);
    setPollVideoId(null);

    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setStatus("Selecione um arquivo .mp4.");
      return;
    }
    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${publicApiUrl()}/videos/upload`, {
        method: "POST",
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        transcriptJobStatus?: string | null;
        message?: string;
      };
      if (!res.ok) {
        setStatus(data.message ?? `Erro ${res.status}`);
        return;
      }
      if (!data.id) {
        setStatus("Resposta inválida da API.");
        return;
      }
      setStatus(`Enviado. ID: ${data.id}`);
      form.reset();
      setTranscriptLine(jobStatusLabel(data.transcriptJobStatus ?? null));
      setPollVideoId(data.id);
    } catch {
      setStatus(
        "Falha de rede. A API Nest está rodando em " + publicApiUrl() + "?",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Vídeo (.mp4)
        <input
          name="file"
          type="file"
          accept="video/mp4,video/*"
          className="mt-1 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Enviando…" : "Enviar para processamento"}
      </button>
      {status ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{status}</p>
      ) : null}
      {transcriptLine ? (
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Transcrição: {transcriptLine}
        </p>
      ) : null}
    </form>
  );
}
