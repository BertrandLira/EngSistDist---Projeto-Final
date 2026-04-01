import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3 text-sm font-medium">
        <Link href="/" className="text-zinc-900 dark:text-zinc-50">
          Início
        </Link>
        <Link
          href="/advertiser"
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Anunciante
        </Link>
        <Link
          href="/public"
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Público
        </Link>
        <Link
          href="/estatisticas"
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Estatísticas
        </Link>
      </div>
    </header>
  );
}
