import type { Metadata } from "next";
import { WorksheetBuilder } from "@/components/worksheets/worksheet-builder";

export const metadata: Metadata = {
  title: "Worksheet Studio - Printable learning materials",
  description: "Create printable English, Chinese, logic and maths worksheets.",
};

export default function WorksheetBuilderPage() {
  return <WorksheetBuilder />;
}

