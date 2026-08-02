import { describe, expect, it } from "vitest";
import { calculateStreaks, canCompleteChallengeDay, coursePercent, defaultLearnerState, learnerStateStorageKey, localDateKey, mergeLearnerState, programCompletedCourses, programPercent, weekDateKeys } from "./learner-state";
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
