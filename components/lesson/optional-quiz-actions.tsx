import { ButtonText } from "../member/button-text";

export function OptionalQuizActions({busy,onStart,onSkip}:{busy:boolean;onStart:()=>void;onSkip:()=>void}) {
  return <footer className="canonical-quiz-actions"><button className="canonical-quiz-start" disabled={busy} onClick={onStart}><ButtonText>{busy?"Saving…":"Start quiz"}</ButtonText></button><button className="canonical-quiz-skip" disabled={busy} onClick={onSkip}><ButtonText>Skip quiz</ButtonText></button></footer>;
}
