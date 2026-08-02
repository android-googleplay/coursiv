import { describe, expect, it } from "vitest";
import { collectUnknownBlocks, gradeCoursivScreenResponse, lessonScreenIds, normalizeCoursivBlocks, normalizeCoursivLesson, screenAllowsSkip, screenRequiresResolution, slugifyCoursiv, type CoursivCourse } from "./coursiv-content";

describe("Coursiv content normalization", () => {
  it("normalizes text without duplicating cumulative chunks", () => {
    const blocks = normalizeCoursivBlocks([
      { id:"intro",type:"chunk",content:[{type:"heading",text:"Start here"},{type:"paragraph",text:"One clear paragraph."}] },
      { id:"list",type:"chunk",content:[{type:"list",items:["First","Second"]}] },
    ]);
    expect(blocks.map((block)=>block.id)).toEqual(["intro-heading-1","intro-paragraph-2","list-list-1"]);
    expect(blocks.filter((block)=>block.type==="paragraph")).toHaveLength(1);
  });

  it("preserves every correct answer and quiz feedback", () => {
    const [quiz] = normalizeCoursivBlocks([{id:"quiz-1",type:"multi_choice",content:[{
      id:"question-1",question:{text:"Select the workflow requirements"},options:[
        {id:"a",text:"Multiple outputs",is_correct:true},{id:"b",text:"Contradiction checks",is_correct:true},{id:"c",text:"Expert chess",is_correct:false},
      ],feedback_correct:{text:"Reliable preparation is the goal."},feedback_incorrect:{text:"Try the workflow requirements again."},
    }]}]);
    expect(quiz.type).toBe("multi-choice");
    if(quiz.type!=="multi-choice")throw new Error("Expected multi-choice");
    expect(quiz.options.filter((option)=>option.isCorrect).map((option)=>option.id)).toEqual(["a","b"]);
    expect(quiz.feedbackCorrect?.text).toBe("Reliable preparation is the goal.");
  });

  it("normalizes fill-in-the-blank tokens and answer order", () => {
    const [fill] = normalizeCoursivBlocks([{id:"practice-1",type:"practice_preview",content:[{
      id:"fill-1",type:"fill_in_the_blank",prompt:"Complete the prompt",template:"Before analysis, [command] and list [detail].",
      options:[{text:"describe each file",is_correct:true},{text:"the columns",is_correct:true}],correct_answers:["describe each file","the columns"],example_response:"A completed prompt",
    }]}]);
    expect(fill.type).toBe("fill-in-blank");
    if(fill.type!=="fill-in-blank")throw new Error("Expected fill-in-blank");
    expect(fill.correctTokens).toEqual(["describe each file","the columns"]);
    expect(fill.exampleResponse).toBe("A completed prompt");
  });

  it("keeps unknown source blocks auditable and gives every screen a unique id", () => {
    const lesson = normalizeCoursivLesson({data:{id:"lesson-id",name:"Odd lesson",content:[{id:"same",type:"new_interactive",content:{value:"Alpha"}},{id:"same",type:"new_interactive",content:{value:"Beta"}}]}},{guideId:"guide",unitId:"unit",order:0});
    expect(lesson.blocks.every((block)=>block.type==="unknown")).toBe(true);
    expect(new Set(lessonScreenIds(lesson)).size).toBe(2);
    const course: CoursivCourse={schemaVersion:1,id:"odd",sourceId:"guide",kind:"tool",title:"Odd",duration:"1h",categories:[],units:[{sourceId:"unit",order:0,lessons:[lesson]}]};
    expect(collectUnknownBlocks(course)).toHaveLength(2);
  });

  it("requires source lesson ids and creates stable slugs", () => {
    expect(slugifyCoursiv("ChatGPT & Apps")).toBe("chatgpt-apps");
    expect(()=>normalizeCoursivLesson({data:{name:"Missing id",content:[]}},{guideId:"guide",unitId:"unit",order:0})).toThrow("missing an id");
  });

  it("keeps a source chunk together as one screen with text and media",()=>{
    const lesson=normalizeCoursivLesson({id:"lesson",name:"Grouped",content:[{id:"page",type:"page",content:[{id:"screen",type:"chunk",audio:"https://cdn.test/audio.mp3",content:[{id:"title",type:"title",value:"AI in Accounting"},{id:"copy",type:"text",value:"Complete lesson copy."},{id:"art",type:"image",value:"https://cdn.test/art.webp"}]}]}]},{guideId:"guide",unitId:"unit",order:0});
    expect(lesson.screens).toHaveLength(1);expect(lesson.screens[0].blocks.map((block)=>block.type)).toEqual(["heading","paragraph","image"]);expect(lesson.screens[0].audioSource).toBe("https://cdn.test/audio.mp3");
  });

  it("normalizes and grades ordering, matching and true-false practice",()=>{
    const lesson=normalizeCoursivLesson({id:"lesson",content:[{id:"page",type:"page",content:[
      {id:"order-screen",type:"practice_preview",content:[{id:"order",type:"ordering_task",title:"Order",practice_payload:{items:[{id:"order-item",type:"ordering_task",sequences:["One","Two"]}]}}]},
      {id:"match-screen",type:"practice_preview",content:[{id:"match",type:"matching_pairs",title:"Match",practice_payload:{items:[{id:"match-item",type:"matching_pairs",left_pairs:[{content:"A",ordering:1}],right_pairs:[{content:"B",ordering:1}]}]}}]},
      {id:"tf-screen",type:"practice_preview",content:[{id:"tf",type:"true_false",practice_payload:{items:[{id:"tf-item",type:"true_false",question:{text:"Useful?"},options:[{id:"yes",text:"Useful",is_correct:true},{id:"no",text:"Not useful",is_correct:false}]}]}}]},
    ]}]},{guideId:"guide",unitId:"unit",order:0});
    expect(lesson.screens.flatMap((screen)=>screen.blocks).map((block)=>block.type)).toEqual(["ordering-task","matching-pairs","true-false"]);
    expect(gradeCoursivScreenResponse(lesson.screens[0],{blockId:"order-item",values:["One","Two"]})).toBe(true);
    expect(gradeCoursivScreenResponse(lesson.screens[1],{blockId:"match-item",values:["B"]})).toBe(true);
    expect(gradeCoursivScreenResponse(lesson.screens[2],{blockId:"tf-item",values:["yes"]})).toBe(true);
  });

  it("classifies reference practice as optional and knowledge checks as required",()=>{
    const lesson=normalizeCoursivLesson({id:"lesson",content:[{id:"page",type:"page",content:[
      {id:"practice-screen",type:"practice_preview",content:[{id:"fill",type:"fill_in_the_blank",title:"Build it",practice_payload:{items:[{id:"fill-item",type:"fill_in_the_blank",metadata:{tool:{name:"Gemini",icon:"https://cdn.test/gemini.png"}},template:"Use [tool]",gaps:["Gemini"]}]}}]},
      {id:"quiz-screen",type:"single_choice",content:[{id:"quiz",question:"Ready?",options:[{id:"yes",text:"Yes",is_correct:true}]}]},
      {id:"copy-screen",type:"chunk",content:[{id:"copy",type:"text",value:"Read me"}]},
    ]}]},{guideId:"guide",unitId:"unit",order:0});
    expect(lesson.schemaVersion).toBe(3);
    expect(lesson.screens[0]).toMatchObject({presentation:"practice",interactionPolicy:"optional-practice",title:"Build it",practiceTool:{name:"Gemini",icon:"https://cdn.test/gemini.png"}});
    expect(screenAllowsSkip(lesson.screens[0])).toBe(true);
    expect(lesson.screens[1]).toMatchObject({presentation:"knowledge-check",interactionPolicy:"required-interaction"});
    expect(screenRequiresResolution(lesson.screens[1])).toBe(true);
    expect(lesson.screens[2]).toMatchObject({presentation:"content",interactionPolicy:"read"});
  });

  it("keeps every fill placeholder paired with its source gap",()=>{
    const lesson=normalizeCoursivLesson({id:"lesson",content:[{id:"page",type:"page",content:[{id:"practice",type:"practice_preview",content:[{id:"fill",type:"fill_in_the_blank",practice_payload:{items:[{id:"fill-item",type:"fill_in_the_blank",template:"[Subject] in [viewpoint] [aspect ratio]",gaps:["Happy kids","eye-level view","--ar 3:2"]}]}}]}]}]},{guideId:"guide",unitId:"unit",order:0});
    const block=lesson.screens[0].blocks[0];
    expect(block).toMatchObject({type:"fill-in-blank",placeholders:["Subject","viewpoint","aspect ratio"],tokens:["Happy kids","eye-level view","--ar 3:2"],correctTokens:["Happy kids","eye-level view","--ar 3:2"]});
  });
});
