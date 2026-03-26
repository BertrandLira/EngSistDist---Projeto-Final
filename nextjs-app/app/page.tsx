import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Gerador de desafios de retenção
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          POC: front Next.js, API NestJS, worker FastAPI. Escolha a área:
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/advertiser"
          className="rounded-lg border border-zinc-300 bg-white px-5 py-4 text-center font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Área do anunciante
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            Upload de vídeo (.mp4)
          </span>
        </Link>
        <Link
          href="/public"
          className="rounded-lg border border-zinc-300 bg-white px-5 py-4 text-center font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Área pública
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            Assistir e gerar perguntas ao dar play
          </span>
        </Link>
      </div>
    </div>
  );
}
