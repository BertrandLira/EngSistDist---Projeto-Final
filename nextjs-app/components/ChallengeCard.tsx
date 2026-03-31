"use client";

import { useState } from "react";

export type Question = {
  id: string;
  prompt: string;
  options?: string[] | null;
  answer?: string | null;
};

export function ChallengeCard({
  questions,
  provider,
}: {
  questions: Question[];
  provider?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  if (!questions.length) return null;

  const q = questions[current];
  const isRevealed = revealed[current] ?? false;
  const userChoice = selected[current];

  const handleSelect = (option: string) => {
    if (isRevealed) return;
    setSelected((prev) => ({ ...prev, [current]: option }));
  };

  const handleReveal = () => {
    setRevealed((prev) => ({ ...prev, [current]: true }));
  };

  const getOptionStyle = (option: string) => {
    const base =
      "w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ";

    if (!isRevealed) {
      if (userChoice === option) {
        return base + "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800";
      }
      return base + "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 cursor-pointer";
    }

    // Revealed state
    if (q.answer && option === q.answer) {
      return base + "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-400";
    }
    if (userChoice === option && option !== q.answer) {
      return base + "border-red-400 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300 dark:border-red-500";
    }
    return base + "border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 opacity-60";
  };

  return (
    <div className="mt-4 w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            ?
          </span>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Desafio de Retenção
          </span>
        </div>
        <div className="flex items-center gap-2">
          {provider && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {provider}
            </span>
          )}
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {current + 1}/{questions.length}
          </span>
        </div>
      </div>

      {/* Question */}
      <p className="mb-4 text-base font-medium leading-relaxed text-zinc-900 dark:text-zinc-50">
        {q.prompt}
      </p>

      {/* Options */}
      {q.options && q.options.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          {q.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleSelect(option)}
              className={getOptionStyle(option)}
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px] font-bold opacity-60">
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm italic text-zinc-400 dark:text-zinc-500">
          Pergunta aberta — reflita sobre sua resposta.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {q.options && userChoice && !isRevealed && (
            <button
              onClick={handleReveal}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Confirmar
            </button>
          )}
          {isRevealed && q.answer && (
            <span
              className={
                userChoice === q.answer
                  ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                  : "text-sm font-medium text-red-500 dark:text-red-400"
              }
            >
              {userChoice === q.answer ? "✓ Correto!" : `✗ Resposta: ${q.answer}`}
            </span>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-1">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ←
          </button>
          <button
            onClick={() =>
              setCurrent((c) => Math.min(questions.length - 1, c + 1))
            }
            disabled={current === questions.length - 1}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
