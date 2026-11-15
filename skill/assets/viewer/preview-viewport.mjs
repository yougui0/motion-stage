import {t as localizeText} from './i18n.mjs';
export function installPreviewViewport({region,stage,toggle,handle,onLayout}){
 const doc=region.ownerDocument,win=doc.defaultView;
 const expanded=()=>region.classList.contains('preview-expanded');
 let changing=false;

 function show(on){
  region.classList.toggle('preview-expanded',on);
  doc.body.classList.toggle('preview-window',on);
  const label=on?localizeText("退出全屏预览"):localizeText("全屏预览");
  toggle.title=label;
  toggle.setAttribute('aria-label',label);
  toggle.setAttribute('aria-pressed',String(on));
  win.requestAnimationFrame(onLayout);
 }

 async function close(){
  if(!expanded()||changing)return;
  if(doc.fullscreenElement!==region){show(false);return;}
  changing=true;
  try{await doc.exitFullscreen();}catch{}finally{changing=false;}
 }
 toggle.addEventListener('click',async()=>{
  if(changing)return;
  if(expanded()){await close();return;}
  show(true);
  changing=true;
  try{
   if(doc.fullscreenEnabled)await region.requestFullscreen({navigationUI:'hide'});
  }catch{
   // Embedded browsers can deny fullscreen. The viewport still fills the tab.
  }finally{changing=false;}
 });
 doc.addEventListener('fullscreenchange',()=>{
  if(expanded()&&doc.fullscreenElement!==region)show(false);
 });

 const height=()=>Math.round(stage.getBoundingClientRect().height);
 const maximum=()=>Math.max(240,Math.floor(win.innerHeight*.87));
 const minimum=160;
 function describeHeight(){
  const pixels=height();
  handle.setAttribute('aria-valuemin',String(Math.min(minimum,pixels)));
  handle.setAttribute('aria-valuemax',String(Math.max(maximum(),pixels)));
  handle.setAttribute('aria-valuenow',String(pixels));
  handle.setAttribute('aria-valuetext',pixels+localizeText(" 像素"));
 }
 function resize(newHeight){
  const value=Math.max(minimum,Math.min(maximum(),Math.round(newHeight)));
  region.dataset.resized='';
  region.style.setProperty('--preview-height',value+'px');
  describeHeight();
 }
 function reset(){
  delete region.dataset.resized;
  region.style.removeProperty('--preview-height');
  describeHeight();
 }
 let drag=null;
 handle.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0)return;
  event.preventDefault();
  handle.focus({preventScroll:true});
  drag={pointer:event.pointerId,y:event.clientY,height:height()};
  handle.setPointerCapture(event.pointerId);
 });
 handle.addEventListener('pointermove',event=>{
  if(drag?.pointer!==event.pointerId)return;
  const delta=event.clientY-drag.y;
  if(delta===0&&!drag.moved)return;
  drag.moved=true;
  resize(drag.height+delta);
 });
 handle.addEventListener('lostpointercapture',()=>{drag=null;});
 handle.addEventListener('dblclick',reset);
 handle.addEventListener('keydown',event=>{
  const delta={ArrowUp:-32,ArrowDown:32}[event.key];
  if(event.key!=='Home'&&!delta)return;
  event.preventDefault();
  if(event.key==='Home')reset();
  else resize(height()+delta);
 });
 new win.ResizeObserver(describeHeight).observe(stage);
 win.addEventListener('resize',()=>{
  if('resized' in region.dataset&&Number.parseInt(region.style.getPropertyValue('--preview-height'),10)>maximum())resize(maximum());
 });

 const prevent=event=>event.preventDefault();
 for(const type of ['contextmenu','dragstart','selectstart'])stage.addEventListener(type,prevent);
 return {close,expanded};
}

export function isolateOrbitSurface(surface){
 surface.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'||event.pointerType==='pen')event.preventDefault();
 });
 // Prevent middle-button autoscroll where the browser uses mouse events.
 surface.addEventListener('mousedown',event=>{if(event.button===1)event.preventDefault();});
 surface.addEventListener('auxclick',event=>event.preventDefault());
}
