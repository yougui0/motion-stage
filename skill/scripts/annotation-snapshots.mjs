import {mkdir,readFile} from 'node:fs/promises';
import {inside,sha,atomic} from './core.mjs';

export const MAX_ANNOTATION_BYTES=1024*1024;
export const annotationFile=snapshot=>'annotations/'+snapshot+'.png';
const signature=Buffer.from('89504e470d0a1a0a','hex');

export async function saveAnnotationSnapshot(work,bytes){
 if(bytes.length<33||bytes.length>MAX_ANNOTATION_BYTES||!bytes.subarray(0,8).equals(signature)||
    bytes.toString('ascii',12,16)!=='IHDR'||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20)||
    bytes.readUInt32BE(16)>1024||bytes.readUInt32BE(20)>1024)throw Error('批注截图必须是最长边不超过 1024 像素、大小不超过 1 MB 的 PNG。');
 const snapshot=sha(bytes);
 await mkdir(await inside(work,'annotations'),{recursive:true});
 await atomic(await inside(work,annotationFile(snapshot)),bytes);
 return {snapshot};
}

export async function verifyAnnotationSnapshots(work,points){
 for(const snapshot of new Set(points.flatMap(p=>p.annotation?[p.annotation.snapshot]:[]))){
  let bytes;
  try{bytes=await readFile(await inside(work,annotationFile(snapshot)));}catch{throw Error('批注截图找不到，请重新绘制这条反馈标记。');}
  if(sha(bytes)!==snapshot)throw Error('批注截图内容已变化，请重新绘制这条反馈标记。');
 }
}
