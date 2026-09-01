import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CoursivContentBlock, CoursivCourse } from "./coursiv-content";
import type { BasicLawMockCollection, BasicLawQuestionBank } from "./basic-law-types";
import { compareBasicLawQuestions } from "./basic-law-question-order";
import { richTextLegalReferenceHtml, richTextPlainText } from "./rich-text";

const readJson=<T,>(path:string)=>JSON.parse(readFileSync(join(process.cwd(),path),"utf8")) as T;
const course=readJson<CoursivCourse>("content/coursiv/courses/basic-law.json");
const practiceCourse=readJson<CoursivCourse>("content/coursiv/courses/basic-law-practice.json");
const mockCourse=readJson<CoursivCourse>("content/coursiv/courses/basic-law-mocks.json");
const bank=readJson<BasicLawQuestionBank>("content/basic-law/question-bank.json");
const mocks=readJson<BasicLawMockCollection>("content/basic-law/mocks.json");
const audit=readJson<{questions:Record<string,{explanationZh:string;trapZh:string|null;referenceIds:string[];verificationStatus:"verified-current"|"retired"}>}>("content/basic-law/question-audit.json");
const referenceData=readJson<{references:Array<{id:string;domain:"basic-law"|"nsl";article:number|null;citationZh:string;textZh:string;textEn:string;sourceUrl:string}>}>("content/basic-law/legal-references.json");
const focusBody=(point:string)=>point.includes("：")?point.slice(point.indexOf("：")+1):point;
type ChoiceBlock=Extract<CoursivContentBlock,{type:"single-choice"|"multi-choice"|"true-false"}>;

describe("BLNST full micro-course",()=>{
  it("uses the same article-by-article flow in all 28 lessons",()=>{
    const lessons=course.units.flatMap((unit)=>unit.lessons);
    const learningLessons=lessons.filter((lesson)=>lesson.experience!=="mock");
    expect(lessons).toHaveLength(28);
    expect(learningLessons).toHaveLength(28);
    expect(lessons.some((lesson)=>lesson.experience==="mock")).toBe(false);
    for(const lesson of learningLessons){
      const raw=lesson.raw as {coverage?:number[];questionIds?:string[];questionSources?:Record<string,string>}|undefined;
      const coverage=raw?.coverage??[];
      const expectedQuestions=lesson.slug==="annexes"?3:coverage.length||3;
      expect(lesson.screens,lesson.slug).toHaveLength(expectedQuestions+4);
      expect(lesson.screens.slice(0,3).every((screen)=>screen.interactionPolicy==="read")).toBe(true);
      expect(lesson.screens.slice(3,-1).every((screen)=>screen.presentation==="knowledge-check"&&screen.interactionPolicy==="required-interaction")).toBe(true);
      expect(lesson.screens.at(-1)?.blocks[0]).toMatchObject({type:"heading",text:"今課總結"});

      const choices=lesson.screens.slice(3,-1).flatMap((screen)=>screen.blocks);
      expect(choices,lesson.slug).toHaveLength(expectedQuestions);
      expect(choices.every((block)=>block.type==="single-choice"&&block.options.length===2)).toBe(true);
      for(const block of choices){
        if(block.type!=="single-choice")continue;
        expect(block.options.filter((option)=>option.isCorrect)).toHaveLength(1);
        expect(block.question).not.toContain("以下係咪官方條文嘅正確節錄");
        expect(block.question).not.toContain("is this an accurate excerpt");
        expect(block.question).not.toMatch(/填空[：:]|Fill in the blank|Choose the missing phrase/iu);
        expect(block.feedbackIncorrect?.text).toMatch(/^未中。答案係 [AB]。/);
        const questionText=richTextPlainText(block.question);
        expect(questionText,lesson.slug).toMatch(lesson.slug.startsWith("nsl-")?/(?:香港國安法|維護國家安全法|National Security Law)/iu:/基本法|Basic Law/iu);
      }

      const map=lesson.blocks?.find((block)=>block.id.endsWith("-map-list"));
      const review=lesson.blocks?.find((block)=>block.id.endsWith("-review-list"));
      expect(map).toMatchObject({type:"list"});
      expect(review).toMatchObject({type:"list"});
      if(map?.type==="list"&&review?.type==="list"){
        expect(map.items).toEqual(review.items);
        expect(map.items).toHaveLength(lesson.slug==="exam-map"||lesson.slug==="annexes"?3:coverage.length);
        expect(map.items.every((item)=>focusBody(item).length<=44),lesson.slug).toBe(true);
      }

      expect(raw?.questionIds).toHaveLength(expectedQuestions);
      expect(Object.keys(raw?.questionSources??{})).toEqual(raw?.questionIds);
      expect(Object.values(raw?.questionSources??{}).every((url)=>url.startsWith("https://"))).toBe(true);
      const teachingBlocks=lesson.screens[2]?.blocks.slice(0,2)??[];
      expect(teachingBlocks,lesson.slug).toMatchObject([{type:"heading"},{type:"paragraph"}]);
      expect(teachingBlocks[0]?.type==="heading"?teachingBlocks[0].text:"",lesson.slug).toMatch(/^學習/u);
      expect(teachingBlocks[1],lesson.slug).not.toMatchObject({type:"list"});
      expect(teachingBlocks[1]?.type==="paragraph"?teachingBlocks[1].text:"",lesson.slug).toContain("稍後會有測驗");
      const officialReference=lesson.screens[2]?.blocks.find((block)=>block.type==="legal-reference");
      expect(officialReference).toMatchObject({type:"legal-reference"});
    }
  });

  it("assigns stable section and lesson codes",()=>{
    const codes=course.units.flatMap((unit,sectionIndex)=>unit.lessons.map((lesson,lessonIndex)=>({
      expected:`${String.fromCharCode(65+sectionIndex)}${lessonIndex+1}`,
      actual:(lesson.raw as {lessonCode?:string}|undefined)?.lessonCode,
    })));
    expect(codes.every(({actual,expected})=>actual===expected)).toBe(true);
    expect(course.units).toHaveLength(5);
    expect(new Set(codes.map(({actual})=>actual)).size).toBe(28);
    expect(course.units.some((unit)=>unit.sourceId==="basic-law-unit-mocks")).toBe(false);
    expect(mocks.mocks).toHaveLength(4);
  });

  it("ships the practice bank as a separate regular course",()=>{
    expect(practiceCourse).toMatchObject({id:"basic-law-practice",title:"BLNST 310 題 Practice Bank",duration:"Self-paced"});
    expect(practiceCourse.units).toHaveLength(1);
    expect(practiceCourse.units[0]).toMatchObject({sourceId:"basic-law-practice-unit-1",title:"題庫操練",code:"A"});
    expect(practiceCourse.units[0].lessons).toHaveLength(1);
    expect(practiceCourse.units[0].lessons[0]).toMatchObject({slug:"practice-bank",title:"310 題 Practice Bank",experience:"practice"});
    expect((practiceCourse.units[0].lessons[0].raw as {lessonCode?:string;questionCount?:number}|undefined)).toMatchObject({lessonCode:"A1",questionCount:310});
  });

  it("ships mocks as a separate regular course",()=>{
    expect(mockCourse).toMatchObject({id:"basic-law-mocks",title:"BLNST 30 分鐘模擬試",duration:"2 hours"});
    expect(mockCourse.units).toHaveLength(1);
    expect(mockCourse.units[0]).toMatchObject({sourceId:"basic-law-mocks-unit-1",title:"計時模擬試",code:"A"});
    expect(mockCourse.units[0].lessons).toHaveLength(4);
    expect(mockCourse.units[0].lessons.map((lesson)=>(lesson.raw as {lessonCode?:string}|undefined)?.lessonCode)).toEqual(["A1","A2","A3","A4"]);
    expect(mockCourse.units[0].lessons.map((lesson)=>lesson.slug)).toEqual(["mock-1","mock-2","mock-3","mock-4"]);
    expect(mockCourse.units[0].lessons.every((lesson)=>lesson.experience==="mock"&&!lesson.optional)).toBe(true);
  });

  it("names the law in every legal-reading title",()=>{
    const legalLessons=course.units.flatMap((unit)=>unit.lessons).filter((lesson)=>lesson.experience!=="mock"&&lesson.slug!=="exam-map");
    for(const lesson of legalLessons){
      const title=lesson.screens[2]?.blocks[0];
      expect(title?.type==="heading"?title.text:"",lesson.slug).toMatch(/^學習《(?:基本法|香港國安法)》/u);
    }
    const aviation=legalLessons.find((lesson)=>lesson.slug==="articles-128-135");
    expect(aviation?.screens[2]?.blocks[0]).toMatchObject({type:"heading",text:"學習《基本法》第 128–135 條"});
  });

  it("mixes grounded short cloze and correct-or-incorrect wording checks without requiring full-law recall",()=>{
    type LegalQuizBlock=ChoiceBlock&{
      questionMode?:"cloze"|"wording-check";
      legalGrounding?:{referenceId:string;excerptZh:string;sourceUrl:string;statementZh?:string;statementIsCorrect?:boolean};
    };
    const allQuestions=course.units.flatMap((unit)=>unit.lessons).flatMap((lesson)=>lesson.screens).flatMap((screen)=>screen.blocks).filter((block):block is ChoiceBlock=>block.type==="single-choice");
    const questions=allQuestions.filter((block):block is LegalQuizBlock=>Boolean((block as LegalQuizBlock).legalGrounding));
    const referencesById=new Map(referenceData.references.map((reference)=>[reference.id,reference]));
    const clozeQuestions=questions.filter((block)=>block.questionMode==="cloze");
    const wordingChecks=questions.filter((block)=>block.questionMode==="wording-check");
    const correctLabels=new Set(clozeQuestions.map((block)=>block.options.find((option)=>option.isCorrect)?.label.split("<br>")[0]));
    expect(wordingChecks.length/questions.length).toBeGreaterThanOrEqual(.2);
    expect(wordingChecks.length/questions.length).toBeLessThanOrEqual(.3);
    expect(wordingChecks.some((block)=>block.options.find((option)=>option.isCorrect)?.label==="正確")).toBe(true);
    expect(wordingChecks.some((block)=>block.options.find((option)=>option.isCorrect)?.label==="唔正確")).toBe(true);
    expect(questions.some((block)=>block.question.includes("以下邊一項係條文訂明嘅內容"))).toBe(false);
    for(const block of questions){
      expect(block.options,block.id).toHaveLength(2);
      expect(block.question.split("<br>")[0].length,block.id).toBeLessThanOrEqual(320);
      expect(block.options.every((option)=>option.label.split("<br>")[0].length<=16),block.id).toBe(true);
      expect(block.options.filter((option)=>option.isCorrect),block.id).toHaveLength(1);
      const correctLabel=block.options.find((option)=>option.isCorrect)?.label.split("<br>")[0]??"";
      const grounding=block.legalGrounding;
      if(!grounding)throw new Error(`${block.id}: missing legal grounding`);
      const reference=referencesById.get(grounding.referenceId);
      expect(grounding.sourceUrl).toBe(reference?.sourceUrl);

      if(block.questionMode==="wording-check"){
        const statement=grounding.statementZh??"";
        expect(block.question,block.id).not.toContain("__________");
        expect(block.question,block.id).toBe(`${reference?.citationZh}以下節錄嘅用字正唔正確？「${statement}」`);
        expect(statement.length,`${block.id}: wording check must show a meaningful part of the law`).toBeGreaterThanOrEqual(6);
        expect(new Set(block.options.map((option)=>option.label)),block.id).toEqual(new Set(["正確","唔正確"]));
        expect(reference?.textZh.includes(statement),`${block.id}: displayed wording must be checked against original law`).toBe(grounding.statementIsCorrect);
        expect(correctLabel,block.id).toBe(grounding.statementIsCorrect?"正確":"唔正確");
        if(grounding.statementIsCorrect)expect(statement,`${block.id}: correct wording must reproduce the saved excerpt`).toBe(grounding.excerptZh);
        else expect(statement,`${block.id}: incorrect wording must visibly change the saved excerpt`).not.toBe(grounding.excerptZh);
      }else{
        expect(block.question.match(/__________/g),block.id).toHaveLength(1);
        expect(block.question,block.id).not.toMatch(/邊個短句|邊項內容|係咪可以概括|嘅重點係「__________」/u);
        expect(block.question,`${block.id}: legal context must not stop at a comma or colon`).not.toMatch(/[，,：:]」$/u);
        const incorrectLabel=block.options.find((option)=>!option.isCorrect)?.label.split("<br>")[0];
        expect(correctLabels.has(incorrectLabel),`${block.id}: distractor repeats a legally correct answer`).toBe(false);
        const completedDistractor=richTextPlainText(block.question).replace("__________",incorrectLabel??"");
        expect(completedDistractor,`${block.id}: distractor does not fit the sentence grammar`).not.toMatch(/法律的自行選擇|依法享有只享有|的經本地立法|的只按|自行只|有只可|由只|宗教宗教|提供意見(?:管理|提供)|實施政策指引的犯罪|國際組織及會議組織|國務院常務委員會|安全委員會立法會|安全委員會只提供|締結的是否|作出香港單獨|原有削減|予以劃一/u);
        expect(correctLabel,`${block.id}: answer is an abstract summary rather than a testable legal fact`).not.toMatch(/(?:幾種|三種|法定情況|自選情況|居港及國籍資格|合資格|產生辦法|決定效力|嘅刑罰|法定限制|法定調查措施|根本條款)$/u);
        if(/法定職[權責]/u.test(correctLabel))expect(block.question.match(/[、，]/gu)?.length??0,`${block.id}: classification question must list concrete powers or duties`).toBeGreaterThanOrEqual(2);
        const completedPrompt=richTextPlainText(block.question).replace(/^《[^》]+》(?:第\s*\d+\s*條|[^：]+)?[：:]\s*/u,"").replace("__________",correctLabel);
        expect(completedPrompt.length,`${block.id}: question lacks enough context`).toBeGreaterThanOrEqual(8);
        expect(block.question,`${block.id}: question only names a role instead of giving testable facts`).not.toMatch(/[：:]\s*(?:行政長官|香港特區政府|立法會主席|立法會|國安委|國安部門|國安公署)(?:嘅|的)__________/u);
        const quoted=richTextPlainText(block.question).match(/原文：「(.+)」$/u)?.[1]??"";
        const completedExcerpt=quoted.replace("__________",correctLabel);
        expect(completedExcerpt,`${block.id}: completed question must reproduce the saved source excerpt`).toBe(grounding.excerptZh);
        expect(reference?.textZh,`${block.id}: excerpt must come directly from the original law`).toContain(completedExcerpt);
      }
    }

    const article42=questions.find((block)=>block.id==="basic-law-09-article-42-quiz");
    expect(article42?.question).toBe("《基本法》第 42 條原文：「香港居民和在香港的其他人有遵守香港特別行政區實行的法律的__________。」");
    expect(article42?.options.find((option)=>option.isCorrect)?.label).toBe("義務");
    expect(article42?.options.find((option)=>!option.isCorrect)?.label).toBe("選擇權");
    expect(article42?.question.replace("__________",article42?.options.find((option)=>!option.isCorrect)?.label??"")).toContain("法律的選擇權");
    const article48=questions.find((block)=>block.id==="basic-law-11-article-48-quiz");
    expect(article48?.question).toContain("《基本法》第 48 條原文：「");
    expect(article48?.question).not.toContain("都屬於行政長官嘅法定職權");
    const correctedWordingChecks:Record<string,{original:string;wrong:string}>={
      "basic-law-02-article-4-quiz":{
        original:"香港特別行政區依法保障香港特別行政區居民和其他人的權利和自由。",
        wrong:"香港特別行政區依法保障香港特別行政區居民和其他人的權利和特權。",
      },
      "basic-law-15-article-91-quiz":{
        original:"香港特別行政區法官以外的其他司法人員原有的任免制度繼續保持。",
        wrong:"香港特別行政區法官以外的其他司法人員原有的任免制度不再保持。",
      },
      "basic-law-17-article-112-quiz":{
        original:"香港特別行政區不實行外匯管制政策。",
        wrong:"香港特別行政區實行外匯管制政策。",
      },
      "basic-law-20-article-143-quiz":{
        original:"香港特別行政區政府自行制定體育政策。",
        wrong:"中央人民政府制定體育政策。",
      },
      "basic-law-20-article-147-quiz":{
        original:"香港特別行政區自行制定有關勞工的法律和政策。",
        wrong:"香港特別行政區自行制定有關僱主的法律和政策。",
      },
      "basic-law-24-article-4-quiz":{
        original:"香港特別行政區維護國家安全應當尊重和保障人權",
        wrong:"香港特別行政區維護國家安全應當限制和削弱人權",
      },
      "basic-law-27-article-46-quiz":{
        original:"凡律政司長發出上述證書，高等法院原訟法庭應當在沒有陪審團的情況下進行審理，並由三名法官組成審判庭。",
        wrong:"凡律政司長發出上述證書，高等法院原訟法庭應當在沒有陪審團的情況下進行審理，並由一名法官組成審判庭。",
      },
    };
    for(const [id,expected] of Object.entries(correctedWordingChecks)){
      const block=questions.find((question)=>question.id===id);
      expect(block?.questionMode,id).toBe("wording-check");
      expect(block?.legalGrounding?.excerptZh,id).toBe(expected.original);
      expect(block?.legalGrounding?.statementZh,id).toBe(expected.wrong);
      expect(block?.legalGrounding?.statementIsCorrect,id).toBe(false);
      expect(block?.options.find((option)=>option.isCorrect)?.label,id).toBe("唔正確");
    }
    expect(allQuestions.every((block)=>!/<small>|填空[：:]|Fill in the blank|Choose the missing phrase/iu.test(block.question))).toBe(true);
  });

  it("orders lesson and practice questions by the covered law articles",()=>{
    const byId=new Map(bank.questions.map((question)=>[question.id,question]));
    const learningLessons=course.units.flatMap((unit)=>unit.lessons).filter((lesson)=>lesson.experience!=="mock");
    for(const lesson of learningLessons){
      const questionIds=(lesson.raw as {coverage?:number[];questionIds?:string[]}|undefined)?.questionIds??[];
      const coverage=(lesson.raw as {coverage?:number[]}|undefined)?.coverage??[];
      if(!coverage.length)continue;
      const articles=questionIds.map((id)=>byId.get(id)?.article??Number(id.match(/article-(\d+)(?:-question)?$/)?.[1]??Number.POSITIVE_INFINITY));
      expect(questionIds,lesson.slug).toHaveLength(coverage.length);
      expect(articles,lesson.slug).toEqual([...articles].sort((left,right)=>left-right));
    }

    const chapterOne=learningLessons.find((lesson)=>lesson.slug==="preamble-articles-1-5");
    expect((chapterOne?.raw as {questionIds?:string[]}|undefined)?.questionIds).toEqual([
      "generated-basic-law-article-1-question",
      "generated-basic-law-article-2-question",
      "bl-07-02",
      "bl-10-01",
      "bl-03-01",
    ]);
    const chapterOneMap=chapterOne?.screens.flatMap((screen)=>screen.blocks).find((block)=>block.id==="basic-law-02-map-list");
    const chapterOneSummary=chapterOne?.screens.flatMap((screen)=>screen.blocks).find((block)=>block.id==="basic-law-02-review-list");
    expect(chapterOneMap).toMatchObject({type:"list"});
    expect(chapterOneSummary).toMatchObject({type:"list"});
    if(chapterOneMap?.type==="list"&&chapterOneSummary?.type==="list"){
      expect(chapterOneMap.items).toEqual(chapterOneSummary.items);
      expect(chapterOneMap.items).toHaveLength(5);
    }

    const practiceOrder=[...bank.questions]
      .filter((question)=>question.verificationStatus==="verified-current")
      .sort(compareBasicLawQuestions);
    const basicLawEnd=practiceOrder.findIndex((question)=>question.domain==="nsl");
    expect(basicLawEnd).toBeGreaterThan(0);
    expect(practiceOrder.slice(0,basicLawEnd).every((question)=>question.domain==="basic-law")).toBe(true);
    expect(practiceOrder.slice(basicLawEnd).every((question)=>question.domain==="nsl")).toBe(true);
    for(const domain of ["basic-law","nsl"] as const){
      const articles=practiceOrder.filter((question)=>question.domain===domain).map((question)=>question.article??Number.POSITIVE_INFINITY);
      expect(articles).toEqual([...articles].sort((left,right)=>left-right));
    }
  });

  it("maps and reviews all 310 OCR questions with specific grounded explanations",()=>{
    expect(bank.questions).toHaveLength(310);
    expect(new Set(bank.questions.map((question)=>question.id)).size).toBe(310);
    expect(bank.questions.filter((question)=>question.domain==="basic-law")).toHaveLength(210);
    expect(bank.questions.filter((question)=>question.domain==="nsl")).toHaveLength(100);
    for(const question of bank.questions){
      expect(question.questionZh,question.id).toMatch(question.domain==="nsl"?/(?:香港國安法|維護國家安全法)/u:/基本法/u);
      expect(question.questionEn,question.id).toMatch(question.domain==="nsl"?/(?:National Security Law|Law of the People's Republic of China on Safeguarding National Security)/iu:/Basic Law/iu);
      expect(question.questionZh.length).toBeGreaterThan(4);
      expect(question.questionEn.length).toBeGreaterThan(4);
      expect(question.options).toHaveLength(4);
      expect(question.options.every((option)=>option.labelZh&&option.labelEn)).toBe(true);
      expect(question.options.filter((option)=>option.id===question.correctOptionId)).toHaveLength(1);
      if(question.verificationStatus==="retired")expect(question.explanationZh).toContain("停用");
      else expect(question.explanationZh).toContain(question.correctOptionId);
      expect(question.explanationZh).not.toMatch(/先對照《基本法》|先對照《香港國安法》|先圈起「不是／不可以」|主體、權力、數字同程序|由此可見，題目所問嘅正確結論係|所以正確選項係|其他選項會改變條文原意|題目問嘅係排除項，所以要揀/);
      expect(question.explanationZh.match(/。/g)?.length??0).toBeGreaterThanOrEqual(2);
      expect(question.explanationZh.match(/。/g)?.length??0).toBeLessThanOrEqual(4);
      expect(question.referenceIds.length).toBeGreaterThan(0);
      expect(question.officialSource).toMatch(/^https:\/\//);
      expect(["verified-current","retired"]).toContain(question.verificationStatus);
      for(const text of [question.questionZh,question.questionEn]){
        expect(text).not.toMatch(/[＿﹍﹎﹏]/u);
        expect(text).not.toMatch(/_{10}\s*[—–-]/u);
        expect(text.match(/_+/g)?.every((blank)=>blank==="__________")??true).toBe(true);
      }
    }
    expect(bank.questions.find((question)=>question.id==="bl-03-01")?.questionZh).toContain("保持原有的__________，五十年不變。");
    expect(bank.questions.find((question)=>question.id==="bl-10-01")).toMatchObject({
      questionZh:"根據《基本法》第四條，香港特別行政區依法保障__________的權利和自由。",
      questionEn:"According to Article 4 of the Basic Law, the Hong Kong Special Administrative Region shall safeguard the rights and freedoms of __________ in accordance with law.",
    });
    expect(bank.questions.filter((question)=>question.questionZh.includes("__________")).length).toBeGreaterThanOrEqual(215);
    expect(bank.questions.find((question)=>question.id==="bl-01-03")?.explanationZh).toBe("答案係 B。《全國人民代表大會議事規則》唔喺《基本法》附件三嘅全國性法律名單內；A、C、D 都屬名單內法律，所以 B 先係題目問嘅「並不是」嗰項。");
    expect(bank.questions.find((question)=>question.id==="bl-05-09")).toMatchObject({article:53,correctOptionId:"C",verificationStatus:"verified-current"});
    expect(bank.questions.find((question)=>question.id==="bl-06-09")?.correctOptionId).toBe("C");
    expect(bank.questions.find((question)=>question.id==="nsl-08-10")?.correctOptionId).toBe("D");
    for(const question of bank.questions)expect(question).toMatchObject(audit.questions[question.id]);
  });

  it("uses one concise focus point per covered law while preserving full legal coverage",()=>{
    const learningLessons=course.units
      .flatMap((unit)=>unit.lessons)
      .filter((lesson)=>lesson.experience!=="mock");
    const mapPoints=learningLessons.flatMap((lesson)=>{
      const block=lesson.blocks?.find((item)=>item.id.endsWith("-map-list"));
      return block?.type==="list"?block.items:[];
    });
    expect(mapPoints).toHaveLength(232);
    expect(mapPoints.every((point)=>focusBody(point).length<=44&&!point.includes("……"))).toBe(true);
    const officialItems=learningLessons.flatMap((lesson)=>lesson.blocks??[]).flatMap((block)=>block.type==="legal-reference"?block.items:[]);
    expect(officialItems).toHaveLength(230);
    expect(mapPoints.some((point)=>/^\d+\.\s/u.test(point))).toBe(false);
    expect(learningLessons.flatMap((lesson)=>lesson.blocks??[]).some((block)=>block.type==="matching-pairs")).toBe(false);
  });

  it("does not ship OCR whitespace between Chinese characters",()=>{
    const renderedChineseContent=JSON.stringify({course,bank,referenceData});
    expect(renderedChineseContent).not.toMatch(/[\p{Script=Han}）》」〉]\s+[\p{Script=Han}《「〈]/u);
  });

  it("covers every Basic Law and National Security Law article bilingually",()=>{
    const basic=referenceData.references.filter((item)=>item.domain==="basic-law");
    const nsl=referenceData.references.filter((item)=>item.domain==="nsl");
    expect(basic.filter((item)=>item.article!==null).map((item)=>item.article)).toEqual(Array.from({length:160},(_,index)=>index+1));
    expect(nsl.filter((item)=>item.article!==null).map((item)=>item.article)).toEqual(Array.from({length:66},(_,index)=>index+1));
    expect(referenceData.references.filter((item)=>item.article===null).map((item)=>item.citationZh)).toEqual(expect.arrayContaining(["《基本法》序言","《基本法》附件一","《基本法》附件二","《基本法》附件三及現行全國性法律名單","《香港國安法》公布安排"]));
    expect(referenceData.references.every((item)=>item.textZh.length>10&&item.textEn.length>10)).toBe(true);
    const byId=new Map(referenceData.references.map((item)=>[item.id,item]));
    for(const question of bank.questions)for(const id of question.referenceIds)expect(byId.get(id)?.sourceUrl).toMatch(/^https:\/\//);
  });

  it("emphasizes complete legal focus phrases without changing or highlighting metadata",()=>{
    const metadataPattern=/(?:EASY\s*PASS|題解|領解|資料截至|https?:\/\/|由於附件條文隨時修訂或增刪)/iu;
    for(const reference of referenceData.references){
      const html=richTextLegalReferenceHtml(reference.textZh);
      const original=richTextPlainText(reference.textZh);
      const emphasized=[...html.matchAll(/<strong>([\s\S]*?)<\/strong>/g)]
        .map((match)=>richTextPlainText(match[1]));
      expect(emphasized.length,reference.id).toBeGreaterThan(0);
      expect(richTextPlainText(html),reference.id).toBe(original);
      for(const phrase of emphasized){
        expect(phrase.length,`${reference.id}: ${phrase}`).toBeGreaterThanOrEqual(3);
        expect(original,`${reference.id}: ${phrase}`).toContain(phrase);
        expect(phrase,reference.id).not.toMatch(metadataPattern);
      }
    }
    expect(richTextLegalReferenceHtml(referenceData.references.find((item)=>item.id==="basic-law-article-1")?.textZh??"")).toContain("<strong>香港特別行政區是中華人民共和國不可分離的部分</strong>");
    expect(richTextLegalReferenceHtml(referenceData.references.find((item)=>item.id==="basic-law-article-3")?.textZh??"")).toContain("<strong>由香港永久性居民依照本法有關規定組成</strong>");
    expect(richTextLegalReferenceHtml(referenceData.references.find((item)=>item.id==="basic-law-article-13")?.textZh??"")).toContain("<strong>負責管理與香港特別行政區有關的外交事務</strong>");
    expect(richTextLegalReferenceHtml(referenceData.references.find((item)=>item.id==="basic-law-article-25")?.textZh??"")).toContain("<strong>在法律面前一律平等</strong>");
  });

  it("keeps retired questions out of lessons and mocks and omits empty trap markup",()=>{
    const retiredIds=new Set(bank.questions.filter((question)=>question.verificationStatus==="retired").map((question)=>question.id));
    expect([...retiredIds]).toEqual(["bl-02-04","bl-02-15","bl-11-07"]);
    const selectedIds=new Set([
      ...course.units.flatMap((unit)=>unit.lessons).flatMap((lesson)=>((lesson.raw as {questionIds?:string[]}|undefined)?.questionIds??[])),
      ...mocks.mocks.flatMap((mock)=>mock.questionIds),
    ]);
    for(const id of retiredIds)expect(selectedIds.has(id)).toBe(false);
    expect(JSON.stringify(course)).not.toContain("<small>null</small>");
    for(const lesson of course.units.flatMap((unit)=>unit.lessons)){
      for(const block of lesson.screens.flatMap((screen)=>screen.blocks)){
        if(block.type!=="single-choice")continue;
        expect(block.feedbackCorrect?.text).not.toContain("<br><small>");
        expect(block.feedbackIncorrect?.text).not.toContain("<br><small>");
      }
    }
  });

  it("builds four fixed 20-question mocks with the agreed 14/6 split",()=>{
    const byId=new Map(bank.questions.map((question)=>[question.id,question]));
    expect(mocks.mocks).toHaveLength(4);
    for(const mock of mocks.mocks){
      const questions=mock.questionIds.map((id)=>byId.get(id));
      expect(mock.questionIds).toHaveLength(20);
      expect(new Set(mock.questionIds).size).toBe(20);
      expect(questions.filter((question)=>question?.domain==="basic-law"&&question.verificationStatus==="verified-current")).toHaveLength(14);
      expect(questions.filter((question)=>question?.domain==="nsl"&&question.verificationStatus==="verified-current")).toHaveLength(6);
      expect(mock.durationMinutes).toBe(30);
      expect(mock.passScore).toBe(10);
      expect(mock.targetScore).toBe(16);
    }
  });
});
