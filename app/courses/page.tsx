import { CoursesLandingPage } from "@/components/member/member-pages";
import { readCoursivCatalog } from "@/lib/coursiv-content.server";
import { runtimeCatalogItem, runtimeCourseDefinition } from "@/lib/runtime-member-data";

export const dynamic="force-dynamic";

export default async function Page() {
  const catalog=await readCoursivCatalog();
  return <CoursesLandingPage runtimeItems={catalog.map(runtimeCatalogItem)} runtimeCourses={catalog.map(runtimeCourseDefinition)}/>;
}
