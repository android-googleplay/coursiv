import { Suspense } from "react";
import { LessonPlayer } from "@/components/lesson/lesson-player";

export default function DiscoveringModesLessonPage() {
  return (
    <Suspense fallback={<div className="onboarding-loading"><span /></div>}>
      <LessonPlayer />
    </Suspense>
  );
}
