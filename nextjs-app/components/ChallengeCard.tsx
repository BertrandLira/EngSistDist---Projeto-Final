"use client";

import { useState } from "react";

export type Question = {
  id: string;
  prompt: string;
  options?: string[] | null;
  answer?: string | null;
};

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  pool: { label: "Pool IA", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  vector: { label: "Vetor IA", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  static: { label: "Fallback", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
};

export function ChallengeCard({
  questions,
  provider,
  onNewQuestion,
}: {
  questions: Question[];
  provider?: string;
  onNewQuestion?: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  if (!questions.length) return null;

  const q = questions[current];
  const isRevealed = revealed[current] ?? false;
  const userChoice = selected[current];
  const total = questions.length;

  const sourceInfo = provider ? SOURCE_LABEL[provider] : null;

  const handleSelect = (option: string) => {
    if (isRevealed) return;
    setSelected((prev) => ({ ...prev, [current]: option }));
  };

  const handleReveal = () => {
    setRevealed((prev) => ({ ...prev, [current]: true }));
  };

  const getOptionStyle = (option: string) => {
    const base = "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 flex items-center gap-3 ";

    if (!isRevealed) {
      if (userChoice === option) {
        return base + "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-400 shadow-sm";
      }
      return base + "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 cursor-pointer";
    }

    if (q.answer && option === q.answer) {
      return base + "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-400";
    }
    if (userChoice === option && option !== q.answer) {
      return base + "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-200 dark:border-red-500";
    }
    return base + "border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 opacity-50";
  };

  const getOptionIcon = (option: string, index: number) => {
    const letter = String.fromCharCode(65 + index);
    const base = "flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ";

    if (!isRevealed) {
      if (userChoice === option) {
        return <span className={base + "border-blue-400 bg-blue-100 text-blue-700 dark:border-blue-500 dark:bg-blue-900 dark:text-blue-300"}>{letter}</span>;
      }
      return <span className={base + "border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400"}>{letter}</span>;
    }

    if (q.answer && option === q.answer) {
      return <span className={base + "border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900 dark:text-emerald-300"}>✓</span>;
    }
    if (userChoice === option && option !== q.answer) {
      return <span className={base + "border-red-400 bg-red-100 text-red-600 dark:border-red-500 dark:bg-red-900 dark:text-red-300"}>✗</span>;
    }
    return <span className={base + "border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600"}>{letter}</span>;
  };

  return (
    <div className="mt-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            ?
          </span>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Desafio de Retenção
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sourceInfo && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sourceInfo.color}`}>
              {sourceInfo.label}
            </span>
          )}
          {total > 1 && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {current + 1} / {total}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Question */}
        <p className="mb-5 text-base font-semibold leading-relaxed text-zinc-900 dark:text-zinc-50">
          {q.prompt}
        </p>

        {/* Options */}
        {q.options && q.options.length > 0 ? (
          <div className="mb-5 flex flex-col gap-2">
            {q.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleSelect(option)}
                disabled={isRevealed}
                className={getOptionStyle(option)}
              >
                {getOptionIcon(option, i)}
                <span>{option}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-5 rounded-lg bg-zinc-50 px-4 py-3 text-sm italic text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Pergunta aberta — reflita sobre sua resposta antes de continuar.
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {q.options && userChoice && !isRevealed && (
              <button
                onClick={handleReveal}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Confirmar resposta
              </button>
            )}
            {isRevealed && q.answer && (
              <span className={[
                "flex items-center gap-1.5 text-sm font-semibold",
                userChoice === q.answer
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400",
              ].join(" ")}>
                {userChoice === q.answer ? (
                  <><span className="text-base">✓</span> Correto!</>
                ) : (
                  <><span className="text-base">✗</span> Resposta: {q.answer}</>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Nav buttons */}
            {total > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
                  disabled={current === total - 1}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  →
                </button>
              </div>
            )}

            {/* Nova pergunta */}
            {onNewQuestion && (
              <button
                onClick={onNewQuestion}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                title="Gerar nova pergunta"
              >
                Nova pergunta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
