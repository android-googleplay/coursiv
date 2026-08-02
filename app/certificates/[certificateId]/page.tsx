import { CertificateDetailPage } from "@/components/certificates/certificate-pages";

export default async function Page({params}:{params:Promise<{certificateId:string}>}) {
  const {certificateId}=await params;
  return <CertificateDetailPage certificateId={certificateId}/>;
}
