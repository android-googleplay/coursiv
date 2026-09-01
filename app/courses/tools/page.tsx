import { CatalogPage } from "@/components/member/member-pages";
import { readCoursivCatalog } from "@/lib/coursiv-content.server";
import { runtimeCatalogItem, runtimeCourseDefinition } from "@/lib/runtime-member-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const catalog = (await readCoursivCatalog()).filter((course) => course.kind === "tool");
  return (
    <CatalogPage
      kind="tool"
      runtimeItems={catalog.map(runtimeCatalogItem)}
      runtimeCourses={catalog.map(runtimeCourseDefinition)}
    />
  );
}
