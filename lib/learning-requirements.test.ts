import { describe, expect, it } from "vitest";
import { GENERIC_LESSON_SCREEN_IDS, learningLessonDocumentId, lessonRequirement } from "./learning-requirements";
import { lessonScreens } from "./lesson-data";
import { allCourseLessons, getCourse } from "./member-data";
import { gradeProgramAssessment, programAssessmentQuestions } from "./program-assessment";

describe("authoritative learning requirements", () => {
  it("rejects unknown courses and lessons", () => {
    expect(lessonRequirement("unknown", "voice-mode")).toBeNull();
    expect(lessonRequirement("chatgpt", "unknown")).toBeNull();
  });

  it("uses exact screen sequences for special and generic lessons", () => {
    expect(lessonRequirement("chatgpt", "discovering-modes")?.screenIds).toEqual(lessonScreens.map((screen) => screen.id));
    const canonicalVoiceMode = allCourseLessons(getCourse("chatgpt")).find((lesson) => lesson.id === "voice-mode");
    expect(lessonRequirement("chatgpt", "voice-mode")?.screenIds).toEqual(canonicalVoiceMode?.screenIds);
    expect(canonicalVoiceMode?.screenIds).not.toEqual(GENERIC_LESSON_SCREEN_IDS);
    expect(learningLessonDocumentId("chatgpt", "voice-mode")).toBe("chatgpt__voice-mode");
  });

  it("grades only complete, valid assessment submissions", () => {
    expect(gradeProgramAssessment([])).toBeNull();
    expect(gradeProgramAssessment([9, 9, 9, 9, 9])).toBeNull();
    expect(gradeProgramAssessment(programAssessmentQuestions.map((question) => question.correct))).toEqual({ score:100,passed:true });
    expect(gradeProgramAssessment([0, 0, 0, 0, 0])).toEqual({ score:20,passed:false });
  });
});
