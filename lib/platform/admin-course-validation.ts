export type ValidatableCourseMetadata = {
  title: string;
  duration: string;
  categories: string[];
  image?: string;
  imageAlt?: string;
  status: "draft" | "published" | "archived";
  lessonCount: number;
  unitSummaries?: { sourceId: string; title?: string; order: number }[];
  lessonSummaries?: { sourceUnitId: string }[];
};

export function validateCourseMetadata(course: ValidatableCourseMetadata) {
  const errors: string[] = [];
  const title = course.title.trim();
  const duration = course.duration.trim();
  if (!title) errors.push("Course title is required.");
  if (title.length > 120) errors.push("Course title must be 120 characters or fewer.");
  if (!duration) errors.push("Course duration is required.");
  if (duration.length > 40) errors.push("Course duration must be 40 characters or fewer.");
  if (course.categories.length > 10) errors.push("A course can have at most 10 categories.");
  const normalized = course.categories.map((category) => category.trim().toLowerCase());
  if (course.categories.some((category) => !category.trim() || category.trim().length > 40)) errors.push("Every category must contain 1 to 40 characters.");
  if (new Set(normalized).size !== normalized.length) errors.push("Course categories must be unique.");
  if (course.image && !/^(https:\/\/|\/)/.test(course.image)) errors.push("Course cover must use HTTPS or a local asset path.");
  if (course.imageAlt && course.imageAlt.length > 160) errors.push("Course image alt text must be 160 characters or fewer.");
  if (course.status === "published" && course.lessonCount < 1) errors.push("A published course must contain at least one lesson.");
  const units=course.unitSummaries??[];
  if (!units.length) errors.push("A course needs at least one section.");
  if (new Set(units.map((unit)=>unit.sourceId)).size !== units.length) errors.push("Course section IDs must be unique.");
  if (new Set(units.map((unit)=>unit.order)).size !== units.length || units.some((unit)=>!Number.isInteger(unit.order)||unit.order<0)) {
    errors.push("Course section order must use unique non-negative whole numbers.");
  }
  const unitTitles=units.map((unit)=>(unit.title??"").trim());
  if (unitTitles.some((title)=>!title||title.length>120)) errors.push("Every course section needs a title of 120 characters or fewer.");
  if (new Set(unitTitles.map((title)=>title.toLowerCase())).size !== unitTitles.length) errors.push("Course section titles must be unique.");
  const unitIds=new Set(units.map((unit)=>unit.sourceId));
  if ((course.lessonSummaries??[]).some((lesson)=>!unitIds.has(lesson.sourceUnitId))) {
    errors.push("Every lesson must belong to an existing course section.");
  }
  return errors;
}
