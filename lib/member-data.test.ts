import { describe, expect, it } from "vitest";
import { allCourseLessons, certificatePrograms, challengeTasks, challenges, getCourse, getProgramCourses, practiceGames, promptCategories, promptLibrary, promptSubcategories, toolCourses } from "./member-data";
import { lessonGuidance } from "./lesson-content";
import { onboardingStorageKey } from "./onboarding-data";

describe("learner content integrity", () => {
  it("gives every certificate program its own valid curriculum", () => {
    expect(certificatePrograms).toHaveLength(17);
    for (const program of certificatePrograms) {
      expect(getProgramCourses(program.id)).toHaveLength(program.courseIds.length);
      expect(new Set(program.courseIds).size).toBe(program.courseIds.length);
    }
    expect(certificatePrograms[0].courseIds).not.toEqual(certificatePrograms[1].courseIds);
  });

  it("provides every prompt category and subcategory with usable content", () => {
    expect(promptLibrary).toHaveLength(promptCategories.length * promptSubcategories.length);
    for (const category of promptCategories) for (const subcategory of promptSubcategories) {
      expect(promptLibrary.some((prompt) => prompt.category === category && prompt.subcategory === subcategory && prompt.body.length > 80)).toBe(true);
    }
  });

  it("builds a complete sequential task path for every challenge", () => {
    for (const challenge of challenges) {
      const tasks = challengeTasks(challenge);
      expect(tasks).toHaveLength(challenge.days);
      expect(tasks.at(-1)?.day).toBe(challenge.days);
      expect(new Set(tasks.map((task) => task.title)).size).toBeGreaterThanOrEqual(7);
    }
  });

  it("ships multi-question practice sessions with explanations", () => {
    expect(practiceGames).toHaveLength(3);
    for (const game of practiceGames) {
      expect(game.questions.length).toBeGreaterThanOrEqual(4);
      expect(game.questions.every((question) => question.answers[question.correct] && question.explanation.length > 30)).toBe(true);
    }
  });

  it("tailors lesson guidance to different skill families", () => {
    const visual = lessonGuidance("Lighting", "Midjourney");
    const research = lessonGuidance("Research Faster", "ChatGPT");
    expect(visual.framework).not.toEqual(research.framework);
    expect(visual.strongInstruction).toContain("4:5");
    expect(research.strongInstruction).toContain("sources");
  });

  it("keeps every course map aligned with its advertised lesson count",()=>{
    for(const catalog of toolCourses) expect(allCourseLessons(getCourse(catalog.id))).toHaveLength(catalog.lessonCount ?? 0);
  });

  it("isolates onboarding drafts by uid",()=>{
    expect(onboardingStorageKey("user-a")).toBe("lumora.onboarding.v1:user-a");
    expect(onboardingStorageKey("user-a")).not.toBe(onboardingStorageKey("user-b"));
  });
});
