import questionBank from "@/content/basic-law/question-bank.json";
import { BasicLawPracticeBank } from "@/components/basic-law/basic-law-practice-bank";
import type { BasicLawQuestionBank } from "@/lib/basic-law-types";

export const metadata={title:"BLNST Practice Bank — Coursiv"};

export default function BasicLawPracticeCoursePage(){
  const bank=questionBank as BasicLawQuestionBank;
  return <BasicLawPracticeBank courseId="basic-law-practice" questions={bank.questions.filter((question)=>question.verificationStatus==="verified-current")}/>;
}
