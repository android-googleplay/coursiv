import { redirect } from "next/navigation";

export const metadata={title:"BLNST Basic Law Exam Prep — Coursiv"};

export default function BasicLawPage(){
  redirect("/course/basic-law");
}
