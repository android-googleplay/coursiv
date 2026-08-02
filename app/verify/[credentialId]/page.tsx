import { notFound } from "next/navigation";
import { PublicVerificationPage } from "@/components/certificates/certificate-pages";
import { getCertificateRecord } from "@/lib/platform/certificate-store";
export default async function Page({params}:{params:Promise<{credentialId:string}>}){const {credentialId}=await params;const certificate=await getCertificateRecord(credentialId);if(!certificate||certificate.visibility!=="public")notFound();return <PublicVerificationPage certificate={certificate}/>}
