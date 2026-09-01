import { redirect } from "next/navigation";

export default async function BasicLawMockPage({params}:{params:Promise<{mockId:string}>}){
  const {mockId}=await params;
  redirect(`/course/basic-law-mocks/mock/${mockId}`);
}
