import Link from "next/link";

const CARDS = [
  {
    href: "/advertiser",
    icon: "📤",
    title: "Área do Anunciante",
    description: "Faça upload de um vídeo .mp4. O sistema transcreve o áudio e gera perguntas automaticamente via IA.",
    cta: "Enviar vídeo →",
  },
  {
    href: "/public",
    icon: "▶️",
    title: "Área Pública",
    description: "Assista aos vídeos e responda desafios de múltipla escolha gerados pela IA sobre o conteúdo.",
    cta: "Ver vídeos →",
  },
  {
    href: "/estatisticas",
    icon: "📊",
    title: "Estatísticas",
    description: "Auditoria completa: transcrições, prompts enviados para a IA e origem de cada pergunta entregue.",
    cta: "Ver estatísticas →",
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16">
      {/* Hero */}
      <div className="mb-12 text-center">
        <span className="mb-4 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          POC · Engenharia de Sistemas Distribuídos · UFPB 2025.2
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Gerador de Desafios
          <span className="block text-zinc-500 dark:text-zinc-400">de Retenção</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
          A IA gera perguntas sobre vídeos publicitários em background e as entrega instantaneamente via pool assíncrono sem bloquear o usuário.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map(({ href, icon, title, description, cta }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <span className="text-3xl">{icon}</span>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            </div>
            <span className="text-sm font-medium text-zinc-700 transition group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50">
              {cta}
            </span>
          </Link>
        ))}
      </div>

      {/* Architecture summary */}
      <div className="mt-12 rounded-2xl border border-zinc-100 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Arquitetura — Circuit Breaker
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
          {[
            { step: "1", label: "Pool Redis", sub: "resposta imediata", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
            { step: "2", label: "pgvector DB", sub: "busca vetorial", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
            { step: "3", label: "Fallback estático", sub: "sempre disponível", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
          ].map(({ step, label, sub, color }, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex flex-col items-center rounded-xl px-4 py-2.5 text-center ${color}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Camada {step}</span>
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[10px] opacity-70">{sub}</span>
              </div>
              {i < arr.length - 1 && (
                <span className="hidden text-zinc-300 dark:text-zinc-600 sm:block">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
