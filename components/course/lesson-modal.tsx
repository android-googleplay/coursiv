"use client";

import { useEffect } from "react";
import { BookOpen, FileText, RotateCcw, Volume2, X } from "lucide-react";
import { ButtonText } from "../member/button-text";

export function LessonModal({ courseTitle, lessonTitle, onClose, onRead, onListen, onRestart, restarting=false, restartError="" }: { courseTitle: string; lessonTitle: string; onClose: () => void; onRead: () => void; onListen: () => void; onRestart?: () => void; restarting?: boolean; restartError?: string }) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="lesson-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close lesson options"><X size={20} /></button>
        <span className="modal-course"><BookOpen size={14} /> {courseTitle}</span>
        <h2 id="lesson-modal-title">{lessonTitle}</h2>
        <p>Learn the idea, apply a simple framework, and complete a practical exercise.</p>
        <div className="lesson-actions">
          <button type="button" onClick={onRead}><FileText size={23} /> <ButtonText>Read</ButtonText></button>
          <button type="button" onClick={onListen}><Volume2 size={25} fill="currentColor" /> <ButtonText>Listen</ButtonText></button>
          {onRestart&&<button className="lesson-restart-button" type="button" disabled={restarting} onClick={onRestart}><RotateCcw size={21} /> <ButtonText>{restarting?"Restarting…":"Restart lesson"}</ButtonText></button>}
        </div>
        {restartError&&<p className="lesson-restart-error" role="alert">{restartError}</p>}
      </section>
    </div>
  );
}
