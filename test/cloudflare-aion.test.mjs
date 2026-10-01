import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker.mjs';

function kv(){const m=new Map();return{async get(k,t){const v=m.get(k);return t==='json'&&v?JSON.parse(v):v??null;},async put(k,v){m.set(k,v);}}}
async function call(env,path,method='GET',body){const r=await worker.fetch(new Request('https://o.example'+path,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json()};}
const integration={mode:'DIRECT',connectionPoint:{appId:'prism',target:'app://prism-owner',releaseTruthRef:'truth://prism',direct:true}};

test('cloud AION enforces Current and DIRECT gates',async()=>{
 const env={OLYMPUS_STATE:kv()};
 await call(env,'/apps','POST',{appId:'prism',destination:'PRISM_NATIVE',integration});
 let x=await call(env,'/aion/resolve','POST',{appId:'prism',version:'1',sourceRevision:'r1',artifactSha:'a1',destination:'PRISM_NATIVE'});
 assert.equal(x.body.status,'UNKNOWN');assert.equal(x.body.target,null);
 await call(env,'/reports/current','POST',{appId:'prism',version:'1',sourceRevision:'r1',artifactSha:'a1',runtimeIdentity:'apk://1',owner:'PRISM',provenanceRef:'truth://prism',destination:'PRISM_NATIVE',verified:true,evidence:['e://1']});
 x=await call(env,'/aion/resolve','POST',{appId:'prism',version:'1',sourceRevision:'r1',artifactSha:'a1',destination:'PRISM_NATIVE'});
 assert.equal(x.body.status,'VERIFIED');assert.equal(x.body.target,'app://prism-owner');
 const bad=await call(env,'/aion/resolve','POST',{appId:'prism',version:'1',sourceRevision:'r1',artifactSha:'wrong',destination:'PRISM_NATIVE'});
 assert.equal(bad.body.status,'MISMATCH');assert.equal(bad.body.target,null);assert.equal(bad.body.releaseTruthRef,null);
 await call(env,'/reports/current','POST',{appId:'prism',version:'2',sourceRevision:'r2',artifactSha:'a2',runtimeIdentity:'apk://2',owner:'PRISM',provenanceRef:'truth://prism',destination:'PRISM_NATIVE',verified:true,evidence:['e://2']});
 const stale=await call(env,'/aion/resolve','POST',{appId:'prism',version:'1',sourceRevision:'r1',artifactSha:'a1',destination:'PRISM_NATIVE'});
 assert.equal(stale.body.status,'STALE');assert.equal(stale.body.target,null);
 const reg=await call(env,'/aion/registry');assert.equal(reg.body.entries[0].target,'app://prism-owner');
});

test('cloud AION registry hides target for non-DIRECT profile',async()=>{
 const env={OLYMPUS_STATE:kv()};
 await call(env,'/apps','POST',{appId:'prism',destination:'PRISM_NATIVE',integration:{...integration,mode:'PULL'}});
 await call(env,'/reports/current','POST',{appId:'prism',version:'1',sourceRevision:'r1',artifactSha:'a1',runtimeIdentity:'apk://1',owner:'PRISM',provenanceRef:'truth://prism',destination:'PRISM_NATIVE',verified:true,evidence:['e://1']});
 const reg=await call(env,'/aion/registry');assert.equal(reg.body.entries[0].target,null);assert.equal(reg.body.entries[0].releaseTruthRef,null);
});
