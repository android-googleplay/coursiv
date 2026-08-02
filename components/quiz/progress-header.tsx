"use client";

import { ChevronLeft, Sparkles } from "lucide-react";

export function ProgressHeader({ current, total, onBack }: { current: number; total: number; onBack: () => void }) {
  const progress = ((current + 1) / total) * 100;

  return (
    <header className="progress-header">
      <div className="progress-row">
        <button type="button" className="icon-button" onClick={onBack} aria-label="Go back">
          <ChevronLeft size={21} strokeWidth={2.4} />
        </button>
        <div className="brand-mini"><Sparkles size={15} /> Coursiv</div>
        <span className="step-count">{current + 1}/{total}</span>
      </div>
      <div className="progress-track" aria-label={`Question ${current + 1} of ${total}`}>
        <span className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}
