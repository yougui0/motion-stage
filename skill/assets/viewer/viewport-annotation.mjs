import {t as localizeText} from './i18n.mjs';
const tools=['pen','arrow','ellipse'];
const colors=['#e12939','#f3c016','#2673ec','#ffffff'];
const maxStrokes=24,maxPoints=480;

export function validateAnnotation(value){
 if(!value||!(/^[a-f0-9]{64}$/.test(value.snapshot||''))||!Array.isArray(value.strokes)||
    !value.strokes.length||value.strokes.length>maxStrokes)throw Error(localizeText("画笔批注缺少有效画面。"));
 let count=0;
 const strokes=value.strokes.map(stroke=>{
  const {tool,color,points}=stroke||{};
  if(!tools.includes(tool)||!colors.includes(color)||!Array.isArray(points)||points.length<2||
     (tool!=='pen'&&points.length!==2)||(count+=points.length)>maxPoints||
     points.some(p=>!Array.isArray(p)||p.length!==2||![p[0],p[1]].every(v=>Number.isInteger(v)&&v>=0&&v<=1000)))throw Error(localizeText("画笔批注包含无效笔迹。"));
  return {tool,color,points:points.map(p=>[...p])};
 });
 return {snapshot:value.snapshot,strokes};
}

export function paintAnnotation(ctx,strokes,width,height){
 for(const {tool,color,points} of strokes){
  const coords=points.map(([x,y])=>[x*width/1000,y*height/1000]);
  const [a,b]=[coords[0],coords.at(-1)],size=Math.max(2,Math.min(width,height)*.008);
  ctx.save();
  ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.shadowColor='#18202d80';ctx.shadowBlur=size*.65;
  ctx.beginPath();
  if(tool==='ellipse')ctx.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.abs(b[0]-a[0])/2,Math.abs(b[1]-a[1])/2,0,0,Math.PI*2);
  else{
   ctx.moveTo(...a);for(const p of coords.slice(1))ctx.lineTo(...p);
   if(tool==='arrow'){
    const direction=Math.atan2(b[1]-a[1],b[0]-a[0]),length=Math.min(5*size,Math.hypot(b[0]-a[0],b[1]-a[1])*.4);
    for(const theta of [direction-.52,direction+.52]){ctx.moveTo(...b);ctx.lineTo(b[0]-Math.cos(theta)*length,b[1]-Math.sin(theta)*length);}
   }
  }
  ctx.stroke();ctx.restore();
 }
}

export function createAnnotationEditor({canvas,toolbar,undo,clear,hint}){
 const ctx=canvas.getContext('2d');
 let frame=null,strokes=[],draft=null,pointer=null,tool='pen',color=colors[0];
 function redraw(){
  if(frame){
   ctx.drawImage(frame,0,0);paintAnnotation(ctx,draft?[...strokes,draft]:strokes,canvas.width,canvas.height);
  }
  undo.disabled=clear.disabled=!strokes.length;
 }
 const point=event=>{
  const r=canvas.getBoundingClientRect();
  return [Math.round((event.clientX-r.left)*1000/r.width),Math.round((event.clientY-r.top)*1000/r.height)].map(v=>Math.max(0,Math.min(1000,v)));
 };
 canvas.onpointerdown=event=>{
  if(!frame||pointer!==null||event.button!==0)return;
  const remaining=maxPoints-strokes.reduce((n,s)=>n+s.points.length,0);
  if(strokes.length>=maxStrokes||remaining<2){hint.textContent=localizeText("这条标记的笔迹已满。可撤销一笔，或保存后新建标记。");return;}
  pointer=event.pointerId;canvas.setPointerCapture(pointer);
  const a=point(event);
  draft={tool,color,points:[a,a],remaining};
  redraw();
 };
 canvas.onpointermove=event=>{
  if(pointer!==event.pointerId)return;
  const p=point(event);
  if(draft.tool!=='pen'){draft.points[1]=p;redraw();return;}
  const last=draft.points.at(-1);
  if(Math.hypot(last[0]-p[0],last[1]-p[1])<5)return;
  if(draft.points.length<draft.remaining)draft.points.push(p);
  else draft.points[draft.points.length-1]=p;
  redraw();
 };
 function finish(event,save){
  if(pointer!==event.pointerId)return;
  if(save&&draft.points.some(p=>p.some((v,i)=>v!==draft.points[0][i]))){
   const {remaining,...stroke}=draft;strokes.push(stroke);
  }
  pointer=null;draft=null;redraw();
 }
 canvas.onpointerup=e=>{canvas.onpointermove(e);finish(e,true);};
 canvas.onpointercancel=canvas.onlostpointercapture=e=>finish(e,false);
 undo.onclick=()=>{strokes.pop();redraw();};
 clear.onclick=()=>{strokes=[];redraw();};
 toolbar.onclick=event=>{
  const b=event.target.closest('button[data-tool],button[data-ink]');
  if(!b)return;
  if(b.dataset.tool)tool=b.dataset.tool;
  else color=b.dataset.ink;
  for(const button of toolbar.querySelectorAll('[data-tool],[data-ink]'))button.setAttribute('aria-pressed',String(button.dataset.tool===tool||button.dataset.ink===color));
 };
 return {
  open(image){frame=image;strokes=[];draft=null;pointer=null;canvas.width=image.width;canvas.height=image.height;hint.textContent=localizeText("在冻结画面上画线、箭头或圈选。");redraw();},
  close(){frame=null;draft=null;pointer=null;strokes=[];},
  evidence(){return frame&&strokes.length?{strokes:structuredClone(strokes),png:canvas.toDataURL('image/png')}:null;}
 };
}
