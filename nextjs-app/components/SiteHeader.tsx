"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/advertiser", label: "Anunciante" },
  { href: "/public", label: "Público" },
  { href: "/estatisticas", label: "Estatísticas" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-0">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            Q
          </span>
          <span className="hidden text-sm font-semibold text-zinc-900 dark:text-zinc-50 sm:block">
            Desafios de Retenção
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-stretch gap-1">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={[
                  "relative flex items-center px-3 py-4 text-sm font-medium transition-colors",
                  active
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
                ].join(" ")}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-zinc-900 dark:bg-zinc-50" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
