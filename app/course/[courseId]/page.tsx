import { CourseExperience } from "@/components/course/course-experience";
import { courseEntryHref } from "@/lib/course-navigation";
import { readCoursivCatalog } from "@/lib/coursiv-content.server";
import { runtimeCatalogItem, runtimeCourseDefinition } from "@/lib/runtime-member-data";
import { redirect } from "next/navigation";

export const dynamic="force-dynamic";

export default async function CoursePage({params}:{params:Promise<{courseId:string}>}) {
  const {courseId}=await params;
  if(courseId==="basic-law-mocks"||courseId==="basic-law-practice")redirect(courseEntryHref(courseId));
  const catalog=await readCoursivCatalog({includeArchived:true});
  const entry=catalog.find((course)=>course.id===courseId);
  return <CourseExperience runtimeCourse={entry?runtimeCourseDefinition(entry):undefined} runtimeCatalog={catalog.filter((course)=>course.status==="published").map(runtimeCatalogItem)} runtimeCourses={catalog.map(runtimeCourseDefinition)}/>;
}
