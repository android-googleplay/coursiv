import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const [referenceFile,actualFile,diffFile,masksFile]=process.argv.slice(2);
if(!referenceFile||!actualFile||!diffFile)throw new Error("Usage: node scripts/qa-visual-diff.mjs <reference.png> <actual.png> <diff.png> [masks.json]");
const reference=PNG.sync.read(await readFile(referenceFile));const actual=PNG.sync.read(await readFile(actualFile));
if(reference.width!==actual.width||reference.height!==actual.height)throw new Error(`Viewport mismatch: reference ${reference.width}x${reference.height}, actual ${actual.width}x${actual.height}`);
const masks=masksFile?JSON.parse(await readFile(masksFile,"utf8")):[];
for(const {x,y,width,height} of masks)for(let row=Math.max(0,y);row<Math.min(reference.height,y+height);row++)for(let column=Math.max(0,x);column<Math.min(reference.width,x+width);column++){
  const offset=(row*reference.width+column)*4;for(let channel=0;channel<4;channel++)actual.data[offset+channel]=reference.data[offset+channel];
}
const diff=new PNG({width:reference.width,height:reference.height});
const differentPixels=pixelmatch(reference.data,actual.data,diff.data,reference.width,reference.height,{threshold:0.1,includeAA:false});
await writeFile(diffFile,PNG.sync.write(diff));const diffPixelRatio=differentPixels/(reference.width*reference.height);
const result={passed:diffPixelRatio<=0.01,differentPixels,totalPixels:reference.width*reference.height,diffPixelRatio,similarity:1-diffPixelRatio,referenceFile,actualFile,diffFile};
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
