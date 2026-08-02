import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CoursivCourse } from "../coursiv-content";
import { repairLegacyNestedIds, validateEditableLesson, type ValidatableLesson } from "./admin-content-validation";

function lesson(): ValidatableLesson {
  return {
    id:"course__lesson",courseId:"course",schemaVersion:3,sourceId:"lesson-source",sourceUnitId:"unit-source",sourceGuideId:"guide-source",
    slug:"lesson",title:"A valid lesson",order:0,readUrl:"https://example.test",hasAudio:false,blocks:[],raw:{},
    screens:[{id:"screen-1",sourcePageId:"page-1",order:0,type:"content",presentation:"knowledge-check",interactionPolicy:"required-interaction",blocks:[
      {id:"question-1",type:"single-choice",question:"Choose",options:[{id:"answer-1",label:"Yes",isCorrect:true},{id:"answer-2",label:"No",isCorrect:false}]},
    ]}],
  };
}

describe("CMS lesson validation", () => {
  it("accepts a complete canonical lesson", () => {
    expect(validateEditableLesson(lesson())).toEqual([]);
  });

  it("rejects duplicate stable IDs and missing answer keys", () => {
    const value=lesson();
    value.screens.push({...value.screens[0],sourcePageId:"page-2",order:1,blocks:[{id:"question-2",type:"single-choice",question:"Choose",options:[{id:"answer",label:"No key",isCorrect:false}]}]});
    expect(validateEditableLesson(value).join(" ")).toContain("Duplicate or missing screen ID");
    expect(validateEditableLesson(value).join(" ")).toContain("has no correct answer");
  });

  it("blocks unknown source payloads from publishing", () => {
    const value=lesson();
    value.screens[0].blocks=[{id:"raw-1",type:"unknown",sourceType:"future-block",raw:{preserved:true}}];
    expect(validateEditableLesson(value)).toContain("Unknown block raw-1 must be resolved before publishing.");
  });

  it("repairs only repeated legacy option IDs with deterministic block-scoped IDs", () => {
    const value=lesson();
    value.screens[0].blocks.push({
      id:"question-2",
      type:"single-choice",
      question:"Choose again",
      options:[
        {id:"answer-1",label:"Again",isCorrect:true},
        {id:"answer-2",label:"Never",isCorrect:false},
      ],
    });
    const repaired=repairLegacyNestedIds(value);
    const second=repaired.screens[0].blocks[1];
    expect(second).toMatchObject({
      options:[
        {id:"question-2:answer-1"},
        {id:"question-2:answer-2"},
      ],
    });
    expect(repairLegacyNestedIds(value)).toEqual(repaired);
    expect(validateEditableLesson(repaired)).toEqual([]);
  });

  it("accepts every existing canonical lesson", () => {
    const directory = join(process.cwd(), "content/coursiv/courses");
    const failures: string[] = [];
    for (const filename of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
      const course = JSON.parse(readFileSync(join(directory, filename), "utf8")) as CoursivCourse;
      for (const item of course.units.flatMap((unit) => unit.lessons)) {
        const errors = validateEditableLesson(repairLegacyNestedIds({ ...item, id: `${course.id}__${item.slug}`, courseId: course.id }));
        if (errors.length) failures.push(`${course.id}/${item.slug}: ${errors.join(" | ")}`);
      }
    }
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });
});
