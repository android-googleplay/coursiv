import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const manifestFile=join(process.cwd(),"tests/visual/reference-v1/manifest.json");
const manifest=JSON.parse(await readFile(manifestFile,"utf8"));
const failures=[];let verified=0;
for(const state of manifest.states){
  if(state.status!=="captured")continue;
  const file=join(dirname(manifestFile),state.file);
  try{const bytes=await readFile(file);const checksum=createHash("sha256").update(bytes).digest("hex");verified++;if(checksum!==state.sha256)failures.push({id:state.id,message:"Checksum mismatch",expected:state.sha256,actual:checksum})}
  catch(error){failures.push({id:state.id,message:error instanceof Error?error.message:String(error)})}
}
if(process.argv.includes("--refresh-checksums")){
  for(const state of manifest.states){if(state.status!=="captured")continue;const bytes=await readFile(join(dirname(manifestFile),state.file));state.sha256=createHash("sha256").update(bytes).digest("hex")}
  await writeFile(manifestFile,`${JSON.stringify(manifest,null,2)}\n`);
}
console.log(JSON.stringify({version:manifest.version,frozenAt:manifest.frozenAt,states:manifest.states.length,captured:verified,pending:manifest.states.filter((state)=>state.status!=="captured").length,failures},null,2));
if(failures.length)process.exitCode=2;
