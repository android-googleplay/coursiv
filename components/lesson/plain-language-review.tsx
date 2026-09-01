"use client";

import { useMemo,useState } from "react";
import { BookOpen,Check,ChevronDown,RotateCcw } from "lucide-react";
import type { CoursivContentBlock } from "../../lib/coursiv-content";
import { useRetryToQuestion, useScrollToResult } from "../shared/use-scroll-to-result";

export type MatchingBlock = Extract<CoursivContentBlock,{type:"matching-pairs"}>;
type PlainLanguageStage = "quiz"|"complete";
type ScreenAnswer = {blockId:string;values:string[]};

const plainLanguagePrefix=/^白話：\s*/;

export function isPlainLanguageReview(block:MatchingBlock) {
  return block.pairs.length>0&&block.pairs.every((pair)=>plainLanguagePrefix.test(pair.right));
}

function plainLanguageText(value:string) {
  return value.replace(plainLanguagePrefix,"");
}

function stableTextScore(value:string) {
  let score=0;
  for(let index=0;index<value.length;index+=1)score=(score*31+value.charCodeAt(index))|0;
  return score;
}

function OptionIndex({index}:{index:number}) {
  return <span className="canonical-option-index">{String.fromCharCode(65+index)}</span>;
}

export function PlainLanguageReview({block,onResolved,onRestart}:{block:MatchingBlock;onResolved:(answer:ScreenAnswer)=>void;onRestart?:()=>void}) {
  const [stage,setStage]=useState<PlainLanguageStage>("quiz");
  const [questionIndex,setQuestionIndex]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const [correctCount,setCorrectCount]=useState(0);
  const [answerResults,setAnswerResults]=useState<boolean[]>([]);
  const {questionRef,retryToQuestion}=useRetryToQuestion<HTMLDivElement>();
  const feedbackRef=useScrollToResult<HTMLDivElement>(submitted);
  const quizOptions=useMemo(()=>block.pairs.map((question)=>block.pairs.slice().sort((left,right)=>stableTextScore(`${block.id}:${question.id}:${left.id}`)-stableTextScore(`${block.id}:${question.id}:${right.id}`))),[block.id,block.pairs]);
  const question=block.pairs[questionIndex];
  const selectedIsCorrect=selectedId===question?.id;
  const restartQuiz=()=>retryToQuestion(()=>{setQuestionIndex(0);setSelectedId(null);setSubmitted(false);setCorrectCount(0);setAnswerResults([]);setStage("quiz");onRestart?.()});
  const submitAnswer=()=>{if(!selectedId||submitted)return;setSubmitted(true);setAnswerResults((current)=>{const next=[...current];next[questionIndex]=selectedIsCorrect;return next});if(selectedIsCorrect)setCorrectCount((current)=>current+1)};
  const continueQuiz=()=>{
    if(!submitted)return;
    if(questionIndex<block.pairs.length-1){setQuestionIndex((current)=>current+1);setSelectedId(null);setSubmitted(false);return}
    setStage("complete");
    onResolved({blockId:block.id,values:block.pairs.map((pair)=>pair.right)});
  };

  if(stage==="complete"){
    const scorePercent=Math.round(correctCount/block.pairs.length*100);
    const resultMessage=scorePercent===100?"全部答啱":scorePercent>=60?"掌握得唔錯":"再溫一次會更穩";
    return <div className="plain-language-review" data-stage="complete">
      <div className="plain-language-result-summary">
        <div className="plain-language-score" role="img" aria-label={`正確率 ${scorePercent}%`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="score-track" cx="60" cy="60" r="52" pathLength="100"/>
            <circle className="score-value" cx="60" cy="60" r="52" pathLength="100" strokeDasharray={`${scorePercent} 100`}/>
          </svg>
          <span><strong>{scorePercent}<small>%</small></strong><em>正確率</em></span>
        </div>
        <div className="plain-language-result-copy">
          <span><Check/> 已完成</span>
          <h1>完成小測</h1>
          <strong>{resultMessage}</strong>
          <p><b>{correctCount}</b> / {block.pairs.length} 題答啱</p>
        </div>
      </div>
      <section className="plain-language-recap" aria-labelledby="plain-language-recap-title">
        <header>
          <div><BookOpen/><h2 id="plain-language-recap-title">重點溫習</h2></div>
          <span>{block.pairs.length} 個重點</span>
        </header>
        <div>{block.pairs.map((pair,index)=><details className={answerResults[index]?"is-correct":"needs-review"} key={pair.id}>
          <summary>
            <span className="plain-language-recap-status" aria-label={answerResults[index]?"答啱":"建議再溫習"} title={answerResults[index]?"答啱":"建議再溫習"}>{answerResults[index]?<Check/>:<RotateCcw/>}</span>
            <strong>{pair.left}</strong>
            <ChevronDown className="plain-language-recap-chevron"/>
          </summary>
          <p>{plainLanguageText(pair.right)}</p>
        </details>)}</div>
      </section>
      <button type="button" className="plain-language-secondary" onClick={restartQuiz}><RotateCcw/>再做一次</button>
    </div>;
  }

  return <div ref={questionRef} className="plain-language-review" data-stage="quiz">
    <header className="plain-language-heading"><span>快速小測</span><strong>{questionIndex+1}/{block.pairs.length}</strong></header>
    <div className="plain-language-step" aria-hidden="true"><span style={{width:`${(questionIndex+1)/block.pairs.length*100}%`}}/></div>
    <h1>以下邊個解釋正確？</h1>
    <div className="plain-language-question"><small>法律重點</small><strong>{question.left}</strong></div>
    <div className="plain-language-options" role="radiogroup" aria-label={`${question.left} 嘅解釋`}>
      {quizOptions[questionIndex].map((option,index)=>{
        const selected=selectedId===option.id;
        const showCorrect=submitted&&option.id===question.id;
        const showIncorrect=submitted&&selected&&!selectedIsCorrect;
        return <button type="button" role="radio" aria-checked={selected} disabled={submitted} className={`${selected?"selected ":""}${showCorrect?"correct ":""}${showIncorrect?"incorrect":""}`.trim()} onClick={()=>setSelectedId(option.id)} key={option.id}><OptionIndex index={index}/><span>{plainLanguageText(option.right)}</span></button>;
      })}
    </div>
    {submitted&&<div ref={feedbackRef} className={`plain-language-feedback ${selectedIsCorrect?"correct":"incorrect"}`} role="status"><strong>{selectedIsCorrect?"答啱咗":"正確解釋係"}</strong><p>{plainLanguageText(question.right)}</p></div>}
    {!submitted?<button type="button" className="canonical-submit plain-language-primary" disabled={!selectedId} onClick={submitAnswer}>確認答案</button>:<button type="button" className="canonical-submit plain-language-primary" onClick={continueQuiz}>{questionIndex===block.pairs.length-1?"完成小測":"下一題"}</button>}
  </div>;
}
