import type { Metadata } from "next";
import { AcquisitionFunnel } from "@/components/onboarding/acquisition-funnel";
import { readOnboardingFunnelPage } from "@/lib/onboarding-funnel.server";

export const metadata: Metadata = {
  title: "Personalized AI Certificate Program | Coursiv",
  description: "Build a personalized path to practical AI skills and certification.",
};

export default async function DynamicOnboardingPage({
  params,
}: {
  params: Promise<{ block?: string[] }>;
}) {
  const { block = [] } = await params;
  const funnel = await readOnboardingFunnelPage(block);
  const pages = funnel.pages.map((page) => ({ ...page, raw: null }));
  return <AcquisitionFunnel pages={pages} initialIndex={funnel.initialIndex} />;
}
