import { headers } from "next/headers";
import { welcomeEmailHtml } from "@/lib/platform/welcome-email";

export default async function Page() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const html = welcomeEmailHtml({
    recipientName: "Alex Morgan",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`,
  });
  return <main style={{ minHeight:"100vh", background:"#dfe1e6", padding:"30px 10px" }}><div dangerouslySetInnerHTML={{ __html:html }}/></main>;
}
