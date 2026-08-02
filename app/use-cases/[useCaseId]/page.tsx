import { UseCaseDetailPage } from "@/components/member/member-pages";
import { readCoursivCatalog } from "@/lib/coursiv-content.server";
import { runtimeCatalogItem, runtimeCourseDefinition } from "@/lib/runtime-member-data";

export const dynamic="force-dynamic";

export default async function Page({params}:{params:Promise<{useCaseId:string}>}){
  const {useCaseId}=await params;
  const entry=(await readCoursivCatalog()).find((course)=>course.id===useCaseId&&course.kind==="use-case");
  return <UseCaseDetailPage runtimeItem={entry?runtimeCatalogItem(entry):undefined} runtimeCourse={entry?runtimeCourseDefinition(entry):undefined}/>;
}
