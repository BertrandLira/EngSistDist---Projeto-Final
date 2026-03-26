"use client";

import { useState } from "react";
import { publicApiUrl } from "@/lib/api";

export function AdvertiserUpload() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.message ?? `Erro ${res.status}`);
        return;
      }
      setStatus(`Enviado. ID: ${data.id}`);
      form.reset();
    } catch {
      setStatus("Falha de rede. A API Nest está rodando em " + publicApiUrl() + "?");
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
    </form>
  );
}
