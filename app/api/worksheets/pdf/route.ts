import { buildWorksheetPdf } from "../../../../lib/worksheets/pdf";
import { normalizeWorksheetConfig } from "../../../../lib/worksheets/generator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid worksheet settings" }, { status: 400 });
  const raw = body as Record<string, unknown>;
  const questionCount = Number(raw.questionCount);
  const questionsPerPage = Number(raw.questionsPerPage);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 40) {
    return Response.json({ error: "questionCount must be between 1 and 40" }, { status: 400 });
  }
  if (!Number.isInteger(questionsPerPage) || questionsPerPage < 1 || questionsPerPage > 12) {
    return Response.json({ error: "questionsPerPage must be between 1 and 12" }, { status: 400 });
  }
  const config = normalizeWorksheetConfig(raw);
  const bytes = await buildWorksheetPdf(config);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="worksheet-${config.subject}-${config.seed}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
