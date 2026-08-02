"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Copy, Dumbbell, Eye, EyeOff, GripVertical, History, ImagePlus, Layers3, ListOrdered, Monitor, Plus, RotateCcw, Save, Smartphone, Tags, Trash2, Upload, X } from "lucide-react";
import { AdminShell } from "./admin-pages";
import { RichTextEditor } from "./rich-text-editor";
import { MediaPickerModal } from "./media-picker-modal";
import { SafeRichText } from "@/components/shared/safe-rich-text";
import type { CoursivContentBlock, CoursivInteractionPolicy, CoursivLessonScreen } from "@/lib/coursiv-content";
import type { AdminCourseSummary, ContentRevision, EditableCourse, EditableLesson } from "@/lib/platform/admin-content-repository";
import type { MediaAsset } from "@/lib/platform/types";
import { validateEditableLesson } from "@/lib/platform/admin-content-validation";
import { validateCourseMetadata } from "@/lib/platform/admin-course-validation";
import { buildLessonStarter, type LessonStarterTemplate } from "@/lib/platform/admin-lesson-starter";
import { screenEditorLabel } from "@/lib/platform/admin-screen-label";
import { formatCmsUpdatedAt } from "@/lib/platform/admin-content-display";
import { blockHasAnswerKey, lessonPreviewReadiness } from "@/lib/platform/admin-lesson-readiness";
import { addCourseCategory, buildCourseCategoryOptions, categoryKey, closestCourseCategory, type CourseCategoryOption } from "@/lib/platform/admin-course-categories";

type EditableBlockType = Exclude<CoursivContentBlock["type"], "unknown">;
const blockGroups: { label: string; types: EditableBlockType[] }[] = [
  { label: "Text and layout", types: ["heading","paragraph","list","callout"] },
  { label: "Media", types: ["image","video"] },
  { label: "Questions", types: ["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey"] },
  { label: "Practice and feedback", types: ["practice","feedback"] },
];
const blockMeta: Record<EditableBlockType, { label: string; description: string }> = {
  heading: { label: "Section heading", description: "Introduce a new part of the lesson" },
  paragraph: { label: "Rich text", description: "Formatted lesson text, links and lists" },
  list: { label: "Simple list", description: "A quick bulleted or numbered list" },
  callout: { label: "Tip or callout", description: "Highlight an important note" },
  image: { label: "Image", description: "Upload an image with accessible text" },
  video: { label: "Video", description: "Add an instructional video" },
  "single-choice": { label: "Single-choice question", description: "Learner chooses one correct answer" },
  "multi-choice": { label: "Multiple-choice question", description: "Learner chooses every correct answer" },
  "true-false": { label: "True or false", description: "A two-option knowledge check" },
  "fill-in-blank": { label: "Fill in the blank", description: "Learner completes missing words" },
  "ordering-task": { label: "Order the steps", description: "Learner arranges items correctly" },
  "matching-pairs": { label: "Match the pairs", description: "Learner connects related items" },
  "prompt-fixer": { label: "Improve a prompt", description: "Learner chooses the best prompt improvement" },
  survey: { label: "Survey", description: "Collect a preference without grading" },
  practice: { label: "Guided practice", description: "A practical task learners may complete" },
  feedback: { label: "Feedback message", description: "Show a success or guidance message" },
};
const policies: CoursivInteractionPolicy[] = ["read","required-interaction","optional-practice"];
const policyLabels: Record<CoursivInteractionPolicy, string> = {
  read: "No answer required",
  "required-interaction": "Must complete",
  "optional-practice": "Practice can be skipped",
};
const starterTemplates: Record<LessonStarterTemplate, { label: string; description: string; icon: typeof BookOpen }> = {
  content: { label: "Article", description: "Heading and rich text", icon: BookOpen },
  image: { label: "Visual lesson", description: "Heading, image and text", icon: ImagePlus },
  quiz: { label: "Knowledge check", description: "Required single-choice question", icon: CircleHelp },
  practice: { label: "Guided practice", description: "Optional hands-on activity", icon: Dumbbell },
};
const splitLines = (value: string) => value.split("\n").map((item)=>item.trim()).filter(Boolean);

type CmsActionDialog = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  reasonLabel?: string;
  confirmationLabel?: string;
  confirmationHint?: string;
  requiredConfirmation?: string;
  onConfirm: (values: { reason: string; confirmation: string }) => void | Promise<void>;
};

type CmsRecovery =
  | { kind: "course"; entity: EditableCourse; savedAt: string }
  | { kind: "lesson"; entity: EditableLesson; savedAt: string };

type CmsMediaPicker = {
  kind: "image" | "video";
  currentUrl?: string;
  onSelect: (asset: MediaAsset) => void;
};

const localDraftKey = (kind: "course" | "lesson", id: string) => `coursiv.cms.local-draft.v1:${kind}:${id}`;

function readLocalRecovery(kind: "course", entity: EditableCourse): CmsRecovery | null;
function readLocalRecovery(kind: "lesson", entity: EditableLesson): CmsRecovery | null;
function readLocalRecovery(kind: "course" | "lesson", entity: EditableCourse | EditableLesson): CmsRecovery | null {
  try {
    const raw = window.localStorage.getItem(localDraftKey(kind, entity.id));
    if (!raw) return null;
    const stored = JSON.parse(raw) as { baseVersion?: number; savedAt?: string; entity?: EditableCourse | EditableLesson };
    if (stored.baseVersion !== entity.version || stored.entity?.id !== entity.id || !stored.savedAt) {
      window.localStorage.removeItem(localDraftKey(kind, entity.id));
      return null;
    }
    if (JSON.stringify(stored.entity) === JSON.stringify(entity)) {
      window.localStorage.removeItem(localDraftKey(kind, entity.id));
      return null;
    }
    if (kind === "lesson" && !Array.isArray((stored.entity as EditableLesson).screens)) {
      window.localStorage.removeItem(localDraftKey(kind, entity.id));
      return null;
    }
    return kind === "course"
      ? { kind, entity: stored.entity as EditableCourse, savedAt: stored.savedAt }
      : { kind, entity: stored.entity as EditableLesson, savedAt: stored.savedAt };
  } catch {
    window.localStorage.removeItem(localDraftKey(kind, entity.id));
    return null;
  }
}

function freshBlock(type: CoursivContentBlock["type"]): CoursivContentBlock {
  const id = `block-${crypto.randomUUID()}`;
  if (type === "heading") return { id, type, text: "New heading", level: 2 };
  if (type === "paragraph") return { id, type, text: "Write lesson content here." };
  if (type === "list") return { id, type, items: ["First item"], ordered: false };
  if (type === "callout") return { id, type, title: "Tip", text: "Add a useful callout.", tone: "tip" };
  if (type === "image") return { id, type, src: "", alt: "" };
  if (type === "video") return { id, type, src: "" };
  if (type === "single-choice" || type === "multi-choice") return { id, type, question: "New question", options: [{ id: `${id}-a`, label: "Correct answer", isCorrect: true }, { id: `${id}-b`, label: "Another answer", isCorrect: false }] };
  if (type === "true-false") return { id, type, question: "New statement", options: [{ id: `${id}-true`, label: "True", isCorrect: true }, { id: `${id}-false`, label: "False", isCorrect: false }] };
  if (type === "fill-in-blank") return { id, type, prompt: "Complete the sentence", template: "Add [answer]", placeholders: ["answer"], tokens: ["answer"], correctTokens: ["answer"] };
  if (type === "ordering-task") return { id, type, title: "Put these in order", items: ["First","Second"], correctItems: ["First","Second"] };
  if (type === "matching-pairs") return { id, type, title: "Match the pairs", pairs: [{ id: `${id}-a`, left: "First item", right: "First match" }, { id: `${id}-b`, left: "Second item", right: "Second match" }] };
  if (type === "prompt-fixer") return { id, type, title: "Improve the prompt", template: "A clear prompt", options: [{ id: `${id}-a`, label: "Best option", isCorrect: true }, { id: `${id}-b`, label: "Another option", isCorrect: false }] };
  if (type === "survey") return { id, type, question: "Choose one", options: [{ id: `${id}-a`, label: "First option" }, { id: `${id}-b`, label: "Second option" }] };
  if (type === "practice") return { id, type, title: "Practice", prompt: "Try this task" };
  if (type === "feedback") return { id, type, title: "Feedback", text: "Well done." };
  return { id, type: "paragraph", text: "" };
}

function replaceBlock(screen: CoursivLessonScreen, blockId: string, next: CoursivContentBlock) {
  return { ...screen, blocks: screen.blocks.map((block) => block.id === blockId ? next : block) };
}

function withScreens(lesson: EditableLesson, screens: CoursivLessonScreen[]): EditableLesson {
  return { ...lesson, screens, blocks: screens.flatMap((screen) => screen.blocks) };
}

function friendlyLessonErrors(lesson: EditableLesson, errors: string[]) {
  return errors.map((error)=>{
    let message=error;
    lesson.screens.forEach((screen,screenIndex)=>{
      message=message.replaceAll(screen.id,`Screen ${screenIndex+1}`);
      screen.blocks.forEach((block)=>{
        const label=block.type==="unknown"?"Unsupported content":blockMeta[block.type].label;
        message=message.replaceAll(block.id,`Screen ${screenIndex+1} · ${label}`);
        if("options" in block&&Array.isArray(block.options))block.options.forEach((option,optionIndex)=>{message=message.replaceAll(option.id,`answer ${optionIndex+1}`)});
        if(block.type==="matching-pairs")block.pairs.forEach((pair,pairIndex)=>{message=message.replaceAll(pair.id,`pair ${pairIndex+1}`)});
      });
    });
    return message;
  });
}

function cloneBlock(block: CoursivContentBlock): CoursivContentBlock {
  const copy={...block,id:`block-${crypto.randomUUID()}`} as CoursivContentBlock;
  if("options" in copy&&Array.isArray(copy.options))return{...copy,options:copy.options.map((option)=>({...option,id:`option-${crypto.randomUUID()}`}))} as CoursivContentBlock;
  if(copy.type==="matching-pairs")return{...copy,pairs:copy.pairs.map((pair)=>({...pair,id:`pair-${crypto.randomUUID()}`}))};
  return copy;
}

function BlockEditor({
  block,
  blockIndex,
  blockCount,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  requestAction,
  openMediaPicker,
}: {
  block: CoursivContentBlock;
  blockIndex: number;
  blockCount: number;
  onChange: (next: CoursivContentBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
  requestAction: (dialog: CmsActionDialog) => void;
  openMediaPicker: (picker: CmsMediaPicker) => void;
}) {
  const [uploading,setUploading]=useState(false);
  const [uploadError,setUploadError]=useState("");
  const set = (patch: object) => onChange({ ...block, ...patch } as CoursivContentBlock);
  const textArea = (label: string, value: string, key: string, help?: string) => <label>{label}<textarea value={value} onChange={(event)=>set({ [key]: event.target.value })}/>{help&&<small>{help}</small>}</label>;
  const richText = (label: string, value: string, key: string, placeholder?: string) => <RichTextEditor label={label} value={value} placeholder={placeholder} onChange={(next)=>set({[key]:next})}/>;
  const meta=block.type==="unknown"?{label:"Unsupported content",description:"Resolve this source content before publishing"}:blockMeta[block.type];
  const upload=async(file:File,kind:"image"|"video")=>{
    setUploading(true);setUploadError("");
    const form=new FormData();form.set("file",file);
    try{
      const response=await fetch("/api/admin/media",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:form});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Upload failed");
      if(kind==="image")set({src:data.asset.url,localSrc:data.asset.url});
      else set({src:data.asset.url});
    }catch(reason){setUploadError(reason instanceof Error?reason.message:"Upload failed")}
    finally{setUploading(false)}
  };
  return <article className="cms-block-editor">
    <header>
      <div><strong>{meta.label}</strong><small>{meta.description}</small></div>
      <div className="cms-block-actions">
        <button type="button" disabled={blockIndex===0} onClick={()=>onMove(-1)} aria-label={`Move ${meta.label} up`} title="Move up"><ArrowUp/></button>
        <button type="button" disabled={blockIndex===blockCount-1} onClick={()=>onMove(1)} aria-label={`Move ${meta.label} down`} title="Move down"><ArrowDown/></button>
        <button type="button" onClick={onDuplicate} aria-label={`Duplicate ${meta.label}`} title="Duplicate"><Copy/></button>
        <button type="button" disabled={blockCount<=1} onClick={()=>requestAction({title:`Delete ${meta.label.toLowerCase()}?`,description:"This block will be removed from the draft. The change only becomes live after you publish.",confirmLabel:"Delete block",tone:"danger",onConfirm:onDelete})} aria-label={`Delete ${meta.label}`} title={blockCount<=1?"Every screen needs at least one content block":"Delete"}><Trash2/></button>
      </div>
    </header>
    {block.type === "heading" && <><RichTextEditor inline label="Heading" value={block.text} onChange={(value)=>set({text:value})} placeholder="Add a heading…"/><label>Heading size<select value={block.level} onChange={(event)=>set({level:Number(event.target.value)})}><option value={1}>Large</option><option value={2}>Medium</option><option value={3}>Small</option><option value={4}>Smallest</option></select></label></>}
    {block.type === "paragraph" && richText("Content", block.text, "text", "Write the lesson content…")}
    {block.type === "list" && <><label>List items<textarea value={block.items.join("\n")} onChange={(event)=>set({items:splitLines(event.target.value)})}/><small>Put each item on a new line.</small></label><label className="cms-check-field"><input type="checkbox" checked={block.ordered} onChange={(event)=>set({ordered:event.target.checked})}/>Show as a numbered list</label></>}
    {block.type === "callout" && <><label>Optional title<input value={block.title??""} onChange={(event)=>set({title:event.target.value})}/></label>{richText("Callout content",block.text,"text","Add a useful tip or note…")}<label>Callout style<select value={block.tone??"tip"} onChange={(event)=>set({tone:event.target.value})}>{!["tip","note","warning","success"].includes(block.tone??"tip")&&<option value={block.tone}>{block.tone}</option>}<option value="tip">Tip</option><option value="note">Note</option><option value="warning">Warning</option><option value="success">Success</option></select></label></>}
    {block.type === "image" && <div className="cms-media-editor">{(block.localSrc||block.src)&&<Image unoptimized width={640} height={360} src={block.localSrc||block.src} alt={block.alt||"Image preview"}/>}<div className="cms-media-actions"><label className="cms-media-upload"><Upload/>{uploading?"Uploading…":"Upload image"}<input disabled={uploading} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event)=>{const file=event.target.files?.[0];if(file)void upload(file,"image")}}/></label><button type="button" onClick={()=>openMediaPicker({kind:"image",currentUrl:block.localSrc||block.src,onSelect:(asset)=>set({src:asset.url,localSrc:asset.url,alt:block.alt||asset.name||""})})}>Media library</button></div><label>Alternative text<input value={block.alt} onChange={(event)=>set({alt:event.target.value})}/><small>Describe the image for learners using a screen reader.</small></label><details className="cms-advanced-fields"><summary>Use an image URL instead</summary><label>Secure image URL<input value={block.localSrc??block.src} onChange={(event)=>set({src:event.target.value,localSrc:event.target.value})}/><small>For advanced use only. Uploading or choosing the media library is recommended.</small></label></details>{uploadError&&<p className="cms-inline-error">{uploadError}</p>}</div>}
    {block.type === "video" && <div className="cms-media-editor">{block.src&&<video controls playsInline poster={block.poster} src={block.src}/>}<div className="cms-media-actions"><label className="cms-media-upload"><Upload/>{uploading?"Uploading…":"Upload video"}<input disabled={uploading} type="file" accept="video/mp4,video/webm" onChange={(event)=>{const file=event.target.files?.[0];if(file)void upload(file,"video")}}/></label><button type="button" onClick={()=>openMediaPicker({kind:"video",currentUrl:block.src,onSelect:(asset)=>set({src:asset.url})})}>Media library</button></div><details className="cms-advanced-fields"><summary>Advanced video settings</summary><label>Secure video URL<input value={block.src} onChange={(event)=>set({src:event.target.value})}/></label><label>Optional poster image URL<input value={block.poster??""} onChange={(event)=>set({poster:event.target.value})}/></label></details>{uploadError&&<p className="cms-inline-error">{uploadError}</p>}</div>}
    {(block.type === "single-choice" || block.type === "multi-choice" || block.type === "true-false") && <>
      <RichTextEditor label={block.type==="true-false"?"Statement":"Question"} value={block.question} onChange={(value)=>set({question:value})} placeholder={block.type==="true-false"?"Write the statement…":"Write the question…"}/>
      {textArea("Optional instruction",block.instruction??"","instruction","For example: Choose every answer that applies.")}
      <div className="cms-option-list">
        {block.options.map((option,index)=><div className="cms-option-card" key={option.id}>
          <label className="cms-correct-choice"><input type={block.type==="multi-choice"?"checkbox":"radio"} name={`correct-${block.id}`} checked={option.isCorrect} onChange={(event)=>set({options:block.options.map((item,itemIndex)=>({...item,isCorrect:itemIndex===index?event.target.checked:block.type==="multi-choice"?item.isCorrect:false}))})}/><span>{option.isCorrect?"Correct answer":"Mark correct"}</span></label>
          <label>Answer text<input value={option.label} onChange={(event)=>set({options:block.options.map((item,itemIndex)=>itemIndex===index?{...item,label:event.target.value}:item)})}/></label>
          <label>Optional image URL<input value={option.image??""} onChange={(event)=>set({options:block.options.map((item,itemIndex)=>itemIndex===index?{...item,image:event.target.value||undefined}:item)})}/></label>
          <button type="button" disabled={block.type==="true-false"||block.options.length<=2} onClick={()=>set({options:block.options.filter((_,itemIndex)=>itemIndex!==index)})} aria-label={`Delete answer ${index+1}`}><Trash2/></button>
        </div>)}
      </div>
      {block.type!=="true-false"&&<button type="button" className="cms-inline-add" onClick={()=>set({options:[...block.options,{id:`${block.id}-${crypto.randomUUID()}`,label:"New answer",isCorrect:false}]})}><Plus/>Add answer</button>}
      {textArea("Optional hint",block.hint??"","hint")}
      <RichTextEditor label="Correct feedback" value={block.feedbackCorrect?.text??""} onChange={(value)=>set({feedbackCorrect:{...block.feedbackCorrect,text:value}})}/>
      <RichTextEditor label="Incorrect feedback" value={block.feedbackIncorrect?.text??""} onChange={(value)=>set({feedbackIncorrect:{...block.feedbackIncorrect,text:value}})}/>
    </>}
    {block.type === "fill-in-blank" && <>
      {textArea("Instruction",block.prompt,"prompt")}
      <div><RichTextEditor label="Sentence with blanks" value={block.template} onChange={(template)=>{const placeholders=[...template.matchAll(/\[([^\]]+)\]/g)].map((match)=>match[1]);set({template,placeholders})}} placeholder="AI can [save] time."/><small>Wrap each blank in square brackets, for example: AI can [save] time.</small></div>
      <p className="cms-field-help">{block.placeholders.length} {block.placeholders.length===1?"blank":"blanks"} detected</p>
      <label>Answer choices<textarea value={block.tokens.join("\n")} onChange={(event)=>set({tokens:splitLines(event.target.value)})}/><small>Put each available answer on a new line.</small></label>
      <label>Correct answers, in blank order<textarea value={block.correctTokens.join("\n")} onChange={(event)=>set({correctTokens:splitLines(event.target.value)})}/><small>Put one answer per line in the same order as the blanks.</small></label>
      <RichTextEditor label="Example response" value={block.exampleResponse??""} onChange={(value)=>set({exampleResponse:value})}/>
      <RichTextEditor label="Success feedback" value={block.feedback?.text??""} onChange={(value)=>set({feedback:{...block.feedback,text:value}})}/>
    </>}
    {block.type === "ordering-task" && <>{textArea("Task title",block.title,"title")}{textArea("Optional instruction",block.prompt??"","prompt")}<label>Correct order<textarea value={block.correctItems.join("\n")} onChange={(event)=>{const items=splitLines(event.target.value);set({items,correctItems:items})}}/><small>Put each step on a new line, already arranged in the correct order.</small></label>{textArea("Optional hint",block.hint??"","hint")}<RichTextEditor label="Correct feedback" value={block.feedbackCorrect?.text??""} onChange={(value)=>set({feedbackCorrect:{...block.feedbackCorrect,text:value}})}/><RichTextEditor label="Incorrect feedback" value={block.feedbackIncorrect?.text??""} onChange={(value)=>set({feedbackIncorrect:{...block.feedbackIncorrect,text:value}})}/></>}
    {block.type === "matching-pairs" && <>{textArea("Task title",block.title,"title")}{textArea("Optional instruction",block.prompt??"","prompt")}<div className="cms-option-list">{block.pairs.map((pair,index)=><div className="cms-pair-card" key={pair.id}><label>Left item<input value={pair.left} onChange={(event)=>set({pairs:block.pairs.map((item,itemIndex)=>itemIndex===index?{...item,left:event.target.value}:item)})}/></label><span>matches</span><label>Right item<input value={pair.right} onChange={(event)=>set({pairs:block.pairs.map((item,itemIndex)=>itemIndex===index?{...item,right:event.target.value}:item)})}/></label><button type="button" disabled={block.pairs.length<=1} onClick={()=>set({pairs:block.pairs.filter((_,itemIndex)=>itemIndex!==index)})} aria-label={`Delete pair ${index+1}`}><Trash2/></button></div>)}</div><button type="button" className="cms-inline-add" onClick={()=>set({pairs:[...block.pairs,{id:`${block.id}-${crypto.randomUUID()}`,left:"New item",right:"Matching item"}]})}><Plus/>Add pair</button></>}
    {block.type === "prompt-fixer" && <>{textArea("Task title",block.title,"title")}{textArea("Optional instruction",block.prompt??"","prompt")}{textArea("Prompt to improve",block.template,"template")}<div className="cms-option-list">{block.options.map((option,index)=><div className="cms-prompt-option-card" key={option.id}><label className="cms-correct-choice"><input type="radio" name={`correct-${block.id}`} checked={option.isCorrect} onChange={()=>set({options:block.options.map((item,itemIndex)=>({...item,isCorrect:itemIndex===index}))})}/><span>{option.isCorrect?"Best answer":"Mark as best"}</span></label><label>Improvement option<input value={option.label} onChange={(event)=>set({options:block.options.map((item,itemIndex)=>itemIndex===index?{...item,label:event.target.value}:item)})}/></label><label>Optional example output<textarea value={option.outputText??""} onChange={(event)=>set({options:block.options.map((item,itemIndex)=>itemIndex===index?{...item,outputText:event.target.value||undefined}:item)})}/></label><label>Optional output image URL<input value={option.outputLocalImage??option.outputImage??""} onChange={(event)=>set({options:block.options.map((item,itemIndex)=>itemIndex===index?{...item,outputImage:event.target.value||undefined,outputLocalImage:event.target.value||undefined}:item)})}/></label><button type="button" disabled={block.options.length<=2} onClick={()=>set({options:block.options.filter((_,itemIndex)=>itemIndex!==index)})} aria-label={`Delete option ${index+1}`}><Trash2/></button></div>)}</div><button type="button" className="cms-inline-add" onClick={()=>set({options:[...block.options,{id:`${block.id}-${crypto.randomUUID()}`,label:"New improvement",isCorrect:false}]})}><Plus/>Add improvement option</button>{textArea("Optional hint",block.hint??"","hint")}<RichTextEditor label="Correct feedback" value={block.feedbackCorrect?.text??""} onChange={(value)=>set({feedbackCorrect:{...block.feedbackCorrect,text:value}})}/><RichTextEditor label="Incorrect feedback" value={block.feedbackIncorrect?.text??""} onChange={(value)=>set({feedbackIncorrect:{...block.feedbackIncorrect,text:value}})}/></>}
    {block.type === "survey" && <><RichTextEditor label="Survey question" value={block.question} onChange={(value)=>set({question:value})} placeholder="Write the survey question…"/><div className="cms-option-list">{block.options.map((option,index)=><div className="cms-survey-option-card" key={option.id}><label>Option {index+1}<input value={option.label} onChange={(event)=>set({options:block.options.map((item,itemIndex)=>itemIndex===index?{...item,label:event.target.value}:item)})}/></label><button type="button" disabled={block.options.length<=2} onClick={()=>set({options:block.options.filter((_,itemIndex)=>itemIndex!==index)})} aria-label={`Delete survey option ${index+1}`}><Trash2/></button></div>)}</div><button type="button" className="cms-inline-add" onClick={()=>set({options:[...block.options,{id:`${block.id}-${crypto.randomUUID()}`,label:"New option"}]})}><Plus/>Add survey option</button></>}
    {block.type === "practice" && <>{textArea("Practice title",block.title,"title")}{textArea("Task instruction",block.prompt??"","prompt")}<label>Internal practice key <small>advanced</small><input value={block.practiceType??""} onChange={(event)=>set({practiceType:event.target.value})}/><small>Keep the existing value unless a developer asks you to change it.</small></label></>}
    {block.type === "feedback" && <>{textArea("Optional title",block.title??"","title")}{richText("Feedback content",block.text,"text")}</>}
    {block.type === "unknown" && <p className="cms-inline-error">This source block is not supported yet. Its raw data is preserved, but the lesson cannot be published until it is resolved.</p>}
  </article>;
}

function PreviewFeedback({ title, text }: { title?: string; text?: string }) {
  if (!text) return null;
  return <aside className="cms-preview-answer"><strong>{title ?? "Feedback"}</strong><SafeRichText value={text} className="cms-preview-rich-text"/></aside>;
}

function PreviewBlock({ block, showAnswers }: { block: CoursivContentBlock; showAnswers: boolean }) {
  if (block.type === "heading") return <SafeRichText value={block.text} inline as={block.level <= 2 ? "h2" : "h3"}/>;
  if (block.type === "paragraph") return <SafeRichText value={block.text} className="cms-preview-rich-text"/>;
  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return <Tag>{block.items.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</Tag>;
  }
  if (block.type === "callout") return <aside className={`cms-preview-callout ${block.tone??""}`}>{block.title&&<strong>{block.title}</strong>}<SafeRichText value={block.text} className="cms-preview-rich-text"/></aside>;
  if (block.type === "image") return (block.localSrc||block.src)?<figure><Image unoptimized width={640} height={360} src={block.localSrc||block.src} alt={block.alt}/>{block.alt&&<figcaption>{block.alt}</figcaption>}</figure>:<em>Image required before publishing</em>;
  if (block.type === "video") return <video controls playsInline poster={block.poster} src={block.src}/>;
  if (block.type === "single-choice" || block.type === "multi-choice" || block.type === "true-false") return <div className="cms-preview-question"><SafeRichText value={block.question} as="strong"/>{block.instruction&&<p>{block.instruction}</p>}{block.options.map((option)=><span className={showAnswers&&option.isCorrect?"correct":""} key={option.id}><i/>{option.image&&<Image unoptimized width={100} height={60} src={option.image} alt=""/>}{option.label||"Image answer"}{showAnswers&&option.isCorrect&&<b>Correct</b>}</span>)}{showAnswers&&<><PreviewFeedback title={block.feedbackCorrect?.title??"Correct feedback"} text={block.feedbackCorrect?.text}/>{block.hint&&<aside className="cms-preview-answer hint"><strong>Hint</strong><p>{block.hint}</p></aside>}</>}</div>;
  if (block.type === "fill-in-blank") return <div className="cms-preview-question"><strong>{block.prompt}</strong><SafeRichText value={block.template} className="cms-preview-rich-text"/><div>{block.tokens.map((token,index)=><span key={`${token}-${index}`}>{token}</span>)}</div>{showAnswers&&<aside className="cms-preview-answer"><strong>Answer key</strong><p>{block.correctTokens.join(" · ")}</p>{block.exampleResponse&&<SafeRichText value={block.exampleResponse} className="cms-preview-rich-text"/>}</aside>}{showAnswers&&<PreviewFeedback title={block.feedback?.title??"Success feedback"} text={block.feedback?.text}/>}</div>;
  if (block.type === "ordering-task") return <div className="cms-preview-question"><strong>{block.title}</strong>{block.prompt&&<p>{block.prompt}</p>}<ol>{block.items.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ol>{showAnswers&&<aside className="cms-preview-answer"><strong>Correct order</strong><ol>{block.correctItems.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ol></aside>}{showAnswers&&<PreviewFeedback title={block.feedbackCorrect?.title??"Correct feedback"} text={block.feedbackCorrect?.text}/>}</div>;
  if (block.type === "matching-pairs") {
    const choices=block.pairs.map((pair)=>pair.right);
    const previewChoices=choices.length>1?[...choices.slice(1),choices[0]]:choices;
    return <div className="cms-preview-question"><strong>{block.title}</strong>{block.prompt&&<p>{block.prompt}</p>}{block.pairs.map((pair,index)=><span className={showAnswers?"correct":""} key={pair.id}>{pair.left}<b>→</b>{showAnswers?pair.right:previewChoices[index]}</span>)}{showAnswers&&<aside className="cms-preview-answer"><strong>Answer key</strong><p>Pairs are shown in their correct matches.</p></aside>}</div>;
  }
  if (block.type === "prompt-fixer") return <div className="cms-preview-question"><strong>{block.title}</strong>{block.prompt&&<p>{block.prompt}</p>}<p>{block.template}</p>{block.options.map((option)=><span className={showAnswers&&option.isCorrect?"correct":""} key={option.id}><i/>{option.label}{showAnswers&&option.isCorrect&&<b>Best answer</b>}</span>)}{showAnswers&&<><PreviewFeedback title={block.feedbackCorrect?.title??"Correct feedback"} text={block.feedbackCorrect?.text}/>{block.hint&&<aside className="cms-preview-answer hint"><strong>Hint</strong><p>{block.hint}</p></aside>}</>}</div>;
  if (block.type === "survey") return <div className="cms-preview-question"><SafeRichText value={block.question} as="strong"/>{block.options.map((option)=><span key={option.id}><i/>{option.label}</span>)}</div>;
  if (block.type === "practice") return <div className="cms-preview-practice"><small>PRACTICE</small><strong>{block.title}</strong>{block.prompt&&<p>{block.prompt}</p>}</div>;
  if (block.type === "feedback") return <div className="cms-preview-callout"><strong>{block.title??"Feedback"}</strong><SafeRichText value={block.text} className="cms-preview-rich-text"/></div>;
  return <div className="cms-preview-unknown">Unsupported source block: {"sourceType" in block ? block.sourceType : block.type}</div>;
}

function LessonPreview({ lesson, mobile }: { lesson: EditableLesson; mobile: boolean }) {
  const [screenIndex,setScreenIndex]=useState(0);
  const [showAnswers,setShowAnswers]=useState(false);
  const readiness=useMemo(()=>lessonPreviewReadiness(lesson),[lesson]);
  const hasAnswerKeys=useMemo(()=>lesson.screens.some((screen)=>screen.blocks.some(blockHasAnswerKey)),[lesson.screens]);
  const currentIndex=Math.min(screenIndex,Math.max(lesson.screens.length-1,0));
  const screen=lesson.screens[currentIndex];
  const move=(next:number)=>{
    setScreenIndex(Math.max(0,Math.min(next,lesson.screens.length-1)));
    document.querySelector<HTMLElement>(".cms-editor")?.scrollTo({top:0,behavior:"smooth"});
  };
  return <div className="cms-lesson-preview-shell">
    <section className={`cms-preview-health ${readiness.ready?"ready":"issues"}`}>
      <div>{readiness.ready?<CheckCircle2/>:<AlertTriangle/>}<span><strong>{readiness.ready?"Ready to publish":`${readiness.errors.length} content issues`}</strong><small>{readiness.ready?"Every required field and answer key is complete.":"Fix the listed fields before publishing."}</small></span></div>
      <dl><div><dt>{readiness.screens}</dt><dd>Screens</dd></div><div><dt>{readiness.blocks}</dt><dd>Blocks</dd></div><div><dt>{readiness.interactions}</dt><dd>Activities</dd></div><div><dt>{readiness.images+readiness.videos}</dt><dd>Media</dd></div></dl>
      {!readiness.ready&&<details><summary>Review issues</summary><ul>{friendlyLessonErrors(lesson,readiness.errors).map((error)=><li key={error}>{error}</li>)}</ul></details>}
    </section>
    <div className="cms-preview-toolbar">
      <label>Preview screen<select aria-label="Preview screen" value={currentIndex} onChange={(event)=>move(Number(event.target.value))}>{lesson.screens.map((item,index)=><option value={index} key={item.id}>{index+1}. {screenEditorLabel(item,index).label}</option>)}</select></label>
      {hasAnswerKeys&&<button type="button" className={showAnswers?"active":""} aria-pressed={showAnswers} onClick={()=>setShowAnswers((current)=>!current)}>{showAnswers?<EyeOff/>:<Eye/>}{showAnswers?"Hide answers":"Check answers"}</button>}
    </div>
    {screen&&<div className={`cms-preview cms-lesson-preview ${mobile?"mobile":""}`}>
      <header><div><small>EDITOR PREVIEW</small><strong>{lesson.title}</strong></div><span>{currentIndex+1} of {lesson.screens.length}</span></header>
      <div className="cms-preview-progress" aria-label={`Screen ${currentIndex+1} of ${lesson.screens.length}`}><i style={{width:`${((currentIndex+1)/lesson.screens.length)*100}%`}}/></div>
      <section>
        <div className="cms-preview-screen-meta"><span>{screen.presentation}</span><span>{policyLabels[screen.interactionPolicy]}</span></div>
        {screen.title&&<h2>{screen.title}</h2>}
        <div className="cms-preview-blocks">{screen.blocks.map((block)=><PreviewBlock block={block} showAnswers={showAnswers} key={block.id}/>)}</div>
      </section>
      <footer>
        <button type="button" disabled={currentIndex===0} onClick={()=>move(currentIndex-1)}><ArrowLeft/>Previous</button>
        <span>Preview only · progress is not saved</span>
        <button type="button" className="primary" disabled={currentIndex===lesson.screens.length-1} onClick={()=>move(currentIndex+1)}>{screen.interactionPolicy==="required-interaction"?"Submit answer":"Continue"}<ArrowRight/></button>
      </footer>
    </div>}
  </div>;
}

function CoursePreview({ course, mobile }: { course: EditableCourse; mobile: boolean }) {
  const cover=course.image||course.localImage;
  return <div className={`cms-preview course-metadata-preview ${mobile?"mobile":""}`}><header>LEARNER CATALOG<span>{mobile?"393 px":"Desktop"}</span></header><section>{cover?<Image unoptimized width={720} height={400} src={cover} alt={course.imageAlt||course.title}/>:<div className="cms-cover-placeholder">{course.title.slice(0,2).toUpperCase()}</div>}<small>{course.kind==="tool"?"AI TOOL":"USE CASE"} · {course.status}</small><h2>{course.title}</h2><p>{course.lessonCount} lessons · {course.duration}</p><div className="cms-category-preview">{course.categories.map((category)=><span key={category}>{category}</span>)}</div></section></div>;
}

function CourseCategoryPicker({
  value,
  options,
  onChange,
  optional = false,
}: {
  value: string[];
  options: CourseCategoryOption[];
  onChange: (categories: string[]) => void;
  optional?: boolean;
}) {
  const [draft,setDraft]=useState("");
  const [error,setError]=useState("");
  const [expanded,setExpanded]=useState(false);
  const suggestion=useMemo(()=>closestCourseCategory(draft,options),[draft,options]);
  const isExact=Boolean(suggestion&&categoryKey(suggestion.name)===categoryKey(draft));
  const visibleOptions=(expanded?options:options.slice(0,12));
  const add=(input:string,forceNew=false)=>{
    const result=addCourseCategory(value,input,options,forceNew);
    setError(result.error);
    if(!result.error){onChange(result.categories);setDraft("")}
  };
  const toggle=(name:string)=>{
    const selected=value.some((category)=>categoryKey(category)===categoryKey(name));
    if(selected){onChange(value.filter((category)=>categoryKey(category)!==categoryKey(name)));setError("");return}
    add(name);
  };
  const primaryName=suggestion?.name??draft;
  return <section className="cms-category-picker">
    <header><div><Tags/><span><strong>Categories {optional&&<small>optional</small>}</strong><small>Choose existing categories to prevent spelling duplicates.</small></span></div><b>{value.length}/10 selected</b></header>
    {value.length>0?<div className="cms-category-selected" aria-label="Selected categories">{value.map((category)=><button type="button" key={categoryKey(category)} onClick={()=>toggle(category)} aria-label={`Remove category ${category}`}>{category}<X/></button>)}</div>:<p className="cms-category-empty">No categories selected yet.</p>}
    <div className="cms-category-create">
      <label>Find or create a category<input maxLength={40} value={draft} onChange={(event)=>{setDraft(event.target.value);setError("")}} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();if(primaryName.trim())add(primaryName)}}} placeholder="For example: Artificial Intelligence"/></label>
      <button type="button" disabled={!draft.trim()||value.length>=10} onClick={()=>add(primaryName)}><Plus/>{suggestion&&!isExact?"Use suggestion":"Add category"}</button>
    </div>
    {draft.trim()&&suggestion&&!isExact&&<aside className="cms-category-suggestion"><span><strong>Possible spelling match</strong><small>Did you mean “{suggestion.name}”?</small></span><button type="button" onClick={()=>add(suggestion.name)}>Use “{suggestion.name}”</button><button type="button" className="secondary" onClick={()=>add(draft,true)}>Create “{draft.trim()}” instead</button></aside>}
    {error&&<p className="cms-inline-error" role="alert">{error}</p>}
    {options.length>0&&<div className="cms-category-cloud"><div><strong>Existing categories</strong><small>Number shows how many courses use it.</small></div><div>{visibleOptions.map((option)=>{
      const selected=value.some((category)=>categoryKey(category)===categoryKey(option.name));
      return <button type="button" className={selected?"selected":""} disabled={!selected&&value.length>=10} aria-pressed={selected} onClick={()=>toggle(option.name)} key={categoryKey(option.name)}>{selected&&<CheckCircle2/>}{option.name}<small>{option.count}</small></button>;
    })}</div>{options.length>12&&<button type="button" className="cms-category-more" onClick={()=>setExpanded((current)=>!current)}>{expanded?"Show popular only":`Show all ${options.length} categories`}</button>}</div>}
  </section>;
}

function CourseEditor({course,categoryOptions,onChange,onArchive,onRestore,onDelete,onOpenCatalogOrder,openMediaPicker,requestAction}:{course:EditableCourse;categoryOptions:CourseCategoryOption[];onChange:(next:EditableCourse)=>void;onArchive:()=>void;onRestore:()=>void;onDelete:()=>void;onOpenCatalogOrder:()=>void;openMediaPicker:(picker:CmsMediaPicker)=>void;requestAction:(dialog:CmsActionDialog)=>void}) {
  const set=(patch:Partial<EditableCourse>)=>onChange({...course,...patch});
  const cover=course.image||course.localImage;
  const units=[...course.unitSummaries].sort((a,b)=>a.order-b.order);
  const setUnits=(next:typeof units)=>set({unitSummaries:next.map((unit,order)=>({...unit,order}))});
  const moveUnit=(index:number,direction:-1|1)=>{const target=index+direction;if(target<0||target>=units.length)return;const next=[...units];const [moved]=next.splice(index,1);next.splice(target,0,moved);setUnits(next)};
  return <div className="cms-course-settings">
    <div className="cms-lesson-header"><div><small>COURSE SETTINGS</small><h2>{course.title}</h2><details className="cms-technical-details"><summary>Technical details</summary><code>Course ID: {course.id}</code></details></div><span>Version {course.version}<br/>{formatCmsUpdatedAt(course.updatedAt,course.updatedBy)}</span></div>
    <div className="cms-warning"><AlertTriangle/>Course ID and learner URL are locked. Changing the title will not reset progress or certificates.</div>
    <section className="cms-settings-card"><h3>Catalog information</h3>
      <label>Course title<input maxLength={120} value={course.title} onChange={(event)=>set({title:event.target.value})}/><small>{course.title.length}/120</small></label>
      <div className="cms-settings-grid"><label>Course type<select disabled={course.status!=="draft"} value={course.kind} onChange={(event)=>set({kind:event.target.value as EditableCourse["kind"]})}><option value="tool">AI tool</option><option value="use-case">Use case</option></select></label><label>Duration<input maxLength={40} value={course.duration} onChange={(event)=>set({duration:event.target.value})}/></label><label>Publishing status<select disabled={course.status==="archived"} value={course.status} onChange={(event)=>set({status:event.target.value as EditableCourse["status"]})}><option value="draft">Draft</option><option value="published">Published</option>{course.status==="archived"&&<option value="archived">Archived</option>}</select></label></div>
      <CourseCategoryPicker value={course.categories} options={categoryOptions} onChange={(categories)=>set({categories})}/>
    </section>
    <section className="cms-settings-card"><div className="cms-settings-title"><div><h3>Course sections</h3><p className="cms-settings-help">Sections group lessons on the course map. Rename or reorder them without changing learner progress.</p></div><Layers3/></div>
      <div className="cms-unit-list">{units.map((unit,index)=>{
        const lessonCount=course.lessonSummaries.filter((lesson)=>lesson.sourceUnitId===unit.sourceId).length;
        return <div className="cms-unit-row" key={unit.sourceId}>
          <span>{index+1}</span>
          <label>Section name<input maxLength={120} value={unit.title??""} onChange={(event)=>setUnits(units.map((item,itemIndex)=>itemIndex===index?{...item,title:event.target.value}:item))}/><small>{lessonCount} {lessonCount===1?"lesson":"lessons"}</small></label>
          <div><button type="button" disabled={index===0} onClick={()=>moveUnit(index,-1)} aria-label={`Move section ${index+1} up`}><ArrowUp/></button><button type="button" disabled={index===units.length-1} onClick={()=>moveUnit(index,1)} aria-label={`Move section ${index+1} down`}><ArrowDown/></button><button type="button" disabled={lessonCount>0||units.length<=1} title={lessonCount>0?"Move its lessons before deleting this section":"Delete section"} onClick={()=>requestAction({title:`Delete “${unit.title||`Section ${index+1}`}”?`,description:"This empty section will be removed from the draft. The change becomes live only after publishing the course.",confirmLabel:"Delete section",tone:"danger",onConfirm:()=>setUnits(units.filter((item)=>item.sourceId!==unit.sourceId))})} aria-label={`Delete section ${index+1}`}><Trash2/></button></div>
        </div>;
      })}</div>
      <button type="button" className="cms-inline-add" onClick={()=>setUnits([...units,{sourceId:`cms-unit-${crypto.randomUUID()}`,title:"New section",order:units.length}])}><Plus/>Add course section</button>
    </section>
    <section className="cms-settings-card"><h3>Course cover</h3><div className="cms-cover-editor">{cover?<Image unoptimized width={360} height={210} src={cover} alt={course.imageAlt||course.title}/>:<div className="cms-cover-placeholder">{course.title.slice(0,2).toUpperCase()}</div>}<div><label className="cms-upload-button"><Upload/>Upload new cover<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async(event)=>{const file=event.target.files?.[0];if(!file)return;const form=new FormData();form.set("file",file);const response=await fetch("/api/admin/media",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:form});const data=await response.json();if(response.ok)set({image:data.asset.url,coverAssetId:data.asset.id,imageAlt:course.imageAlt||course.title})}}/></label><button type="button" onClick={()=>openMediaPicker({kind:"image",currentUrl:cover,onSelect:(asset)=>set({image:asset.url,coverAssetId:asset.id,imageAlt:course.imageAlt||asset.name||course.title})})}>Choose from media library</button>{course.image&&<button onClick={()=>set({image:"",coverAssetId:""})}>Remove custom cover</button>}<details className="cms-advanced-fields"><summary>Use a cover URL instead</summary><label>Secure cover URL<input value={course.image??""} onChange={(event)=>set({image:event.target.value,coverAssetId:""})}/></label></details></div></div><label>Alternative text<input maxLength={160} value={course.imageAlt??""} onChange={(event)=>set({imageAlt:event.target.value})}/><small>Describe the cover for learners using a screen reader.</small></label></section>
    <section className="cms-settings-card cms-catalog-link"><div><h3>Catalog order</h3><p className="cms-settings-help">Current position: {course.displayOrder+1}. Manage the complete catalog in one drag-and-drop workspace.</p></div><button type="button" onClick={onOpenCatalogOrder}><ListOrdered/>Open Catalog Order</button></section>
    <section className="cms-settings-card cms-danger-zone"><h3>Danger zone</h3><p>Archiving hides this course from catalogs while preserving direct links, learner progress and certificates.</p>{course.status==="archived"?<button onClick={onRestore}><RotateCcw/>Restore course</button>:<button onClick={onArchive}><Archive/>Archive course</button>}<button className="danger" disabled={course.status!=="draft"||course.lessonCount!==0} onClick={onDelete}><Trash2/>Permanently delete empty draft</button></section>
  </div>;
}

function ScreenEditor({
  screen,
  screenIndex,
  onChange,
  onDuplicate,
  onDelete,
  onDrop,
  requestAction,
  canDelete,
  onMove,
  canMoveUp,
  canMoveDown,
  openMediaPicker,
}: {
  screen: CoursivLessonScreen;
  screenIndex: number;
  onChange: (next: CoursivLessonScreen) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDrop: (sourceId: string) => void;
  requestAction: (dialog: CmsActionDialog) => void;
  canDelete: boolean;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  openMediaPicker: (picker: CmsMediaPicker) => void;
}) {
  const editorLabel=screenEditorLabel(screen,screenIndex);
  return <section className="cms-screen expanded cms-screen-tab-panel" data-cms-screen-id={screen.id} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();onDrop(event.dataTransfer.getData("text/plain"))}}>
    <header>
      <span className="cms-screen-number" aria-label={`Screen ${screenIndex+1}`}><b>{screenIndex+1}</b></span>
      <div className="cms-screen-identity">
        <span><strong>{editorLabel.label}</strong>{editorLabel.source==="generated"&&<em>Auto label</em>}</span>
        <small>{editorLabel.contents} · {policyLabels[screen.interactionPolicy]}</small>
      </div>
      <button type="button" disabled={!canMoveUp} onClick={()=>onMove(-1)} aria-label={`Move screen ${screenIndex+1} up`} title="Move screen up"><ArrowUp/></button>
      <button type="button" disabled={!canMoveDown} onClick={()=>onMove(1)} aria-label={`Move screen ${screenIndex+1} down`} title="Move screen down"><ArrowDown/></button>
      <button type="button" onClick={onDuplicate} aria-label={`Duplicate screen ${screenIndex+1}`} title="Duplicate screen"><Copy/></button>
      <button type="button" disabled={!canDelete} onClick={onDelete} aria-label={`Delete screen ${screenIndex+1}`} title={canDelete?"Delete screen":"Every lesson needs at least one screen"}><Trash2/></button>
    </header>
    <>
      <div className="cms-screen-settings">
        <label className="cms-screen-title-setting">Optional learner-facing title<input maxLength={160} placeholder={`For example: ${editorLabel.label}`} value={screen.title??""} onChange={(event)=>onChange({...screen,title:event.target.value})}/><small>Leave blank to let the lesson content lead. The “{editorLabel.label}” label above is generated for editors and is not published.</small></label>
        <label>Screen layout<select value={screen.presentation} onChange={(event)=>onChange({...screen,presentation:event.target.value as CoursivLessonScreen["presentation"]})}><option value="content">Standard content</option><option value="media">Media focus</option><option value="callout">Highlighted message</option><option value="knowledge-check">Knowledge check</option><option value="practice">Practice workspace</option></select></label>
        <label>Learner requirement<select value={screen.interactionPolicy} onChange={(event)=>onChange({...screen,interactionPolicy:event.target.value as CoursivInteractionPolicy})}>{policies.map((value)=><option value={value} key={value}>{policyLabels[value]}</option>)}</select></label>
        <details className="cms-advanced-fields"><summary>Advanced audio settings</summary><label>Audio URL <small>optional</small><input value={screen.audioSource??""} onChange={(event)=>onChange({...screen,audioSource:event.target.value||undefined})}/><small>Leave this unchanged unless a prepared narration file is available.</small></label></details>
      </div>
      {screen.blocks.map((block,blockIndex)=><BlockEditor
        block={block}
        blockIndex={blockIndex}
        blockCount={screen.blocks.length}
        key={block.id}
        onChange={(next)=>onChange(replaceBlock(screen,block.id,next))}
        onDelete={()=>onChange({...screen,blocks:screen.blocks.filter((value)=>value.id!==block.id)})}
        onDuplicate={()=>{const blocks=[...screen.blocks];blocks.splice(blockIndex+1,0,cloneBlock(block));onChange({...screen,blocks})}}
        onMove={(direction)=>{const target=blockIndex+direction;if(target<0||target>=screen.blocks.length)return;const blocks=[...screen.blocks];const [moved]=blocks.splice(blockIndex,1);blocks.splice(target,0,moved);onChange({...screen,blocks})}}
        requestAction={requestAction}
        openMediaPicker={openMediaPicker}
      />)}
      <details className="cms-add-block">
        <summary><Plus/>Add content</summary>
        <div className="cms-block-picker">{blockGroups.map((group)=><section key={group.label}><strong>{group.label}</strong><div>{group.types.map((type)=><button type="button" key={type} onClick={(event)=>{onChange({...screen,blocks:[...screen.blocks,freshBlock(type)]});event.currentTarget.closest("details")?.removeAttribute("open")}}><b>{blockMeta[type].label}</b><small>{blockMeta[type].description}</small></button>)}</div></section>)}</div>
      </details>
    </>
  </section>;
}

type CatalogDraft = Record<"tool"|"use-case", string[]>;

function CatalogOrderWorkspace({courses,draft,onChange,onSave,onDiscard,busy}:{courses:AdminCourseSummary[];draft:CatalogDraft;onChange:(next:CatalogDraft)=>void;onSave:()=>void;onDiscard:()=>void;busy:boolean}) {
  const courseMap=useMemo(()=>new Map(courses.map((item)=>[item.id,item])),[courses]);
  const move=(kind:"tool"|"use-case",fromId:string,toId:string)=>{
    if(!fromId||fromId===toId)return;
    const ordered=[...draft[kind]];const from=ordered.indexOf(fromId);const to=ordered.indexOf(toId);
    if(from<0||to<0)return;const [item]=ordered.splice(from,1);ordered.splice(to,0,item);onChange({...draft,[kind]:ordered});
  };
  const nudge=(kind:"tool"|"use-case",id:string,direction:-1|1)=>{
    const ordered=[...draft[kind]];const from=ordered.indexOf(id);const to=from+direction;
    if(from<0||to<0||to>=ordered.length)return;const [item]=ordered.splice(from,1);ordered.splice(to,0,item);onChange({...draft,[kind]:ordered});
  };
  const dirty=JSON.stringify(draft.tool)!==JSON.stringify(courses.filter((item)=>item.kind==="tool"&&item.status!=="archived").sort((a,b)=>a.displayOrder-b.displayOrder).map((item)=>item.id))||JSON.stringify(draft["use-case"])!==JSON.stringify(courses.filter((item)=>item.kind==="use-case"&&item.status!=="archived").sort((a,b)=>a.displayOrder-b.displayOrder).map((item)=>item.id));
  return <main className="cms-catalog-order">
    <header><div><small>CATALOG WORKSPACE</small><h2>Arrange the learner catalog</h2><p>Drag a course to its new position. Nothing changes until you save the complete order.</p></div><div><button type="button" disabled={busy||!dirty} onClick={onDiscard}>Discard</button><button data-catalog-save type="button" className="primary" disabled={busy||!dirty} onClick={onSave}><Save/>{busy?"Saving…":"Save order"}</button></div></header>
    <div className="cms-catalog-columns">{(["tool","use-case"] as const).map((kind)=><section key={kind}>
      <div><h3>{kind==="tool"?"AI Tools":"Use Cases"}</h3><span>{draft[kind].length} courses</span></div>
      <ol>{draft[kind].map((id,index)=>{const item=courseMap.get(id);if(!item)return null;return <li key={id} draggable onDragStart={(event)=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/catalog-course-id",id)}} onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="move"}} onDrop={(event)=>{event.preventDefault();move(kind,event.dataTransfer.getData("text/catalog-course-id"),id)}}>
        <GripVertical aria-hidden="true"/><b>{index+1}</b>{(item.image||item.localImage)?<Image unoptimized width={56} height={40} src={item.image||item.localImage!} alt=""/>:<i>{item.title.slice(0,2).toUpperCase()}</i>}<span><strong>{item.title}</strong><small>{item.lessonCount} lessons · {item.status}</small></span><div><button type="button" disabled={index===0} onClick={()=>nudge(kind,id,-1)} aria-label={`Move ${item.title} earlier`}><ArrowUp/></button><button type="button" disabled={index===draft[kind].length-1} onClick={()=>nudge(kind,id,1)} aria-label={`Move ${item.title} later`}><ArrowDown/></button></div>
      </li>})}</ol>
    </section>)}</div>
    {courses.some((item)=>item.status==="archived")&&<section className="cms-catalog-archived"><h3>Archived courses</h3><p>{courses.filter((item)=>item.status==="archived").map((item)=>item.title).join(" · ")}</p><small>Archived courses do not appear in the learner catalog and are not part of the saved order.</small></section>}
  </main>;
}

export function ContentCmsPage() {
  const [courses,setCourses]=useState<AdminCourseSummary[]>([]);
  const [loadingCourses,setLoadingCourses]=useState(true);
  const [courseId,setCourseId]=useState("");
  const [course,setCourse]=useState<EditableCourse|null>(null);
  const [lessonId,setLessonId]=useState("");
  const [lesson,setLesson]=useState<EditableLesson|null>(null);
  const [revisions,setRevisions]=useState<ContentRevision[]>([]);
  const [courseRevisions,setCourseRevisions]=useState<ContentRevision<EditableCourse>[]>([]);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState<"all"|"draft"|"published"|"archived">("all");
  const [message,setMessage]=useState("");
  const [validationErrors,setValidationErrors]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState(false);
  const [mobile,setMobile]=useState(true);
  const [activeScreenId,setActiveScreenId]=useState("");
  const [collapsedCourseIds,setCollapsedCourseIds]=useState<Set<string>>(new Set());
  const [savedSnapshot,setSavedSnapshot]=useState("");
  const [dialog,setDialog]=useState<"new-course"|"new-lesson"|null>(null);
  const [dialogBusy,setDialogBusy]=useState(false);
  const [dialogError,setDialogError]=useState("");
  const [newCourse,setNewCourse]=useState({title:"",kind:"tool" as "tool"|"use-case",duration:"1 hour",categories:[] as string[]});
  const [newLessonTitle,setNewLessonTitle]=useState("");
  const [newLessonUnitId,setNewLessonUnitId]=useState("");
  const [newLessonTemplate,setNewLessonTemplate]=useState<LessonStarterTemplate>("content");
  const [actionDialog,setActionDialog]=useState<CmsActionDialog|null>(null);
  const [actionReason,setActionReason]=useState("");
  const [actionConfirmation,setActionConfirmation]=useState("");
  const [actionBusy,setActionBusy]=useState(false);
  const [actionError,setActionError]=useState("");
  const [recovery,setRecovery]=useState<CmsRecovery|null>(null);
  const [localDraftSavedAt,setLocalDraftSavedAt]=useState("");
  const [mediaPicker,setMediaPicker]=useState<CmsMediaPicker|null>(null);
  const [publishDialog,setPublishDialog]=useState(false);
  const [changeSummary,setChangeSummary]=useState("");
  const [historyOpen,setHistoryOpen]=useState(false);
  const [workspace,setWorkspace]=useState<"content"|"catalog">("content");
  const initialCatalogDraft=useCallback((source:AdminCourseSummary[]):CatalogDraft=>({
    tool:source.filter((item)=>item.kind==="tool"&&item.status!=="archived").sort((a,b)=>a.displayOrder-b.displayOrder).map((item)=>item.id),
    "use-case":source.filter((item)=>item.kind==="use-case"&&item.status!=="archived").sort((a,b)=>a.displayOrder-b.displayOrder).map((item)=>item.id),
  }),[]);
  const [catalogDraft,setCatalogDraft]=useState<CatalogDraft>({tool:[],"use-case":[]});
  const [catalogSaved,setCatalogSaved]=useState<CatalogDraft>({tool:[],"use-case":[]});
  useEffect(()=>{
    let active=true;
    fetch("/api/admin/content/courses?includeLessons=true",{cache:"no-store"})
      .then(async(response)=>{
        const data=await response.json();
        if(!response.ok)throw new Error(data.error??"Unable to load CMS content.");
        return data;
      })
      .then((data)=>{
        if(!active)return;
        const next=data.courses??[];
        const order=initialCatalogDraft(next);
        setCourses(next);
        setCourseId(next[0]?.id??"");
        setCatalogDraft(order);
        setCatalogSaved(order);
      })
      .catch((error)=>{if(active)setMessage(error instanceof Error?error.message:"Unable to load CMS content.")})
      .finally(()=>{if(active)setLoadingCourses(false)});
    return()=>{active=false};
  },[initialCatalogDraft]);
  useEffect(()=>{
    if(!courseId)return;
    const frame=window.requestAnimationFrame(()=>{
      document.querySelector<HTMLElement>(`[data-cms-course-id="${CSS.escape(courseId)}"]`)?.scrollIntoView({block:"nearest"});
    });
    return()=>window.cancelAnimationFrame(frame);
  },[courseId]);
  useEffect(()=>{if(!courseId||lessonId)return;let active=true;Promise.all([fetch(`/api/admin/content/courses/${encodeURIComponent(courseId)}`).then((r)=>r.json()),fetch(`/api/admin/content/courses/${encodeURIComponent(courseId)}/revisions`).then((r)=>r.json())]).then(([detail,history])=>{if(!active)return;const next=detail.course??null;setCourse(next);setSavedSnapshot(next?JSON.stringify(next):"");setValidationErrors([]);setCourseRevisions(history.revisions??[]);setMessage(detail.error??"");setRecovery(next?readLocalRecovery("course",next):null);setLocalDraftSavedAt("")});return()=>{active=false}},[courseId,lessonId]);
  useEffect(()=>{if(!lessonId)return;let active=true;Promise.all([fetch(`/api/admin/content/lessons/${encodeURIComponent(lessonId)}`).then((r)=>r.json()),fetch(`/api/admin/content/${encodeURIComponent(lessonId)}/revisions`).then((r)=>r.json())]).then(([detail,history])=>{if(!active)return;const next=detail.lesson??null;setLesson(next);setSavedSnapshot(next?JSON.stringify(next):"");setValidationErrors([]);setActiveScreenId(next?.screens[0]?.id??"");setRevisions(history.revisions??[]);setMessage(detail.error??"");setRecovery(next?readLocalRecovery("lesson",next):null);setLocalDraftSavedAt("")});return()=>{active=false}},[lessonId]);
  useEffect(()=>{
    if(!activeScreenId)return;
    document.querySelector<HTMLElement>(`[data-cms-screen-tab="${CSS.escape(activeScreenId)}"]`)?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  },[activeScreenId]);
  const isDirty=useMemo(()=>{const current=lesson??course;return Boolean(current&&savedSnapshot&&JSON.stringify(current)!==savedSnapshot)},[course,lesson,savedSnapshot]);
  const catalogDirty=JSON.stringify(catalogDraft)!==JSON.stringify(catalogSaved);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(!isDirty&&!catalogDirty)return;event.preventDefault()};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[catalogDirty,isDirty]);
  useEffect(()=>{
    const current=lesson??course;
    if(!current||!savedSnapshot)return;
    const kind=lesson?"lesson":"course";
    const key=localDraftKey(kind,current.id);
    if(!isDirty){window.localStorage.removeItem(key);return}
    const timer=window.setTimeout(()=>{
      try{
        const savedAt=new Date().toISOString();
        window.localStorage.setItem(key,JSON.stringify({baseVersion:current.version,savedAt,entity:current}));
        setLocalDraftSavedAt(savedAt);
      }catch{setLocalDraftSavedAt("unavailable")}
    },700);
    return()=>window.clearTimeout(timer);
  },[course,isDirty,lesson,savedSnapshot]);
  useEffect(()=>{const handle=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="s"){event.preventDefault();if(workspace==="catalog"){if(catalogDirty&&!busy)document.querySelector<HTMLButtonElement>("[data-catalog-save]")?.click();return}if((isDirty||(lesson??course)?.status==="draft")&&!busy)document.querySelector<HTMLButtonElement>("[data-cms-publish]")?.click()}};window.addEventListener("keydown",handle);return()=>window.removeEventListener("keydown",handle)},[busy,catalogDirty,course,isDirty,lesson,workspace]);
  const normalizedQuery=query.trim().toLowerCase();
  const filtered=useMemo(()=>courses.filter((course)=>{
    const matchesText=!normalizedQuery||course.title.toLowerCase().includes(normalizedQuery)||(course.lessons??[]).some((item)=>`${item.title} ${item.unitTitle??""}`.toLowerCase().includes(normalizedQuery));
    return matchesText&&(statusFilter==="all"||course.status===statusFilter);
  }),[courses,normalizedQuery,statusFilter]);
  const categoryOptions=useMemo(()=>buildCourseCategoryOptions(courses),[courses]);
  const refreshLessonHistory=async(id:string)=>{
    const data=await fetch(`/api/admin/content/${encodeURIComponent(id)}/revisions`).then((response)=>response.json());
    setRevisions(data.revisions??[]);
  };
  const refreshCourseHistory=async(id:string)=>{
    const data=await fetch(`/api/admin/content/courses/${encodeURIComponent(id)}/revisions`).then((response)=>response.json());
    setCourseRevisions(data.revisions??[]);
  };
  const clearLocalDraft=(target=lesson??course)=>{
    if(!target)return;
    window.localStorage.removeItem(localDraftKey(lesson&&target.id===lesson.id?"lesson":"course",target.id));
    setLocalDraftSavedAt("");
  };
  const discardCurrentChanges=()=>{
    if(!savedSnapshot)return;
    const restored=JSON.parse(savedSnapshot) as EditableLesson|EditableCourse;
    if(lesson){const restoredLesson=restored as EditableLesson;setLesson(restoredLesson);setActiveScreenId(restoredLesson.screens[0]?.id??"")}else setCourse(restored as EditableCourse);
    clearLocalDraft(restored);setValidationErrors([]);setPreview(false);setMessage("Unpublished changes discarded.");
  };
  const requestAction=(next:CmsActionDialog)=>{
    setActionReason("");
    setActionConfirmation("");
    setActionError("");
    setActionDialog(next);
  };
  const runAfterDiscard=(next:()=>void)=>{
    if(!isDirty){next();return}
    requestAction({
      title:"Discard unpublished changes?",
      description:"A recovery copy exists on this device, but these edits have not been published. Discarding removes that recovery copy.",
      confirmLabel:"Discard changes",
      tone:"danger",
      onConfirm:()=>{clearLocalDraft();next()},
    });
  };
  const startNewLesson=()=>{
    setDialogError("");
    setNewLessonTitle("");
    setNewLessonUnitId(course?.unitSummaries.slice().sort((a,b)=>a.order-b.order)[0]?.sourceId??"");
    setNewLessonTemplate("content");
    setDialog("new-lesson");
  };
  const submitAction=async()=>{
    if(!actionDialog||actionBusy)return;
    const reason=actionReason.trim();
    const confirmation=actionConfirmation.trim();
    if(actionDialog.reasonLabel&&!reason){setActionError("Please add a reason so this action is clear in the audit log.");return}
    if(actionDialog.requiredConfirmation&&confirmation!==actionDialog.requiredConfirmation){setActionError(`Type ${actionDialog.requiredConfirmation} exactly to continue.`);return}
    setActionBusy(true);setActionError("");
    try{await actionDialog.onConfirm({reason,confirmation});setActionDialog(null)}
    catch(error){setActionError(error instanceof Error?error.message:"This action could not be completed.")}
    finally{setActionBusy(false)}
  };
  const createCourse=async()=>{
    const title=newCourse.title.trim();const duration=newCourse.duration.trim();
    if(!title||!duration){setDialogError("Course title and duration are required.");return}
    setDialogBusy(true);setDialogError("");
    const response=await fetch("/api/admin/content/courses",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({title,kind:newCourse.kind,duration,categories:newCourse.categories})});
    const data=await response.json();
    if(response.ok){setCourses((current)=>[...current,data.course].sort((a,b)=>a.kind.localeCompare(b.kind)||a.displayOrder-b.displayOrder));setCourseId(data.course.id);setCourse(data.course);setSavedSnapshot(JSON.stringify(data.course));setLessonId("");setLesson(null);setMessage(`Created draft ${data.course.title}`);setDialog(null);setNewCourse({title:"",kind:"tool",duration:"1 hour",categories:[]})}
    else setDialogError(data.error??"Unable to create this course.");
    setDialogBusy(false);
  };
  const createLesson=async()=>{
    if(!courseId)return;
    const title=newLessonTitle.trim();if(!title){setDialogError("Lesson title is required.");return}
    setDialogBusy(true);setDialogError("");
    if(!newLessonUnitId){setDialogError("Choose the course section where this lesson should appear.");return}
    const response=await fetch("/api/admin/content/lessons",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({courseId,title,sourceUnitId:newLessonUnitId,template:newLessonTemplate})});
    const data=await response.json();
    if(response.ok){const unit=course?.unitSummaries.find((value)=>value.sourceId===data.lesson.sourceUnitId);const item={id:data.lesson.id,slug:data.lesson.slug,title:data.lesson.title,courseId,sourceUnitId:data.lesson.sourceUnitId,unitTitle:unit?.title,unitOrder:unit?.order??Number.MAX_SAFE_INTEGER,screenCount:data.lesson.screens.length,order:data.lesson.order,version:data.lesson.version,status:data.lesson.status as "draft"|"published"};setCourses((current)=>current.map((value)=>value.id===courseId?{...value,lessonCount:value.lessonCount+1,lessonSummaries:[...(value.lessonSummaries??[]),{id:data.lesson.id,slug:data.lesson.slug,sourceId:data.lesson.sourceId,sourceUnitId:data.lesson.sourceUnitId,title:data.lesson.title,order:data.lesson.order,screenIds:data.lesson.screens.map((screen:CoursivLessonScreen)=>screen.id),hasAudio:false,version:data.lesson.version,status:"draft" as const}],lessons:[...(value.lessons??[]),item]}:value));setCourse((current)=>current?{...current,lessonCount:current.lessonCount+1,lessonSummaries:[...current.lessonSummaries,{id:data.lesson.id,slug:data.lesson.slug,sourceId:data.lesson.sourceId,sourceUnitId:data.lesson.sourceUnitId,title:data.lesson.title,order:data.lesson.order,screenIds:data.lesson.screens.map((screen:CoursivLessonScreen)=>screen.id),hasAudio:false,version:data.lesson.version,status:"draft"}],lessons:[...(current.lessons??[]),item]}:current);setLessonId(data.lesson.id);setLesson(data.lesson);setSavedSnapshot(JSON.stringify(data.lesson));setActiveScreenId(data.lesson.screens[0]?.id??"");setMessage(`Created draft ${data.lesson.title} in ${unit?.title??"the selected section"}`);setDialog(null);setNewLessonTitle("")}
    else setDialogError(data.error??"Unable to create this lesson.");
    setDialogBusy(false);
  };
  const setScreen=(screenId:string,next:CoursivLessonScreen)=>{setValidationErrors([]);setLesson((current)=>current?withScreens(current,current.screens.map((screen)=>screen.id===screenId?next:screen)):current)};
  const moveScreen=(fromId:string,toId:string)=>setLesson((current)=>{if(!current||fromId===toId)return current;const from=current.screens.findIndex((screen)=>screen.id===fromId);const to=current.screens.findIndex((screen)=>screen.id===toId);if(from<0||to<0)return current;const screens=[...current.screens];const [moved]=screens.splice(from,1);screens.splice(to,0,moved);return withScreens(current,screens.map((screen,index)=>({...screen,order:index})))});
  const jumpToScreen=(screenId:string)=>{
    if(!screenId)return;
    setActiveScreenId(screenId);
    window.setTimeout(()=>document.querySelector<HTMLElement>(`[data-cms-screen-id="${CSS.escape(screenId)}"]`)?.scrollIntoView({behavior:"smooth",block:"start"}),0);
  };
  const validateBeforePublish=()=>{
    if(!lesson&&!course)return;
    if(lesson){
      const clientErrors=validateEditableLesson(lesson);
      if(clientErrors.length){
        const affected=lesson.screens.filter((screen)=>clientErrors.some((error)=>error.includes(screen.id)||screen.blocks.some((block)=>error.includes(block.id)))).map((screen)=>screen.id);
        if(affected[0])setActiveScreenId(affected[0]);
        setValidationErrors(friendlyLessonErrors(lesson,clientErrors));
        setMessage("Fix the highlighted content before publishing.");
        return false;
      }
    }
    if(course){
      const clientErrors=validateCourseMetadata(course);
      if(course.status==="published"&&!course.lessonSummaries.some((item)=>item.status!=="draft"))clientErrors.push("A published course needs at least one published lesson.");
      if(clientErrors.length){
        setValidationErrors(clientErrors);setMessage("Fix the course settings before publishing.");return false;
      }
    }
    setValidationErrors([]);
    return true;
  };
  const openPublishReview=()=>{
    if(!validateBeforePublish())return;
    setChangeSummary("");setPublishDialog(true);
  };
  const publish=async()=>{
    if(!validateBeforePublish())return;
    setBusy(true);setMessage("");setValidationErrors([]);
    const isLesson=Boolean(lesson);const entity=lesson??course!;const endpoint=isLesson?`/api/admin/content/lessons/${encodeURIComponent(entity.id)}`:`/api/admin/content/courses/${encodeURIComponent(entity.id)}`;
    const response=await fetch(endpoint,{method:"PUT",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({[isLesson?"lesson":"course"]:entity,expectedVersion:entity.version,changeSummary:changeSummary.trim()||`Updated ${entity.title} in CMS`})});
    const data=await response.json();
    if(response.ok){
      const next=isLesson?data.lesson:data.course;window.localStorage.removeItem(localDraftKey(isLesson?"lesson":"course",next.id));setLocalDraftSavedAt("");setSavedSnapshot(JSON.stringify(next));
      if(isLesson){
        setLesson(data.lesson);
        const updateCourse=(item:AdminCourseSummary)=>{
          if(item.id!==data.lesson.courseId)return item;
          const unit=item.unitSummaries.find((value)=>value.sourceId===data.lesson.sourceUnitId);
          const nextLessonSummary={id:data.lesson.id,slug:data.lesson.slug,sourceId:data.lesson.sourceId,sourceUnitId:data.lesson.sourceUnitId,title:data.lesson.title,order:data.lesson.order,screenIds:data.lesson.screens.map((screen:CoursivLessonScreen)=>screen.id),hasAudio:data.lesson.hasAudio,version:data.lesson.version,status:data.lesson.status};
          return{...item,lessonSummaries:item.lessonSummaries.some((value)=>value.id===data.lesson.id)?item.lessonSummaries.map((value)=>value.id===data.lesson.id?nextLessonSummary:value):[...item.lessonSummaries,nextLessonSummary],lessons:item.lessons?.map((lessonItem)=>lessonItem.id===data.lesson.id?{...lessonItem,title:data.lesson.title,sourceUnitId:data.lesson.sourceUnitId,unitTitle:unit?.title,unitOrder:unit?.order??Number.MAX_SAFE_INTEGER,screenCount:data.lesson.screens.length,order:data.lesson.order,version:data.lesson.version,status:data.lesson.status}:lessonItem)};
        };
        setCourses((current)=>current.map(updateCourse));
        setCourse((current)=>current?updateCourse(current):current);
        setMessage(`Published lesson version ${data.lesson.version}`);
        await refreshLessonHistory(data.lesson.id);
      }
      else{setCourse(data.course);setCourses((current)=>current.map((item)=>item.id===data.course.id?{...item,...data.course}:item));setMessage(`Published course version ${data.course.version}`);await refreshCourseHistory(data.course.id)}
      setPublishDialog(false);setChangeSummary("");
    }else{
      const errors=(data.errors??[data.error]).filter(Boolean);
      setValidationErrors(lesson?friendlyLessonErrors(lesson,errors):errors);
      setMessage(response.status===409?"Someone else published this item. Reload it before making more changes.":"This item could not be published.");
    }
    setBusy(false);
  };
  const rollback=(revision:ContentRevision)=>{if(!lesson)return;requestAction({title:`Restore lesson version ${revision.version}?`,description:`This creates a new published version of “${lesson.title}” using the selected revision. Current learner progress is preserved.`,confirmLabel:"Restore this version",reasonLabel:"Reason for rollback",onConfirm:async({reason})=>{const response=await fetch(`/api/admin/content/${encodeURIComponent(lesson.id)}/rollback`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({revisionId:revision.id,expectedVersion:lesson.version,reason,confirm:true})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Rollback failed");window.localStorage.removeItem(localDraftKey("lesson",lesson.id));setLesson(data.lesson);setActiveScreenId(data.lesson.screens[0]?.id??"");setSavedSnapshot(JSON.stringify(data.lesson));setMessage(`Restored as lesson version ${data.lesson.version}`);await refreshLessonHistory(data.lesson.id)}})};
  const rollbackCourse=(revision:ContentRevision<EditableCourse>)=>{if(!course)return;requestAction({title:`Restore course version ${revision.version}?`,description:`This restores the selected metadata for “${course.title}” as a new published revision. Lessons and learner history are preserved.`,confirmLabel:"Restore this version",reasonLabel:"Reason for rollback",onConfirm:async({reason})=>{const response=await fetch(`/api/admin/content/courses/${encodeURIComponent(course.id)}/rollback`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({revisionId:revision.id,expectedVersion:course.version,reason,confirm:true})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Rollback failed");window.localStorage.removeItem(localDraftKey("course",course.id));setCourse(data.course);setSavedSnapshot(JSON.stringify(data.course));setCourses((current)=>current.map((item)=>item.id===data.course.id?{...item,...data.course}:item));setMessage(`Restored course as version ${data.course.version}`);await refreshCourseHistory(data.course.id)}})};
  const changeArchive=(archived:boolean)=>{if(!course)return;requestAction({title:`${archived?"Archive":"Restore"} “${course.title}”?`,description:archived?"The course disappears from learner catalogs, while direct links, progress and certificates remain available.":"The course returns to its previous publishing state at the end of its catalog section.",confirmLabel:archived?"Archive course":"Restore course",tone:archived?"danger":"default",reasonLabel:`Reason for ${archived?"archiving":"restoring"}`,onConfirm:async({reason})=>{const response=await fetch(`/api/admin/content/courses/${encodeURIComponent(course.id)}/${archived?"archive":"restore"}`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({expectedVersion:course.version,reason,confirm:true})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Course status could not be changed");window.localStorage.removeItem(localDraftKey("course",course.id));setCourse(data.course);setSavedSnapshot(JSON.stringify(data.course));setCourses((current)=>current.map((item)=>item.id===data.course.id?{...item,...data.course}:item));setMessage(`${archived?"Archived":"Restored"} ${data.course.title}`)}})};
  const deleteCourse=()=>{if(!course)return;requestAction({title:`Permanently delete “${course.title}”?`,description:"This is only allowed for an empty draft course. The action cannot be undone.",confirmLabel:"Permanently delete",tone:"danger",reasonLabel:"Deletion reason",confirmationLabel:"Type the course ID to confirm",confirmationHint:course.id,requiredConfirmation:course.id,onConfirm:async({reason,confirmation})=>{const response=await fetch(`/api/admin/content/courses/${encodeURIComponent(course.id)}`,{method:"DELETE",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({expectedVersion:course.version,reason,confirm:true,confirmationId:confirmation})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Course could not be deleted");window.localStorage.removeItem(localDraftKey("course",course.id));setCourses((current)=>current.filter((item)=>item.id!==course.id));setCourseId("");setCourse(null);setSavedSnapshot("");setMessage("Draft course permanently deleted")}})};
  const openCatalogOrder=()=>{if(workspace==="catalog")return;runAfterDiscard(()=>{const order=initialCatalogDraft(courses);setCatalogDraft(order);setCatalogSaved(order);setWorkspace("catalog");setPreview(false);setHistoryOpen(false)})};
  const closeCatalogOrder=()=>{
    if(!catalogDirty){setWorkspace("content");return}
    requestAction({title:"Discard catalog order changes?",description:"The dragged course order has not been saved. Returning to the editor will discard it.",confirmLabel:"Discard order",tone:"danger",onConfirm:()=>{setCatalogDraft(catalogSaved);setWorkspace("content");setMessage("Unpublished catalog order discarded.")}});
  };
  const saveCatalogOrder=async()=>{
    if(!catalogDirty)return;
    setBusy(true);setMessage("");
    try{
      const active=courses.filter((item)=>item.status!=="archived");
      const response=await fetch("/api/admin/content/courses/catalog-order",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({orders:catalogDraft,expectedVersions:Object.fromEntries(active.map((item)=>[item.id,item.version]))})});
      const data=await response.json();if(!response.ok)throw new Error(data.error??"Catalog order could not be saved");
      const updates=new Map<string,AdminCourseSummary>((data.courses as AdminCourseSummary[]).map((item)=>[item.id,item]));
      const nextCourses=courses.map((item)=>{const update=updates.get(item.id);return update?{...item,...update,lessons:item.lessons}:item});
      nextCourses.sort((a,b)=>a.kind.localeCompare(b.kind)||a.displayOrder-b.displayOrder);
      setCourses(nextCourses);setCatalogSaved(catalogDraft);
      if(course){const update=nextCourses.find((item)=>item.id===course.id);if(update){const nextCourse={...course,...update,lessons:course.lessons};setCourse(nextCourse);if(!lesson)setSavedSnapshot(JSON.stringify(nextCourse))}}
      setMessage("Catalog order saved. Learner URLs and progress were not changed.");
    }catch(error){setMessage(error instanceof Error?error.message:"Catalog order could not be saved. Reload and try again.")}
    finally{setBusy(false)}
  };
  const selectedUnitLessons=course&&lesson?(course.lessons??[]).filter((item)=>item.sourceUnitId===lesson.sourceUnitId).sort((a,b)=>a.order-b.order||a.title.localeCompare(b.title)):[];
  const selectedLessonIndex=lesson?selectedUnitLessons.findIndex((item)=>item.id===lesson.id):-1;
  const activeScreenIndex=lesson?Math.max(0,lesson.screens.findIndex((screen)=>screen.id===activeScreenId)):-1;
  const activeScreen=lesson&&activeScreenIndex>=0?lesson.screens[activeScreenIndex]:null;
  const selectRelativeScreen=(direction:-1|1)=>{
    if(!lesson)return;
    const target=lesson.screens[activeScreenIndex+direction];
    if(target)setActiveScreenId(target.id);
  };
  const moveSelectedLesson=async(direction:-1|1)=>{
    if(!course||!lesson||isDirty)return;
    const targetIndex=selectedLessonIndex+direction;
    if(targetIndex<0||targetIndex>=selectedUnitLessons.length)return;
    const ordered=[...selectedUnitLessons];const [moved]=ordered.splice(selectedLessonIndex,1);ordered.splice(targetIndex,0,moved);
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/admin/content/lessons/reorder",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({courseId:course.id,unitId:lesson.sourceUnitId,orderedIds:ordered.map((item)=>item.id),expectedCourseVersion:course.version,expectedVersions:Object.fromEntries(selectedUnitLessons.map((item)=>[item.id,item.version]))})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Lesson order could not be saved");
      const nextCourse=data.course as AdminCourseSummary;
      const summary=nextCourse.lessons?.find((item)=>item.id===lesson.id);
      const nextLesson=summary?{...lesson,order:summary.order,version:summary.version,updatedAt:new Date().toISOString()}:lesson;
      setCourse(nextCourse);setCourses((current)=>current.map((item)=>item.id===nextCourse.id?nextCourse:item));setLesson(nextLesson);setSavedSnapshot(JSON.stringify(nextLesson));setMessage("Lesson order saved");
      await Promise.all([refreshLessonHistory(lesson.id),refreshCourseHistory(course.id)]);
    }catch(error){setMessage(error instanceof Error?error.message:"Lesson order could not be saved")}
    finally{setBusy(false)}
  };
  const selectedEntity=lesson??course;
  const needsPublish=Boolean(selectedEntity&&(isDirty||selectedEntity.status==="draft"));
  const editStatusTone=busy?"busy":isDirty?"dirty":selectedEntity?.status==="draft"?"draft":selectedEntity?.status==="archived"?"archived":"clean";
  const editStatusLabel=loadingCourses?"Loading live content":!selectedEntity?"No content selected":busy?"Publishing changes":isDirty?"Unpublished changes":selectedEntity.status==="draft"?"Draft ready to publish":selectedEntity.status==="archived"?"Archived content":"All changes published";
  const editStatusTitle=isDirty
    ? localDraftSavedAt==="unavailable"
      ? "A recovery copy could not be saved on this device."
      : localDraftSavedAt
        ? `Recovery copy saved ${new Date(localDraftSavedAt).toLocaleString()}`
        : "Saving a recovery copy on this device."
    : editStatusLabel;
  const showCourseSettings=()=>{
    if(!course)return;
    runAfterDiscard(()=>{
      setCourseId(course.id);
      setCourse(course);
      setSavedSnapshot(JSON.stringify(course));
      setLessonId("");
      setLesson(null);
      setPreview(false);
    });
  };

  return <AdminShell title="Content CMS" subtitle={loadingCourses?"Loading live courses · canonical lesson editor":`${courses.length} courses · canonical lesson editor · instant publishing`}><div className="cms-page">
    <div className="cms-workspace-switch"><button className={workspace==="content"?"active":""} onClick={closeCatalogOrder}><BookOpen/>Courses & Lessons</button><button className={workspace==="catalog"?"active":""} onClick={openCatalogOrder}><ListOrdered/>Catalog Order</button></div>
    {workspace==="content"&&<div className="cms-toolbar"><label><input aria-label="Search courses or lessons" placeholder="Search courses or lessons" value={query} onChange={(event)=>setQuery(event.target.value)}/></label><select aria-label="Filter course status" value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><span>{loadingCourses?"Loading live catalog…":normalizedQuery?`${filtered.length} matching courses`:`${courses.length} courses · ${courses.reduce((sum,course)=>sum+(course.lessonCount??0),0)} lessons`}</span><em className={`cms-edit-status ${editStatusTone}`} data-cms-edit-status={editStatusTone} title={editStatusTitle}><i/>{editStatusLabel}</em><button onClick={()=>runAfterDiscard(()=>{setDialogError("");setDialog("new-course")})}><Plus/>New course</button><button disabled={!lesson&&!course} onClick={()=>setPreview(!preview)}><Eye/>{preview?"Edit":"Preview"}</button><button className="cms-history-toggle" disabled={!selectedEntity} onClick={()=>setHistoryOpen(true)}><History/>Revisions</button><button data-cms-discard className="cms-discard-action" type="button" disabled={!isDirty||busy} title={isDirty?"Discard unpublished changes":"No unpublished changes to discard"} onClick={()=>requestAction({title:"Discard unpublished changes?",description:"This restores the latest published version and removes the recovery copy saved on this device.",confirmLabel:"Discard changes",tone:"danger",onConfirm:discardCurrentChanges})}><RotateCcw/>Discard changes</button><button data-cms-publish className="primary cms-publish-action" disabled={!selectedEntity||busy||!needsPublish} onClick={openPublishReview} title={!selectedEntity?"Select a course or lesson first":selectedEntity.status==="archived"?"Archived content cannot be published":needsPublish?"Review and publish (⌘/Ctrl + S)":"No unpublished changes"}><Save/>{busy?"Publishing…":"Publish changes"}</button></div>}
    {message&&<p className="cms-message" role="status">{message}</p>}
    {validationErrors.length>0&&<section className="cms-validation-summary" role="alert"><strong>Check these items</strong><p>Select a lesson issue to jump directly to its screen.</p><ul>{validationErrors.map((error,index)=>{const screenNumber=Number(error.match(/Screen (\d+)/)?.[1]??0);const target=lesson?.screens[screenNumber-1];return <li key={`${error}-${index}`}>{target?<button type="button" onClick={()=>jumpToScreen(target.id)}>{error}</button>:error}</li>})}</ul></section>}
    {workspace==="catalog"?<CatalogOrderWorkspace courses={courses} draft={catalogDraft} onChange={setCatalogDraft} onSave={()=>void saveCatalogOrder()} onDiscard={()=>{setCatalogDraft(catalogSaved);setMessage("Unpublished catalog order discarded.")}} busy={busy}/>:<div className="cms-workspace">
      <aside className="cms-course-tree">{loadingCourses&&<div className="cms-tree-empty"><strong>Loading live content…</strong><small>Fetching courses and lessons from Firestore.</small></div>}{!loadingCourses&&filtered.map((item)=>{
        const lessonMatches=(item.lessons??[]).filter((lessonItem)=>`${lessonItem.title} ${lessonItem.unitTitle??""}`.toLowerCase().includes(normalizedQuery));
        const courseMatches=item.title.toLowerCase().includes(normalizedQuery);
        const visibleLessons=normalizedQuery?(lessonMatches.length?lessonMatches:item.id===courseId&&courseMatches?item.lessons??[]:[]):item.id===courseId?item.lessons??[]:[];
        const expanded=!collapsedCourseIds.has(item.id)&&(item.id===courseId||visibleLessons.length>0);
        return <div key={item.id} data-cms-course-id={item.id}>
          <button className={item.id===courseId?"active":""} aria-expanded={expanded} title={item.id===courseId&&!lessonId?(expanded?"Collapse course":"Expand course"):"Open course settings"} onClick={()=>{
            if(item.id===courseId&&!lessonId){
              setCollapsedCourseIds((current)=>{const next=new Set(current);if(expanded)next.add(item.id);else next.delete(item.id);return next});
              return;
            }
            runAfterDiscard(()=>{
              setCollapsedCourseIds((current)=>{const next=new Set(current);next.delete(item.id);return next});
              setCourseId(item.id);setCourse(item);setSavedSnapshot(JSON.stringify(item));setLessonId("");setLesson(null);setPreview(false);
            });
          }}>{expanded?<ChevronDown/>:<ChevronRight/>}<span><strong title={item.title}>{item.title}</strong><small>{item.lessonCount} lessons · {item.kind} · {item.status}</small></span></button>
          {expanded&&<div>{visibleLessons.map((lessonItem)=>{
            const lessonIndex=(item.lessons??[]).findIndex((value)=>value.id===lessonItem.id);
            return <button className={lessonItem.id===lessonId?"selected":""} key={lessonItem.id} onClick={()=>{if(lessonItem.id===lessonId)return;runAfterDiscard(()=>{setCourseId(item.id);setCourse(item);setLessonId(lessonItem.id);setLesson(null);setSavedSnapshot("");setPreview(false)})}}><span>{lessonIndex+1}</span><b><strong title={lessonItem.title}>{lessonItem.title}</strong><small>{lessonItem.unitTitle?`${lessonItem.unitTitle} · `:""}{lessonItem.screenCount} screens · v{lessonItem.version}{lessonItem.status==="draft"?" · draft":""}</small></b></button>
          })}{item.id===courseId&&!normalizedQuery&&<button className="cms-tree-add" onClick={()=>runAfterDiscard(startNewLesson)}><Plus/>Add lesson</button>}</div>}
        </div>;
      })}{!loadingCourses&&filtered.length===0&&<div className="cms-tree-empty"><strong>No content found</strong><small>Try a course title, lesson title or unit name.</small><button type="button" onClick={()=>{setQuery("");setStatusFilter("all")}}>Clear search</button></div>}</aside>
      <main className="cms-editor">
        {course&&<nav className="cms-editor-context" aria-label="Current content">
          <div><small>{lesson?"EDITING LESSON":"COURSE SETTINGS"}</small><span><strong>{course.title}</strong>{lesson&&<><ChevronRight/><b>{lesson.title}</b></>}</span></div>
          <div>{lesson&&<button type="button" onClick={showCourseSettings}><Layers3/>Course settings</button>}<button type="button" onClick={()=>document.querySelector<HTMLElement>(".cms-editor")?.scrollTo({top:0,behavior:"smooth"})}><ArrowUp/>Back to top</button></div>
        </nav>}
        {lesson ? (
          preview ? (
            <>
              <div className="cms-preview-switch">
                <button className={mobile?"active":""} onClick={()=>setMobile(true)}><Smartphone/>Mobile</button>
                <button className={!mobile?"active":""} onClick={()=>setMobile(false)}><Monitor/>Desktop</button>
              </div>
              <LessonPreview key={lesson.id} lesson={lesson} mobile={mobile}/>
            </>
          ) : (
            <>
              <div className="cms-lesson-header">
                <label>Lesson title<input value={lesson.title} onChange={(event)=>{setValidationErrors([]);setLesson({...lesson,title:event.target.value})}}/></label>
                <span>Version {lesson.version}<br/>{formatCmsUpdatedAt(lesson.updatedAt,lesson.updatedBy)}</span>
              </div>
              {course&&<section className="cms-lesson-organization">
                <div><Layers3/><span><strong>Course organization</strong><small>Choose where this lesson appears on the course map.</small></span></div>
                <label>Course section<select value={lesson.sourceUnitId} onChange={(event)=>{const sourceUnitId=event.target.value;const targetLessons=(course.lessons??[]).filter((item)=>item.sourceUnitId===sourceUnitId);const order=Math.max(-1,...targetLessons.map((item)=>item.order))+1;setLesson({...lesson,sourceUnitId,order})}}>{[...course.unitSummaries].sort((a,b)=>a.order-b.order).map((unit)=><option value={unit.sourceId} key={unit.sourceId}>{unit.title||"Untitled section"}</option>)}</select></label>
                <div className="cms-lesson-position"><span>{selectedLessonIndex>=0?`Position ${selectedLessonIndex+1} of ${selectedUnitLessons.length}`:"Moves to the end when published"}</span><button type="button" disabled={isDirty||busy||selectedLessonIndex<=0} onClick={()=>void moveSelectedLesson(-1)}><ArrowUp/>Move earlier</button><button type="button" disabled={isDirty||busy||selectedLessonIndex<0||selectedLessonIndex>=selectedUnitLessons.length-1} onClick={()=>void moveSelectedLesson(1)}><ArrowDown/>Move later</button></div>
              </section>}
              <div className="cms-warning"><AlertTriangle/>Publishing changes answer keys, screen order or IDs may affect active learners. Use the arrow buttons or drag a screen tab to reorder it.</div>
              <nav className="cms-screen-tabs-shell" aria-label="Lesson screens">
                <button type="button" disabled={activeScreenIndex<=0} onClick={()=>selectRelativeScreen(-1)} aria-label="Previous screen"><ArrowLeft/></button>
                <div className="cms-screen-tabs" role="tablist" aria-label={`${lesson.title} screens`} onKeyDown={(event)=>{if(event.key==="ArrowLeft"){event.preventDefault();selectRelativeScreen(-1)}if(event.key==="ArrowRight"){event.preventDefault();selectRelativeScreen(1)}}}>
                  {lesson.screens.map((screen,screenIndex)=>{
                    const label=screenEditorLabel(screen,screenIndex);
                    const selected=screen.id===activeScreen?.id;
                    return <button type="button" role="tab" aria-selected={selected} aria-controls={`cms-screen-panel-${screen.id}`} aria-label={`Screen ${screenIndex+1}: ${label.label}`} title={`${label.label} · ${label.contents}`} className={selected?"active":""} data-cms-screen-tab={screen.id} draggable onDragStart={(event)=>event.dataTransfer.setData("text/plain",screen.id)} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();moveScreen(event.dataTransfer.getData("text/plain"),screen.id)}} onClick={()=>setActiveScreenId(screen.id)} key={screen.id}><b>{screenIndex+1}</b><span><strong>{label.label}</strong><small>{label.contents}</small></span></button>;
                  })}
                </div>
                <button type="button" disabled={activeScreenIndex>=lesson.screens.length-1} onClick={()=>selectRelativeScreen(1)} aria-label="Next screen"><ArrowRight/></button>
              </nav>
              <div className="cms-screen-actions"><span>Editing screen {activeScreenIndex+1} of {lesson.screens.length} · {lesson.screens.filter((screen)=>!screen.title?.trim()).length} auto-labelled</span><small>Use the tabs above or ← → keys to switch screens. Drag a tab to reorder.</small></div>
              {activeScreen&&<div role="tabpanel" id={`cms-screen-panel-${activeScreen.id}`} aria-label={`Screen ${activeScreenIndex+1}: ${screenEditorLabel(activeScreen,activeScreenIndex).label}`}>
                <ScreenEditor
                  key={activeScreen.id}
                  screen={activeScreen}
                  screenIndex={activeScreenIndex}
                  onChange={(next)=>setScreen(activeScreen.id,next)}
                  onDrop={(sourceId)=>moveScreen(sourceId,activeScreen.id)}
                  onDuplicate={()=>{const copy={...activeScreen,id:`screen-${crypto.randomUUID()}`,sourcePageId:`cms-${crypto.randomUUID()}`,order:activeScreenIndex+1,blocks:activeScreen.blocks.map(cloneBlock)};const screens=[...lesson.screens.slice(0,activeScreenIndex+1),copy,...lesson.screens.slice(activeScreenIndex+1)].map((value,index)=>({...value,order:index}));setLesson(withScreens(lesson,screens));setActiveScreenId(copy.id)}}
                  onDelete={()=>requestAction({title:`Delete “${screenEditorLabel(activeScreen,activeScreenIndex).label}”?`,description:"The screen and all of its content will be removed from this draft. It only becomes permanent after publishing.",confirmLabel:"Delete screen",tone:"danger",onConfirm:()=>{const nextActive=lesson.screens[activeScreenIndex+1]?.id??lesson.screens[activeScreenIndex-1]?.id??"";const screens=lesson.screens.filter((value)=>value.id!==activeScreen.id).map((value,index)=>({...value,order:index}));setLesson(withScreens(lesson,screens));setActiveScreenId(nextActive)}})}
                  requestAction={requestAction}
                  canDelete={lesson.screens.length>1}
                  onMove={(direction)=>{const target=lesson.screens[activeScreenIndex+direction];if(target)moveScreen(activeScreen.id,target.id)}}
                  canMoveUp={activeScreenIndex>0}
                  canMoveDown={activeScreenIndex<lesson.screens.length-1}
                  openMediaPicker={setMediaPicker}
                />
              </div>}
              <section className="cms-screen-template-picker">
                <div><strong>Add another screen</strong><small>Choose a ready-made layout. You can change every part afterwards.</small></div>
                <div>{(Object.entries(starterTemplates) as [LessonStarterTemplate,typeof starterTemplates[LessonStarterTemplate]][]).map(([template,meta])=>{const Icon=meta.icon;return <button type="button" key={template} onClick={()=>{const next={...buildLessonStarter(template,`Screen ${lesson.screens.length+1}`,crypto.randomUUID)[0],order:lesson.screens.length};setLesson(withScreens(lesson,[...lesson.screens,next]));setActiveScreenId(next.id)}}><Icon/><span><b>{meta.label}</b><small>{meta.description}</small></span></button>})}</div>
              </section>
            </>
          )
        ) : course ? (
          preview ? (
            <>
              <div className="cms-preview-switch">
                <button className={mobile?"active":""} onClick={()=>setMobile(true)}><Smartphone/>Mobile</button>
                <button className={!mobile?"active":""} onClick={()=>setMobile(false)}><Monitor/>Desktop</button>
              </div>
              <CoursePreview course={course} mobile={mobile}/>
            </>
          ) : <CourseEditor course={course} categoryOptions={categoryOptions} onChange={(next)=>{setValidationErrors([]);setCourse(next)}} onArchive={()=>void changeArchive(true)} onRestore={()=>void changeArchive(false)} onDelete={()=>void deleteCourse()} onOpenCatalogOrder={openCatalogOrder} openMediaPicker={setMediaPicker} requestAction={requestAction}/>
        ) : <div className="cms-empty"><Eye/><h2>Select a course</h2><p>Choose a course to edit its catalog metadata, cover and publishing status.</p></div>}
      </main>
      <aside className={`cms-history ${historyOpen?"open":""}`}><h3><span><History/>Revisions</span><button className="cms-history-close" onClick={()=>setHistoryOpen(false)} aria-label="Close revisions"><X/></button></h3>{lesson?(revisions.length?revisions.map((revision)=><article key={revision.id}><strong>Version {revision.version}</strong><small>{new Date(revision.createdAt).toLocaleString()}<br/>{revision.changeSummary}<br/>{revision.changedBy}</small><button onClick={()=>void rollback(revision)}>Rollback</button></article>):<p>Revisions appear after the first CMS publish.</p>):courseRevisions.length?courseRevisions.map((revision)=><article key={revision.id}><strong>Course v{revision.version}</strong><small>{new Date(revision.createdAt).toLocaleString()}<br/>{revision.changeSummary}<br/>{revision.changedBy}</small><button onClick={()=>void rollbackCourse(revision)}>Rollback</button></article>):<p>Course revisions appear after the first metadata publish.</p>}</aside>
    </div>}
    {dialog&&<div className="cms-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!dialogBusy)setDialog(null)}}>
      <section className="cms-modal" role="dialog" aria-modal="true" aria-labelledby="cms-dialog-title">
        <header><div><small>CONTENT CMS</small><h2 id="cms-dialog-title">{dialog==="new-course"?"Create a new course":"Add a new lesson"}</h2><p>{dialog==="new-course"?"Start as a draft, then add lessons before publishing.":`Add a lesson to ${course?.title??"this course"}.`}</p></div><button type="button" disabled={dialogBusy} onClick={()=>setDialog(null)} aria-label="Close dialog"><X/></button></header>
        {dialog==="new-course"?<form onSubmit={(event)=>{event.preventDefault();void createCourse()}}>
          <label>Course title<input autoFocus maxLength={120} value={newCourse.title} onChange={(event)=>setNewCourse((current)=>({...current,title:event.target.value}))}/><small>{newCourse.title.length}/120 characters</small></label>
          <div className="cms-modal-grid">
            <label>Course type<select value={newCourse.kind} onChange={(event)=>setNewCourse((current)=>({...current,kind:event.target.value as "tool"|"use-case"}))}><option value="tool">AI tool</option><option value="use-case">Use case</option></select></label>
            <label>Estimated duration<input maxLength={40} placeholder="For example: 1 hour" value={newCourse.duration} onChange={(event)=>setNewCourse((current)=>({...current,duration:event.target.value}))}/></label>
          </div>
          <CourseCategoryPicker optional value={newCourse.categories} options={categoryOptions} onChange={(categories)=>setNewCourse((current)=>({...current,categories}))}/>
          <div className="cms-modal-note"><strong>What happens next?</strong><p>The course is created as a private draft. Its URL and ID become permanent, but learners will not see it until you add a valid lesson and publish it.</p></div>
          {dialogError&&<p className="cms-inline-error" role="alert">{dialogError}</p>}
          <footer><button type="button" disabled={dialogBusy} onClick={()=>setDialog(null)}>Cancel</button><button className="primary" disabled={dialogBusy} type="submit">{dialogBusy?"Creating…":"Create draft course"}</button></footer>
        </form>:<form onSubmit={(event)=>{event.preventDefault();void createLesson()}}>
          <label>Lesson title<input autoFocus maxLength={120} value={newLessonTitle} onChange={(event)=>setNewLessonTitle(event.target.value)}/><small>This title appears in the course map and lesson header.</small></label>
          <label>Course section<select value={newLessonUnitId} onChange={(event)=>setNewLessonUnitId(event.target.value)}>{course?.unitSummaries.slice().sort((a,b)=>a.order-b.order).map((unit)=><option value={unit.sourceId} key={unit.sourceId}>{unit.title||"Untitled section"}</option>)}</select><small>The lesson is added to the end of this section. You can move it later.</small></label>
          <fieldset className="cms-template-fieldset"><legend>Start with a template</legend><div>{(Object.entries(starterTemplates) as [LessonStarterTemplate,typeof starterTemplates[LessonStarterTemplate]][]).map(([template,meta])=>{const Icon=meta.icon;return <label className={newLessonTemplate===template?"selected":""} key={template}><input type="radio" name="lesson-template" value={template} checked={newLessonTemplate===template} onChange={()=>setNewLessonTemplate(template)}/><Icon/><span><strong>{meta.label}</strong><small>{meta.description}</small></span></label>})}</div></fieldset>
          <div className="cms-modal-note"><strong>Safe draft workflow</strong><p>The lesson stays private until its required content is complete and you explicitly publish it.</p></div>
          {dialogError&&<p className="cms-inline-error" role="alert">{dialogError}</p>}
          <footer><button type="button" disabled={dialogBusy} onClick={()=>setDialog(null)}>Cancel</button><button className="primary" disabled={dialogBusy} type="submit">{dialogBusy?"Creating…":"Add lesson"}</button></footer>
        </form>}
      </section>
    </div>}
    {actionDialog&&<div className="cms-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!actionBusy)setActionDialog(null)}}>
      <section className={`cms-modal cms-action-modal ${actionDialog.tone==="danger"?"danger":""}`} role="alertdialog" aria-modal="true" aria-labelledby="cms-action-title" aria-describedby="cms-action-description">
        <header><div><small>{actionDialog.tone==="danger"?"PLEASE REVIEW":"CONFIRM ACTION"}</small><h2 id="cms-action-title">{actionDialog.title}</h2><p id="cms-action-description">{actionDialog.description}</p></div><button type="button" disabled={actionBusy} onClick={()=>setActionDialog(null)} aria-label="Close confirmation"><X/></button></header>
        <form onSubmit={(event)=>{event.preventDefault();void submitAction()}}>
          {actionDialog.reasonLabel&&<label>{actionDialog.reasonLabel}<textarea autoFocus value={actionReason} onChange={(event)=>setActionReason(event.target.value)} placeholder="Add a short, clear explanation for the audit log"/><small>This note is visible to staff in the permanent audit history.</small></label>}
          {actionDialog.confirmationLabel&&<label>{actionDialog.confirmationLabel}<input autoFocus={!actionDialog.reasonLabel} autoComplete="off" value={actionConfirmation} onChange={(event)=>setActionConfirmation(event.target.value)} placeholder={actionDialog.confirmationHint}/><small>This prevents accidental permanent deletion.</small></label>}
          {actionError&&<p className="cms-inline-error" role="alert">{actionError}</p>}
          <footer><button type="button" disabled={actionBusy} onClick={()=>setActionDialog(null)}>Cancel</button><button autoFocus={!actionDialog.reasonLabel&&!actionDialog.confirmationLabel} className={actionDialog.tone==="danger"?"danger":"primary"} disabled={actionBusy} type="submit">{actionBusy?"Working…":actionDialog.confirmLabel}</button></footer>
        </form>
      </section>
    </div>}
    {publishDialog&&(lesson||course)&&<div className="cms-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!busy)setPublishDialog(false)}}>
      <section className="cms-modal cms-publish-modal" role="dialog" aria-modal="true" aria-labelledby="cms-publish-title">
        <header><div><small>READY TO PUBLISH</small><h2 id="cms-publish-title">Publish “{(lesson??course)!.title}”?</h2><p>Changes become available to learners immediately after the server validates them.</p></div><button type="button" disabled={busy} onClick={()=>setPublishDialog(false)} aria-label="Close publish review"><X/></button></header>
        <form onSubmit={(event)=>{event.preventDefault();void publish()}}>
          <div className="cms-publish-summary">
            {lesson?<><span><strong>{lesson.screens.length}</strong><small>Screens</small></span><span><strong>{lesson.screens.reduce((sum,screen)=>sum+screen.blocks.length,0)}</strong><small>Content blocks</small></span><span><strong>{lesson.screens.filter((screen)=>screen.interactionPolicy!=="read").length}</strong><small>Interactions</small></span></>:<><span><strong>{course!.lessonCount}</strong><small>Lessons</small></span><span><strong>{course!.unitSummaries.length}</strong><small>Sections</small></span><span><strong>{course!.status}</strong><small>Status</small></span></>}
          </div>
          <div className="cms-publish-checks"><span><b>✓</b>Content validation passed</span><span><b>✓</b>A rollback revision will be created</span><span><b>✓</b>IDs and existing learner progress stay intact</span></div>
          <label>Revision note <small>optional but recommended</small><textarea autoFocus maxLength={240} value={changeSummary} onChange={(event)=>setChangeSummary(event.target.value)} placeholder="Briefly describe what changed for your teammates"/><small>{changeSummary.length}/240 characters · visible in revision history</small></label>
          <footer><button type="button" disabled={busy} onClick={()=>setPublishDialog(false)}>Keep editing</button><button className="primary" disabled={busy} type="submit"><Save/>{busy?"Publishing…":"Publish now"}</button></footer>
        </form>
      </section>
    </div>}
    {recovery&&<div className="cms-modal-backdrop" role="presentation">
      <section className="cms-modal cms-recovery-modal" role="alertdialog" aria-modal="true" aria-labelledby="cms-recovery-title" aria-describedby="cms-recovery-description">
        <header><div><small>RECOVERY COPY FOUND</small><h2 id="cms-recovery-title">Recover unpublished work?</h2><p id="cms-recovery-description">This device saved a newer draft of “{recovery.entity.title}” on {new Date(recovery.savedAt).toLocaleString()}.</p></div></header>
        <form onSubmit={(event)=>{event.preventDefault();if(recovery.kind==="lesson"){setLesson(recovery.entity);setActiveScreenId(recovery.entity.screens[0]?.id??"")}else setCourse(recovery.entity);setLocalDraftSavedAt(recovery.savedAt);setRecovery(null);setMessage("Recovered unpublished changes from this device.")}}>
          <div className="cms-modal-note"><strong>Nothing was published automatically</strong><p>Recover to continue editing, or discard only this local recovery copy and keep the latest published version.</p></div>
          <footer><button type="button" onClick={()=>{window.localStorage.removeItem(localDraftKey(recovery.kind,recovery.entity.id));setRecovery(null);setLocalDraftSavedAt("");setMessage("Local recovery copy discarded.")}}>Discard recovery copy</button><button className="primary" type="submit">Recover draft</button></footer>
        </form>
      </section>
    </div>}
    {mediaPicker&&<MediaPickerModal kind={mediaPicker.kind} currentUrl={mediaPicker.currentUrl} onSelect={mediaPicker.onSelect} onClose={()=>setMediaPicker(null)}/>}
  </div></AdminShell>;
}
