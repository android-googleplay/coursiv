import { describe, expect, it } from "vitest";
import { courseUnlocksAllLessons, lessonNodeState } from "./course-access";

describe("course lesson access", () => {
  it("unlocks every course in debug mode without changing normal access", () => {
    expect(courseUnlocksAllLessons({demoUser:false,shortsCourse:false,debugMode:true})).toBe(true);
    expect(courseUnlocksAllLessons({demoUser:false,shortsCourse:false,debugMode:false})).toBe(false);
    expect(courseUnlocksAllLessons({demoUser:true,shortsCourse:false,debugMode:false})).toBe(true);
    expect(courseUnlocksAllLessons({demoUser:false,shortsCourse:true,debugMode:false})).toBe(true);
  });

  it("unlocks every unfinished lesson for a guest", () => {
    expect(lessonNodeState({ lessonId:"lesson-8",lessonIndex:7,completedLessonIds:[],allLessonsUnlocked:true })).toBe("available");
  });

  it("keeps sequential access for a regular member", () => {
    expect(lessonNodeState({ lessonId:"lesson-1",lessonIndex:0,completedLessonIds:[],allLessonsUnlocked:false })).toBe("available");
    expect(lessonNodeState({ lessonId:"lesson-3",lessonIndex:2,completedLessonIds:["lesson-1"],allLessonsUnlocked:false })).toBe("locked");
  });

  it("keeps a completed lesson completed even when all lessons are unlocked", () => {
    expect(lessonNodeState({ lessonId:"lesson-2",lessonIndex:1,completedLessonIds:["lesson-2"],allLessonsUnlocked:true })).toBe("completed");
  });
});
