import { describe, expect, it } from "vitest";
import { calculateStreaks, canCompleteChallengeDay, coursePercent, defaultLearnerState, hasStartedLesson, isCourseLessonProgressStorageKey, learnerStateStorageKey, lessonStartedStorageKey, localDateKey, mergeLearnerState, programCompletedCourses, programPercent, resetLessonProgress, weekDateKeys } from "./learner-state";
import { aiMasteryCourses, getProgramCourses } from "./member-data";

describe("learner state",()=>{
  it("calculates current and longest streak without counting duplicate dates",()=>{
    expect(calculateStreaks(["2026-07-15","2026-07-16","2026-07-16","2026-07-18","2026-07-19","2026-07-20"],"2026-07-21")).toEqual({current:3,longest:3,todayComplete:false});
  });

  it("counts today when activity is complete",()=>{
    expect(calculateStreaks(["2026-07-19","2026-07-20","2026-07-21"],"2026-07-21")).toEqual({current:3,longest:3,todayComplete:true});
  });

  it("uses the requested timezone for local day keys",()=>{
    const instant=new Date("2026-07-20T16:30:00.000Z");
    expect(localDateKey(instant,"Asia/Hong_Kong")).toBe("2026-07-21");
    expect(localDateKey(instant,"America/Los_Angeles")).toBe("2026-07-20");
  });

  it("builds a Monday through Sunday week",()=>{
    expect(weekDateKeys(new Date("2026-07-21T08:00:00Z"),"UTC")).toEqual(["2026-07-20","2026-07-21","2026-07-22","2026-07-23","2026-07-24","2026-07-25","2026-07-26"]);
  });

  it("derives course and programme completion from lesson ids",()=>{
    const state=defaultLearnerState();
    state.courses.chatgpt={completedLessonIds:aiMasteryCourses[0].sections.flatMap((section)=>section.lessons.map((lesson)=>lesson.id)),lastLessonId:null,lastScreenId:null,updatedAt:null};
    expect(coursePercent(state,"chatgpt")).toBe(100);
    expect(programCompletedCourses(state)).toBe(1);
  });

  it("calculates progress against each program's own curriculum",()=>{
    const state=defaultLearnerState();const course=getProgramCourses("program-2")[0];
    state.courses[course.id]={completedLessonIds:course.sections.flatMap((section)=>section.lessons.map((lesson)=>lesson.id)),lastLessonId:null,lastScreenId:null,updatedAt:null};
    expect(programCompletedCourses(state,"program-2")).toBe(1);
    expect(programPercent(state,"program-2")).toBe(20);
    expect(programCompletedCourses(state,"program-3")).toBeLessThanOrEqual(1);
  });

  it("migrates partial documents and removes duplicate activity",()=>{
    const state=mergeLearnerState({activityDates:["2026-07-21","2026-07-21"],preferences:{darkMode:true} as never});
    expect(state.version).toBe(2);expect(state.activityDates).toEqual(["2026-07-21"]);expect(state.preferences.darkMode).toBe(true);expect(state.preferences.language).toBe("English");
    expect(state.programAssessments).toEqual({});
  });

  it("isolates the local learner cache by Firebase uid",()=>{
    expect(learnerStateStorageKey("user-a")).not.toBe(learnerStateStorageKey("user-b"));
    expect(learnerStateStorageKey("user-a")).toBe("lumora.learner.state.v2:user-a");
  });

  it("matches only per-lesson progress keys for the requested course",()=>{
    expect(lessonStartedStorageKey("basic-law","articles-6-11")).toBe("coursiv.started.v3:basic-law:articles-6-11");
    expect(isCourseLessonProgressStorageKey("coursiv.started.v1:basic-law:articles-6-11","basic-law")).toBe(true);
    expect(isCourseLessonProgressStorageKey("coursiv.started.v2:basic-law:articles-6-11","basic-law")).toBe(true);
    expect(isCourseLessonProgressStorageKey("coursiv.started.v3:basic-law:articles-6-11","basic-law")).toBe(true);
    expect(isCourseLessonProgressStorageKey("coursiv.resolved.v3:basic-law:articles-6-11","basic-law")).toBe(true);
    expect(isCourseLessonProgressStorageKey("coursiv.skipped.v3:basic-law:articles-6-11","basic-law")).toBe(true);
    expect(isCourseLessonProgressStorageKey("coursiv.resolved.v3:chatgpt:intro","basic-law")).toBe(false);
    expect(isCourseLessonProgressStorageKey("lumora.learner.state.v2:user-a","basic-law")).toBe(false);
  });

  it("shows lesson restart only after that lesson has started",()=>{
    const courseProgress={completedLessonIds:["completed"],lastLessonId:"current",lastScreenId:"screen-2",updatedAt:"now"};
    const emptyLesson={visitedScreenIds:[],resolvedScreenIds:[],skippedScreenIds:[],lastScreenId:null,completedAt:null};
    expect(hasStartedLesson(courseProgress,"never-started",emptyLesson)).toBe(false);
    expect(hasStartedLesson(courseProgress,"current",emptyLesson)).toBe(false);
    expect(hasStartedLesson(courseProgress,"completed",emptyLesson)).toBe(true);
    expect(hasStartedLesson(undefined,"opened-only",{...emptyLesson,visitedScreenIds:["screen-1"],lastScreenId:"screen-1"})).toBe(false);
    expect(hasStartedLesson(undefined,"legacy-remote",{...emptyLesson,visitedScreenIds:["screen-1","screen-2"],lastScreenId:"screen-2"})).toBe(false);
    expect(hasStartedLesson(undefined,"legacy-answer",{...emptyLesson,visitedScreenIds:["screen-1"],resolvedScreenIds:["screen-1"]})).toBe(false);
    expect(hasStartedLesson(undefined,"remote-completed",{...emptyLesson,completedAt:"now"})).toBe(true);
  });

  it("resets only the selected lesson progress",()=>{
    const state=defaultLearnerState();
    state.courses["basic-law"]={completedLessonIds:["lesson-1","lesson-2"],lastLessonId:"lesson-2",lastScreenId:"screen-4",updatedAt:"before"};
    const reset=resetLessonProgress(state,"basic-law","lesson-2","after");
    expect(reset.courses["basic-law"]).toEqual({completedLessonIds:["lesson-1"],lastLessonId:"lesson-1",lastScreenId:null,updatedAt:"after"});
    expect(state.courses["basic-law"].completedLessonIds).toEqual(["lesson-1","lesson-2"]);
  });

  it("removes empty course progress when its current lesson is reset",()=>{
    const state=defaultLearnerState();
    state.courses["basic-law"]={completedLessonIds:[],lastLessonId:"lesson-1",lastScreenId:"screen-4",updatedAt:"before"};
    expect(resetLessonProgress(state,"basic-law","lesson-1").courses["basic-law"]).toBeUndefined();
  });

  it("allows only one new challenge day per local date",()=>{
    const entry={joinedAt:"2026-07-21T08:00:00Z",completedDays:[1],completedDayDates:{"1":"2026-07-21"},completedAt:null};
    expect(canCompleteChallengeDay(entry,"2026-07-21")).toBe(false);
    expect(canCompleteChallengeDay(entry,"2026-07-22")).toBe(true);
  });

  it("migrates challenge records created before daily dates were tracked",()=>{
    const state=mergeLearnerState({challenges:{legacy:{joinedAt:"2026-07-20T00:00:00Z",completedDays:[1],completedAt:null} as never}});
    expect(state.challenges.legacy.completedDayDates).toEqual({});
  });
});
