import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const commit=process.argv.includes("--commit");
const credential=process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY
  ? cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")})
  : applicationDefault();
const app=getApps()[0]??initializeApp({credential});
const database=getFirestore(app);
const normalize=(value)=>String(value??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const searchIndex=(id,data)=>{
  const values=[id,data.subject,data.email,data.userId,...(Array.isArray(data.tags)?data.tags:[]),String(data.message??"").slice(0,500)]
    .filter((value)=>typeof value==="string"&&Boolean(value.trim()))
    .flatMap((value)=>{
      const normalized=normalize(value);
      return[normalized,...normalized.split(/[^\p{L}\p{N}]+/u)];
    });
  const prefixes=new Set();
  for(const value of values)for(let length=1;length<=Math.min(value.length,80);length+=1)prefixes.add(value.slice(0,length));
  return[...prefixes];
};

const snapshot=await database.collection("supportTickets").get();
const updates=snapshot.docs.map((document)=>({
  reference:document.ref,
  searchPrefixes:searchIndex(document.id,document.data()),
}));
if(!commit){
  console.log(JSON.stringify({
    mode:"dry-run",
    tickets:updates.length,
    indexedPrefixes:updates.reduce((sum,item)=>sum+item.searchPrefixes.length,0),
    next:"Run npm run cms:rebuild-tickets -- --commit to write ticket search indexes.",
  },null,2));
  process.exit(0);
}
for(let start=0;start<updates.length;start+=400){
  const batch=database.batch();
  for(const update of updates.slice(start,start+400))batch.set(update.reference,{searchPrefixes:update.searchPrefixes},{merge:true});
  await batch.commit();
}
console.log(JSON.stringify({mode:"committed",tickets:updates.length},null,2));
