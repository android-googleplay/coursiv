import { notFound } from "next/navigation";
import mocksData from "@/content/basic-law/mocks.json";
import questionBank from "@/content/basic-law/question-bank.json";
import { BasicLawMockPlayer } from "@/components/basic-law/basic-law-mock-player";
import type { BasicLawMockCollection, BasicLawQuestionBank } from "@/lib/basic-law-types";

export const metadata={title:"BLNST 30-minute Mock — Coursiv"};

export default async function BasicLawMockCoursePage({params}:{params:Promise<{mockId:string}>}){
  const {mockId}=await params;
  const collection=mocksData as BasicLawMockCollection;
  const bank=questionBank as BasicLawQuestionBank;
  const mock=collection.mocks.find((item)=>item.id===mockId);
  if(!mock)notFound();
  const byId=new Map(bank.questions.filter((question)=>question.verificationStatus==="verified-current").map((question)=>[question.id,question]));
  const questions=mock.questionIds.map((id)=>byId.get(id)).filter((question):question is NonNullable<typeof question>=>Boolean(question));
  if(questions.length!==20)notFound();
  return <BasicLawMockPlayer courseId="basic-law-mocks" mock={mock} questions={questions}/>;
}
