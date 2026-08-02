import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gradeCoursivScreenResponse,type CoursivCourse,type CoursivLesson } from "./coursiv-content";

const golden=[["use-case-2","tax-research-review"],["kling","kling-for-educators"],["kling","image-generation"]] as const;
function load(courseId:string,slug:string){const course=JSON.parse(readFileSync(join(process.cwd(),"content/coursiv/courses",`${courseId}.json`),"utf8")) as CoursivCourse;const lesson=course.units.flatMap((unit)=>unit.lessons).find((item)=>item.slug===slug);if(!lesson)throw new Error(`Missing golden lesson ${courseId}/${slug}`);return lesson}
function answer(lesson:CoursivLesson){return lesson.screens.filter((screen)=>screen.interactionPolicy!=="read").map((screen)=>{const block=screen.blocks.find((item)=>["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(item.type));if(!block)throw new Error(`Screen ${screen.id} has no gradeable interaction`);let values:string[]=[];if(block.type==="single-choice"||block.type==="multi-choice"||block.type==="true-false")values=block.options.filter((option)=>option.isCorrect).map((option)=>option.id);else if(block.type==="fill-in-blank")values=block.correctTokens;else if(block.type==="ordering-task")values=block.correctItems;else if(block.type==="matching-pairs")values=block.pairs.map((pair)=>pair.right);else if(block.type==="prompt-fixer")values=[block.options.find((option)=>option.isCorrect)?.id??""];else if(block.type==="survey")values=[block.options[0]?.id??""];else if(block.type==="practice")values=["submitted"];return{screen,block,values}})}

describe("reference-v1 golden lesson contracts",()=>{
  it("pins the three journeys and their source screen counts",()=>{expect(golden.map(([course,slug])=>load(course,slug).screens.length)).toEqual([23,23,29])});
  it("covers every advanced renderer used by the corpus",()=>{const types=new Set<string>(golden.flatMap(([course,slug])=>load(course,slug).screens.flatMap((screen)=>screen.blocks.map((block)=>block.type))));for(const type of ["heading","paragraph","image","video","callout","single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer"])expect(types.has(type),type).toBe(true)});
  it.each(golden)("grades every interaction in %s/%s and rejects an invalid answer",(course,slug)=>{for(const {screen,block,values} of answer(load(course,slug))){expect(gradeCoursivScreenResponse(screen,{blockId:block.id,values})).toBe(true);expect(gradeCoursivScreenResponse(screen,{blockId:block.id,values:["__invalid__"]})).toBe(false)}});
});
