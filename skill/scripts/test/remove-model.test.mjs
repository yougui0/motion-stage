import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {importAsset, readProject, stageAsset} from '../core.mjs';
import {createJob, cancelJob, getJob} from '../jobs.mjs';
import {initializeWorkspace} from '../project-workspaces.mjs';
import {linkProject} from '../project-context.mjs';
import {openCatalogAsset, catalogPage, waitForCatalogScan} from '../asset-catalog.mjs';
import {serve} from '../server.mjs';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'motion-remove-'));
 const work=join(dir,'work');
 let server;
 t.after(async()=>{if(server)await new Promise(done=>server.close(done));await rm(dir,{recursive:true,force:true});});
 await initializeWorkspace(work);
 const seed=await readProject(work);
 const bytes=await readFile(join(work,seed.slots.baseline.file));
 return {dir,work,seed,bytes,async start(){
  server=await serve(work,0);
  const origin='http://127.0.0.1:'+server.address().port;
  const get=async path=>await (await fetch(origin+path)).json();
  const {token}=await get('/api/session');
  const remove=(id,payload,auth=token)=>fetch(origin+'/api/models/'+id,{
   method:'DELETE',headers:{'x-motion-token':auth,'content-type':'application/json'},body:JSON.stringify(payload),
  });
  const removeCurrent=project=>remove(project.activeAssetId,{expectedHeadRevision:project.headRevision,expectedName:project.title});
  return {get,remove,removeCurrent};
 }};
}

test('removing a model preserves shared bytes and history, checks current version, and allows an empty library',async t=>{
 const {work,seed,bytes,start}=await fixture(t);
 const copy=await importAsset(work,'baseline',bytes,'Player.fbx',{newModel:true});
 const job=await createJob(work,{request:'检查步态',context:{assetId:copy.assetId,asset:copy,slot:'baseline',clip:'Run',time:.2}});
 const {get,remove,removeCurrent}=await start();
 const {project}=await get('/api/session');
 const request={expectedHeadRevision:project.headRevision,expectedName:project.title};
 assert.equal((await remove(copy.assetId,request,'invalid')).status,403);
 assert.equal((await remove(copy.assetId,{...request,expectedHeadRevision:0})).status,409);
 const blocked=await removeCurrent(project);
 assert.equal(blocked.status,409);
 assert.equal((await blocked.json()).code,'MODEL_JOB_ACTIVE');
 await cancelJob(work,job.id);
 assert.equal((await removeCurrent(project)).status,200);
 assert.equal((await get('/api/session')).project.activeAssetId,seed.activeAssetId);
 assert.equal((await get('/api/studio?assetId='+copy.assetId+'&compact=1')).code,'MODEL_REMOVED');
 assert.ok(!(await get('/api/cast')).entries.some(entry=>entry.id===copy.assetId));
 assert.ok(!(await get('/api/catalog')).entries.some(entry=>entry.id===copy.assetId));
 assert.equal((await getJob(work,job.id)).state,'cancelled');
 assert.deepEqual(await readFile(join(work,copy.file)),bytes);
 await assert.rejects(stageAsset(work,'candidate',bytes,'Late upload',{assetId:copy.assetId}),{code:'MODEL_REMOVED'});
 const beforeRetry=(await get('/api/session')).project;
 assert.equal((await removeCurrent(project)).status,200);
 assert.deepEqual((await get('/api/session')).project,beforeRetry);
 assert.equal((await removeCurrent(beforeRetry)).status,200);
 const empty=(await get('/api/session')).project;
 assert.equal(empty.activeAssetId,null);
 assert.deepEqual(empty.slots,{});
 await initializeWorkspace(work);
 assert.equal((await get('/api/session')).project.activeAssetId,null);
 const fresh=await importAsset(work,'baseline',bytes,'New test model',{newModel:true});
 assert.equal((await get('/api/session')).project.activeAssetId,fresh.assetId);
});

test('removing a model linked to a project keeps its source and allows a deliberate reopen',async t=>{
 const {dir,work,bytes,start}=await fixture(t);
 const root=join(dir,'project');
 await mkdir(root);
 const source=join(root,'hero.glb');
 await writeFile(source,bytes);
 await linkProject(work,root);
 const {get,removeCurrent}=await start();
 await waitForCatalogScan(work);
 const original=(await catalogPage(work)).entries.find(e=>e.relativePath==='hero.glb');
 assert.ok(original);
 const project=await openCatalogAsset(work,original.id);
 assert.equal((await removeCurrent(project)).status,200);
 const row=(await get('/api/catalog')).entries.find(e=>e.id===original.id);
 assert.equal(row.opened,false);
 assert.deepEqual(await readFile(source),bytes);
 const reopened=await openCatalogAsset(work,original.id);
 assert.equal(reopened.activeAssetId,project.activeAssetId);
 assert.deepEqual(reopened.slots,project.slots);
 assert.equal(reopened.headRevision,project.headRevision+1);
 assert.equal((await removeCurrent(project)).status,409);
});
