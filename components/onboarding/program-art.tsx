import type { ProgramDefinition } from "@/lib/onboarding-data";

export function ProgramArt({ variant }: { variant: ProgramDefinition["thumbnail"] }) {
  if (variant === "certificate") {
    return (
      <span className="program-art art-certificate" aria-hidden="true">
        <i className="certificate-paper"><b /><b /><b /></i>
        <i className="certificate-medal">★</i>
        <i className="art-spark spark-a">✦</i><i className="art-spark spark-b">✦</i>
      </span>
    );
  }

  if (variant === "personalized") {
    return (
      <span className="program-art art-personalized" aria-hidden="true">
        <i className="art-monitor"><b /></i><i className="ai-bubble">AI</i>
        <i className="art-spark spark-a">✦</i><i className="art-spark spark-b">✦</i>
      </span>
    );
  }

  return (
    <span className="program-art art-accounting" aria-hidden="true">
      <i className="art-sheet"><b /><b /><b /></i><i className="art-pen" />
      <i className="art-spark spark-b">✦</i>
    </span>
  );
}
