const BASELINE_CUTOFF = Date.UTC(2000, 0, 1);

export function formatCmsUpdatedAt(value?: string | null, updatedBy?: string | null) {
  if (updatedBy === "canonical-import") return "Imported baseline";
  if (!value) return "No CMS changes yet";

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "No CMS changes yet";
  if (timestamp < BASELINE_CUTOFF) return "Imported baseline";

  return new Intl.DateTimeFormat("en-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
