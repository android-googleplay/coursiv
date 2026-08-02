import { demoCertificates } from "@/lib/certificates";
import { certificateEmailHtml } from "@/lib/platform/certificate-email";
export default function Page(){return <main style={{minHeight:"100vh",background:"#dfe1e6",padding:"30px 10px"}}><div dangerouslySetInnerHTML={{__html:certificateEmailHtml(demoCertificates[2],process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3001")}}/></main>}
