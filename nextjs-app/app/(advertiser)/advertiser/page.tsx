import { AdvertiserUpload } from "@/components/AdvertiserUpload";

export default function AdvertiserPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Área do Anunciante
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Envie um vídeo .mp4. O sistema transcreve o áudio e gera desafios de múltipla escolha automaticamente via IA.
        </p>
      </div>

      {/* Steps */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        {[
          { n: "1", label: "Upload do vídeo" },
          { n: "2", label: "Transcrição via IA" },
          { n: "3", label: "Geração de perguntas" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {n}
            </span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
          </div>
        ))}
      </div>

      <AdvertiserUpload />
    </div>
  );
}
