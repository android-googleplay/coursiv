"use client";

import { Check, ChevronRight } from "lucide-react";
import type { QuizQuestion } from "@/lib/quiz-data";

export function QuestionCard({
  question,
  selected,
  onToggle,
  onContinue,
  isLast,
}: {
  question: QuizQuestion;
  selected: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
  isLast: boolean;
}) {
  return (
    <section className="question-card" key={question.id}>
      <div className="question-copy">
        <span className="eyebrow">{question.eyebrow}</span>
        <h1>{question.title}</h1>
        <p>{question.subtitle}</p>
      </div>

      <div className="option-list" role={question.type === "single" ? "radiogroup" : "group"}>
        {question.options.map((option, index) => {
          const active = selected.includes(option.id);
          return (
            <button
              type="button"
              key={option.id}
              className={`option-card ${active ? "selected" : ""}`}
              onClick={() => onToggle(option.id)}
              role={question.type === "single" ? "radio" : "checkbox"}
              aria-checked={active}
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <span className="option-emoji" aria-hidden="true">{option.emoji}</span>
              <span className="option-copy">
                <strong>{option.label}</strong>
                {option.hint && <small>{option.hint}</small>}
              </span>
              <span className="option-indicator">{active && <Check size={15} strokeWidth={3} />}</span>
            </button>
          );
        })}
      </div>

      <div className="quiz-footer">
        <p>{question.type === "multiple" ? "Choose one or more" : "Choose one answer"}</p>
        <button type="button" className="primary-button" disabled={!selected.length} onClick={onContinue}>
          {isLast ? "Build my plan" : "Continue"}
          <ChevronRight size={19} strokeWidth={2.6} />
        </button>
      </div>
    </section>
  );
}
