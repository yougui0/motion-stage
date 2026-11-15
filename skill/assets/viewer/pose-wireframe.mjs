// Render the same geometry with the same skinning and morph state as the solid pass.
export function createPoseWireframe(THREE){
 const scene=new THREE.Scene(),mirrors=new WeakMap();
 const material=new THREE.MeshBasicMaterial({color:0x203048,wireframe:true,side:THREE.DoubleSide,
  transparent:true,opacity:.48,depthWrite:false,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
   '#include <project_vertex>\n gl_Position.z -= 0.00001 * gl_Position.w;');
 };
 scene.matrixWorldAutoUpdate=false;
 function visible(mesh){
  for(let node=mesh;node;node=node.parent)if(!node.visible)return false;
  return true;
 }
 return (renderer,model,camera,mode)=>{
  if(mode==='off')return;
  const skinned=model.meshes.some(mesh=>mesh.isSkinnedMesh);
  for(const mesh of model.meshes){
   if(!mesh.geometry||!visible(mesh)||(mode==='skin'&&skinned&&!mesh.isSkinnedMesh))continue;
   let lines=mirrors.get(mesh);
   if(!lines){lines=mesh.isSkinnedMesh?new THREE.SkinnedMesh(mesh.geometry,material):new THREE.Mesh(mesh.geometry,material);mirrors.set(mesh,lines);}
   lines.matrixWorld.copy(mesh.matrixWorld);lines.frustumCulled=false;
   if(mesh.isSkinnedMesh){
    lines.skeleton=mesh.skeleton;lines.bindMatrix.copy(mesh.bindMatrix);lines.bindMatrixInverse.copy(mesh.bindMatrixInverse);
   }
   lines.morphTargetInfluences=mesh.morphTargetInfluences;
   scene.add(lines);
  }
  try{renderer.render(scene,camera);}finally{scene.clear();}
 };
}
