"use client";

import { ArrowRight, RotateCcw, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import { quizQuestions } from "@/lib/quiz-data";
import { useQuiz } from "./quiz-context";
import { ProgressHeader } from "./progress-header";
import { QuestionCard } from "./question-card";

export function QuizExperience() {
  const { stage, currentQuestion, answers, hydrated, startQuiz, toggleAnswer, next, back, reset } = useQuiz();

  if (!hydrated) return <div className="loading-shell"><span /></div>;

  if (stage === "welcome") {
    return (
      <section className="welcome-view">
        <div className="ambient-orb orb-one" />
        <div className="ambient-orb orb-two" />
        <nav className="welcome-nav"><span className="brand-mark"><Sparkles size={18} /> Coursiv</span></nav>
        <div className="welcome-content">
          <div className="rating-pill">
            <span className="stars"><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /></span>
            <span>4.8 on Trustpilot</span>
          </div>
          <span className="welcome-kicker">Your 30-day AI challenge</span>
          <h1>Unlock your <span>AI income</span> potential.</h1>
          <p>Answer a few quick questions and get a personalized roadmap built around your skills, time, and goals.</p>
          <div className="social-proof">
            <div className="avatar-stack"><i>JD</i><i>MK</i><i>AL</i></div>
            <div><strong>84,000+</strong><span>people started their journey</span></div>
          </div>
          <button type="button" className="primary-button hero-button" onClick={startQuiz}>
            Start challenge <ArrowRight size={20} />
          </button>
          <div className="trust-row"><ShieldCheck size={15} /><span>Free quiz</span><i /> <Users size={15} /><span>2 min</span></div>
        </div>
      </section>
    );
  }

  if (stage === "complete") {
    return (
      <section className="complete-view">
        <div className="success-icon"><Sparkles size={30} /></div>
        <span className="eyebrow">Profile complete</span>
        <h1>Your AI growth plan is ready to generate.</h1>
        <p>Next, we’ll connect this result to the email capture and personalized analysis flow.</p>
        <button type="button" className="primary-button" onClick={reset}><RotateCcw size={18} /> Restart quiz</button>
      </section>
    );
  }

  const question = quizQuestions[currentQuestion];
  return (
    <div className="quiz-view">
      <ProgressHeader current={currentQuestion} total={quizQuestions.length} onBack={back} />
      <QuestionCard
        key={question.id}
        question={question}
        selected={answers[question.id] ?? []}
        onToggle={toggleAnswer}
        onContinue={next}
        isLast={currentQuestion === quizQuestions.length - 1}
      />
    </div>
  );
}
