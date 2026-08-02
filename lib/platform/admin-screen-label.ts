import type { CoursivContentBlock, CoursivLessonScreen } from "../coursiv-content";
import { richTextPlainText } from "../rich-text";

type BlockCopy={singular:string;plural:string};

const blockCopy:Record<CoursivContentBlock["type"],BlockCopy>={
  heading:{singular:"Heading",plural:"Headings"},
  paragraph:{singular:"Rich text",plural:"Rich text sections"},
  list:{singular:"List",plural:"Lists"},
  callout:{singular:"Callout",plural:"Callouts"},
  image:{singular:"Image",plural:"Images"},
  video:{singular:"Video",plural:"Videos"},
  "single-choice":{singular:"Single-choice question",plural:"Single-choice questions"},
  "multi-choice":{singular:"Multiple-choice question",plural:"Multiple-choice questions"},
  "true-false":{singular:"True or false",plural:"True or false questions"},
  "fill-in-blank":{singular:"Fill in the blank",plural:"Fill-in-the-blank questions"},
  "ordering-task":{singular:"Ordering activity",plural:"Ordering activities"},
  "matching-pairs":{singular:"Matching activity",plural:"Matching activities"},
  "prompt-fixer":{singular:"Prompt activity",plural:"Prompt activities"},
  survey:{singular:"Survey",plural:"Surveys"},
  practice:{singular:"Guided practice",plural:"Guided practices"},
  feedback:{singular:"Feedback",plural:"Feedback messages"},
  unknown:{singular:"Unsupported content",plural:"Unsupported content blocks"},
};

function clean(value:string|undefined){
  return richTextPlainText(value??"").replace(/\s+/g," ").trim();
}

function shorten(value:string,max=72){
  const text=clean(value);
  if(text.length<=max)return text;
  const clipped=text.slice(0,max-1);
  const boundary=clipped.lastIndexOf(" ");
  return`${(boundary>Math.floor(max*.6)?clipped.slice(0,boundary):clipped).trim()}…`;
}

function candidate(block:CoursivContentBlock){
  if(block.type==="heading")return clean(block.text);
  if(block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false")return`Question: ${clean(block.question)}`;
  if(block.type==="fill-in-blank")return`Fill in the blank: ${clean(block.prompt||block.template)}`;
  if(block.type==="ordering-task"||block.type==="matching-pairs"||block.type==="prompt-fixer"||block.type==="practice")return clean(block.title);
  if(block.type==="survey")return`Survey: ${clean(block.question)}`;
  if(block.type==="callout")return clean(block.title)||clean(block.text);
  if(block.type==="paragraph"||block.type==="feedback")return clean(block.text);
  if(block.type==="list")return block.items.length?`List: ${clean(block.items[0])}`:"";
  if(block.type==="image")return block.alt?`Image: ${clean(block.alt)}`:"";
  if(block.type==="video")return"Video";
  if(block.type==="unknown")return block.text?`Unsupported: ${clean(block.text)}`:"Unsupported content";
  return"";
}

function interactionDetails(block:CoursivContentBlock){
  if(block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false"){
    const correct=block.options.filter((option)=>option.isCorrect).length;
    return`${block.options.length} answers · ${correct} correct`;
  }
  if(block.type==="fill-in-blank")return`${block.placeholders.length} ${block.placeholders.length===1?"blank":"blanks"} · ${block.tokens.length} choices`;
  if(block.type==="ordering-task")return`${block.items.length} steps`;
  if(block.type==="matching-pairs")return`${block.pairs.length} pairs`;
  if(block.type==="prompt-fixer")return`${block.options.length} options · ${block.options.filter((option)=>option.isCorrect).length} best`;
  if(block.type==="survey")return`${block.options.length} options`;
  return"";
}

export function describeScreenBlocks(blocks:CoursivContentBlock[]){
  if(!blocks.length)return"Empty screen";
  const counts=new Map<CoursivContentBlock["type"],number>();
  const order:CoursivContentBlock["type"][]=[];
  for(const block of blocks){
    if(!counts.has(block.type))order.push(block.type);
    counts.set(block.type,(counts.get(block.type)??0)+1);
  }
  return order.map((type)=>{
    const count=counts.get(type)??0;
    const copy=blockCopy[type];
    if(count!==1)return`${count} ${copy.plural}`;
    const block=blocks.find((value)=>value.type===type);
    const details=block?interactionDetails(block):"";
    return details?`${copy.singular} (${details})`:copy.singular;
  }).join(" · ");
}

export function screenEditorLabel(screen:CoursivLessonScreen,index:number){
  const manual=clean(screen.title);
  if(manual)return{label:shorten(manual),source:"manual" as const,contents:describeScreenBlocks(screen.blocks)};
  const preferred=[
    ...screen.blocks.filter((block)=>block.type==="heading"),
    ...screen.blocks.filter((block)=>["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type)),
    ...screen.blocks.filter((block)=>!["heading","single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type)),
  ];
  const generated=preferred.map(candidate).find(Boolean);
  return{
    label:shorten(generated||`Screen ${index+1}`),
    source:"generated" as const,
    contents:describeScreenBlocks(screen.blocks),
  };
}
