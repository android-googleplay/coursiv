export type CourseCategoryOption = {
  name: string;
  count: number;
};

export function categoryKey(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function cleanCategory(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function buildCourseCategoryOptions(courses: { categories: string[] }[]) {
  const categories = new Map<string, CourseCategoryOption>();
  for (const course of courses) {
    const seen = new Set<string>();
    for (const raw of course.categories) {
      const name = cleanCategory(raw);
      const key = categoryKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const current = categories.get(key);
      categories.set(key, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
    }
  }
  return [...categories.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function closestCourseCategory(input: string, options: CourseCategoryOption[]) {
  const key = categoryKey(input);
  if (!key) return null;
  const exact = options.find((option) => categoryKey(option.name) === key);
  if (exact) return exact;
  const scored = options.map((option) => {
    const optionKey = categoryKey(option.name);
    return { option, distance: editDistance(key, optionKey), length: Math.max(key.length, optionKey.length) };
  }).sort((a, b) => a.distance - b.distance || b.option.count - a.option.count);
  const best = scored[0];
  if (!best) return null;
  const threshold = best.length <= 8 ? 1 : best.length <= 18 ? 2 : 3;
  return best.distance <= threshold ? best.option : null;
}

export function addCourseCategory(
  selected: string[],
  input: string,
  options: CourseCategoryOption[],
  forceNew = false,
) {
  const cleaned = cleanCategory(input);
  if (!cleaned) return { categories: selected, error: "Enter a category name." };
  if (cleaned.length > 40) return { categories: selected, error: "Category names can contain at most 40 characters." };
  if (selected.length >= 10) return { categories: selected, error: "A course can have at most 10 categories." };
  const existing = options.find((option) => categoryKey(option.name) === categoryKey(cleaned));
  const name = !forceNew && existing ? existing.name : cleaned;
  if (selected.some((category) => categoryKey(category) === categoryKey(name))) {
    return { categories: selected, error: `“${name}” is already selected.` };
  }
  return { categories: [...selected, name], error: "" };
}
