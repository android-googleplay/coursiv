import { describe,expect,it } from "vitest";
import type { CoursivLessonScreen } from "../coursiv-content";
import { describeScreenBlocks,screenEditorLabel } from "./admin-screen-label";

const screen=(overrides:Partial<CoursivLessonScreen>={}):CoursivLessonScreen=>({
  id:"screen-1",
  sourcePageId:"page-1",
  order:0,
  type:"chunk",
  presentation:"content",
  interactionPolicy:"read",
  blocks:[],
  ...overrides,
});

describe("CMS screen labels",()=>{
  it("keeps an explicit learner title as the editor label",()=>{
    expect(screenEditorLabel(screen({title:"Welcome to Claude"}),0)).toEqual({
      label:"Welcome to Claude",
      source:"manual",
      contents:"Empty screen",
    });
  });

  it("derives a concise label from rich heading content",()=>{
    const result=screenEditorLabel(screen({blocks:[
      {id:"h",type:"heading",text:"<strong>Scenario:</strong> Choosing a Health Insurance Plan",level:2},
      {id:"p",type:"paragraph",text:"Compare the available plans."},
      {id:"i",type:"image",src:"/image.webp",alt:"Plan comparison"},
    ]}),4);
    expect(result.label).toBe("Scenario: Choosing a Health Insurance Plan");
    expect(result.source).toBe("generated");
    expect(result.contents).toBe("Heading · Rich text · Image");
  });

  it("uses question copy before surrounding prose",()=>{
    const result=screenEditorLabel(screen({blocks:[
      {id:"p",type:"paragraph",text:"Test your understanding."},
      {id:"q",type:"single-choice",question:"Which tool should you choose?",options:[
        {id:"a",label:"Claude",isCorrect:true},
        {id:"b",label:"Another tool",isCorrect:false},
      ]},
    ]}),5);
    expect(result.label).toBe("Question: Which tool should you choose?");
    expect(result.contents).toBe("Rich text · Single-choice question (2 answers · 1 correct)");
  });

  it("makes complex activity readiness visible while collapsed",()=>{
    expect(describeScreenBlocks([
      {id:"q",type:"multi-choice",question:"Select every use",options:[
        {id:"a",label:"A",isCorrect:true},
        {id:"b",label:"B",isCorrect:true},
        {id:"c",label:"C",isCorrect:false},
      ]},
    ])).toBe("Multiple-choice question (3 answers · 2 correct)");
    expect(describeScreenBlocks([
      {id:"m",type:"matching-pairs",title:"Match",pairs:[
        {id:"a",left:"A",right:"1"},
        {id:"b",left:"B",right:"2"},
      ]},
    ])).toBe("Matching activity (2 pairs)");
  });

  it("summarises repeated block types and handles an empty screen",()=>{
    expect(describeScreenBlocks([
      {id:"a",type:"paragraph",text:"One"},
      {id:"b",type:"paragraph",text:"Two"},
      {id:"c",type:"paragraph",text:"Three"},
    ])).toBe("3 Rich text sections");
    expect(screenEditorLabel(screen(),8)).toEqual({label:"Screen 9",source:"generated",contents:"Empty screen"});
  });
});
