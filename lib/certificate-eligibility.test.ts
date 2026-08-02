import { describe, expect, it } from "vitest";
import { eligibleCertificateDefinitions, isCourseComplete } from "./certificate-eligibility";
import { allCourseLessons, certificatePrograms, getCourse, getProgramCourses } from "./member-data";
import { defaultLearnerState, type LearnerState } from "./learner-state";

function completeCourse(state: LearnerState, courseId: string) {
  state.courses[courseId] = {
    completedLessonIds: allCourseLessons(getCourse(courseId)).map((lesson) => lesson.id),
    lastLessonId: null,
    lastScreenId: null,
    updatedAt: new Date().toISOString(),
  };
}

describe("certificate eligibility", () => {
  it("requires every exact lesson before issuing a course certificate", () => {
    const state = defaultLearnerState();
    const lessons = allCourseLessons(getCourse("chatgpt"));
    state.courses.chatgpt = { completedLessonIds: Array(lessons.length).fill(lessons[0].id), lastLessonId: lessons[0].id, lastScreenId: null, updatedAt: null };
    expect(isCourseComplete(state, "chatgpt")).toBe(false);
    expect(eligibleCertificateDefinitions(state)).toEqual([]);
    completeCourse(state, "chatgpt");
    expect(eligibleCertificateDefinitions(state).some((item) => item.courseId === "chatgpt")).toBe(true);
  });

  it("requires completed courses and a passing final assessment for a program certificate", () => {
    const state = defaultLearnerState();
    const program = certificatePrograms[0];
    for (const course of getProgramCourses(program.id)) completeCourse(state, course.id);
    expect(eligibleCertificateDefinitions(state).some((item) => item.courseId === `program-${program.id}`)).toBe(false);
    state.programAssessments[program.id] = { score: 60, passedAt: null };
    expect(eligibleCertificateDefinitions(state).some((item) => item.courseId === `program-${program.id}`)).toBe(false);
    state.programAssessments[program.id] = { score: 80, passedAt: new Date().toISOString() };
    expect(eligibleCertificateDefinitions(state).some((item) => item.courseId === `program-${program.id}`)).toBe(true);
  });
});
