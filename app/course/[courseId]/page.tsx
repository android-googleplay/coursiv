import { CourseExperience } from "@/components/course/course-experience";
import { readCoursivCatalog } from "@/lib/coursiv-content.server";
import { runtimeCatalogItem, runtimeCourseDefinition } from "@/lib/runtime-member-data";

export const dynamic="force-dynamic";

export default async function CoursePage({params}:{params:Promise<{courseId:string}>}) {
  const {courseId}=await params;
  const catalog=await readCoursivCatalog({includeArchived:true});
  const entry=catalog.find((course)=>course.id===courseId);
  return <CourseExperience runtimeCourse={entry?runtimeCourseDefinition(entry):undefined} runtimeCatalog={catalog.filter((course)=>course.status==="published").map(runtimeCatalogItem)} runtimeCourses={catalog.map(runtimeCourseDefinition)}/>;
}
