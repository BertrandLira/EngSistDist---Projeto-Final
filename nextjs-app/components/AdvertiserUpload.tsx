"use client";

import { useEffect, useState } from "react";
import { publicApiUrl } from "@/lib/api";

const POLL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000;

type JobStatus = "queued" | "processing" | "completed" | "failed" | null;

function StatusBar({ status }: { status: JobStatus }) {
  if (!status) return null;

  const config = {
    queued:     { label: "Na fila — aguardando worker…",   color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", dot: "bg-zinc-400 animate-pulse" },
    processing: { label: "Gerando transcrição com IA…",    color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", dot: "bg-blue-500 animate-pulse" },
    completed:  { label: "Transcrição concluída! ✓",       color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", dot: "bg-emerald-500" },
    failed:     { label: "Falha na transcrição.",           color: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400", dot: "bg-red-500" },
  }[status];

  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${config.color}`}>
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${config.dot}`} />
      {config.label}
    </div>
  );
}

export function AdvertiserUpload() {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus>(null);
  const [loading, setLoading] = useState(false);
  const [pollVideoId, setPollVideoId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!pollVideoId) return;

    let alive = true;
    let iv: ReturnType<typeof setInterval> | undefined;

    const run = async () => {
      if (!alive) return;
      try {
        const res = await fetch(`${publicApiUrl()}/videos/${pollVideoId}/transcript-status`);
        if (!res.ok || !alive) return;
        const j = (await res.json()) as { status: JobStatus };
        if (!alive) return;
        setJobStatus(j.status);
        if (j.status === "completed" || j.status === "failed") {
          alive = false;
          if (iv) clearInterval(iv);
        }
      } catch {
        // silently ignore polling errors
      }
    };

    void run();
    iv = setInterval(() => void run(), POLL_MS);
    const to = setTimeout(() => { alive = false; if (iv) clearInterval(iv); }, MAX_WAIT_MS);

    return () => { alive = false; if (iv) clearInterval(iv); clearTimeout(to); };
  }, [pollVideoId]);

  async function submit(file: File) {
    setUploadStatus(null);
    setUploadOk(false);
    setJobStatus(null);
    setPollVideoId(null);
    setFileName(file.name);
    setLoading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${publicApiUrl()}/videos/upload`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { id?: string; transcriptJobStatus?: JobStatus; message?: string };

      if (!res.ok) { setUploadStatus(data.message ?? `Erro ${res.status}`); return; }
      if (!data.id) { setUploadStatus("Resposta inválida da API."); return; }

      setUploadOk(true);
      setUploadStatus(`Vídeo enviado com sucesso · ID: ${data.id.slice(0, 8)}…`);
      setJobStatus(data.transcriptJobStatus ?? null);
      setPollVideoId(data.id);
    } catch {
      setUploadStatus("Falha de rede. A API Nest está rodando em " + publicApiUrl() + "?");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement);
    const file = input.files?.[0];
    if (!file) { setUploadStatus("Selecione um arquivo .mp4."); return; }
    await submit(file);
    (e.currentTarget as HTMLFormElement).reset();
    setFileName(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void submit(file);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition",
          dragOver
            ? "border-zinc-600 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-800"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/60",
        ].join(" ")}
      >
        <span className="text-4xl">{loading ? "⏳" : "📁"}</span>
        <div>
          <p className="font-semibold text-zinc-700 dark:text-zinc-300">
            {loading ? "Enviando…" : fileName ?? "Arraste um vídeo ou clique para selecionar"}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">Apenas arquivos .mp4</p>
        </div>
        <input
          name="file"
          type="file"
          accept="video/mp4,video/*"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "Enviando…" : "Enviar para processamento"}
      </button>

      {uploadStatus && (
        <p className={`rounded-xl px-4 py-3 text-sm font-medium ${uploadOk ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"}`}>
          {uploadStatus}
        </p>
      )}

      {jobStatus && <StatusBar status={jobStatus} />}

      {jobStatus === "completed" && (
        <p className="text-center text-sm text-zinc-500">
          Acesse a{" "}
          <a href="/public" className="font-medium text-zinc-800 underline underline-offset-2 dark:text-zinc-200">
            Área Pública
          </a>{" "}
          para assistir e responder os desafios.
        </p>
      )}
    </form>
  );
}
