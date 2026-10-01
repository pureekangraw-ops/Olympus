import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.mjs';
import { OlympusSystem } from '../src/engine.mjs';
import { createAionResolver, createConnectionPoint } from '../src/aion.mjs';

async function setup({ connectionPoint = true, current = true, mode = 'DIRECT', direct = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'olympus-aion-'));
  const system = new OlympusSystem({ store:new JsonStore(join(dir, 'state.json')), now:() => '2026-10-02T00:00:00Z' });
  await system.registerApp({
    appId:'prism', name:'PRISM', destination:'PRISM_NATIVE',
    integration: connectionPoint ? { mode, connectionPoint:createConnectionPoint({ appId:'prism', target:'app://prism-owner', endpoint:'https://prism.invalid/aion', releaseTruthRef:'github://pureekangraw-ops/Olympus/OLYMPUS_RELEASE_MANIFEST_V1/prism', direct }) } : {},
  });
  if (current) await system.registerCurrent({ appId:'prism', version:'1.0.0', sourceRevision:'rev-1', artifactSha:'sha-1', runtimeIdentity:'apk://prism-1.0.0' });
  return { system, dir };
}
const query = extra => ({ appId:'prism', version:'1.0.0', sourceRevision:'rev-1', artifactSha:'sha-1', destination:'PRISM_NATIVE', ...extra });

test('AION verifies exact Olympus truth and returns a direct target proof', async () => { const { system, dir }=await setup(); try { const result=await createAionResolver({system,now:()=> '2026-10-02T00:01:00Z'}).resolve(query()); assert.equal(result.schema,'AION_TRUST_PROOF_V1'); assert.equal(result.status,'VERIFIED'); assert.equal(result.appId,'prism'); assert.equal(result.target,'app://prism-owner'); assert.equal(result.destination,'PRISM_NATIVE'); assert.equal(result.releaseTruthRef,'github://pureekangraw-ops/Olympus/OLYMPUS_RELEASE_MANIFEST_V1/prism'); assert.equal(result.verifiedAt,'2026-10-02T00:01:00Z'); } finally { await rm(dir,{recursive:true,force:true}); } });
test('AION keeps unknown app or missing Current unknown without guessing a target', async () => { const { system, dir }=await setup({current:false}); try { const resolver=createAionResolver({system}); const missingCurrent=await resolver.resolve(query()); const missingApp=await resolver.resolve({appId:'factory'}); const app=await resolver.resolve({appId:'unknown',version:'1',sourceRevision:'r',artifactSha:'a',destination:'D'}); assert.equal(missingCurrent.status,'UNKNOWN'); assert.equal(missingCurrent.target,null); assert.equal(missingCurrent.releaseTruthRef,null); assert.equal(missingApp.status,'UNKNOWN'); assert.equal(missingApp.target,null); assert.equal(app.status,'UNKNOWN'); assert.equal(app.target,null); assert.equal(app.releaseTruthRef,null); } finally { await rm(dir,{recursive:true,force:true}); } });
test('AION distinguishes stale version from artifact or destination mismatch without exposing a target', async () => { const { system, dir }=await setup(); try { const resolver=createAionResolver({system}); const stale=await resolver.resolve(query({version:'0.9.0'})); const artifactMismatch=await resolver.resolve(query({artifactSha:'sha-wrong'})); const destinationMismatch=await resolver.resolve(query({destination:'WRONG'})); assert.equal(stale.status,'STALE'); assert.equal(stale.target,null); assert.equal(stale.releaseTruthRef,null); assert.equal(artifactMismatch.status,'MISMATCH'); assert.equal(artifactMismatch.target,null); assert.equal(artifactMismatch.releaseTruthRef,null); assert.equal(destinationMismatch.status,'MISMATCH'); assert.equal(destinationMismatch.target,null); assert.equal(destinationMismatch.releaseTruthRef,null); } finally { await rm(dir,{recursive:true,force:true}); } });
test('AION returns UNKNOWN when the App Registry connection point is absent', async () => { const { system, dir }=await setup({connectionPoint:false}); try { const result=await createAionResolver({system}).resolve(query()); assert.equal(result.status,'UNKNOWN'); assert.equal(result.reason,'CONNECTION_POINT_UNKNOWN'); assert.equal(result.target,null); } finally { await rm(dir,{recursive:true,force:true}); } });
test('AION rejects non-DIRECT App profiles', async () => { const { system, dir }=await setup({mode:'PULL'}); try { const result=await createAionResolver({system}).resolve(query()); assert.equal(result.status,'UNKNOWN'); assert.equal(result.reason,'CONNECTION_POINT_UNKNOWN'); assert.equal(result.target,null); assert.equal(result.releaseTruthRef,null); } finally { await rm(dir,{recursive:true,force:true}); } });
test('AION rejects connection points marked direct:false', async () => { const { system, dir }=await setup({direct:false}); try { const result=await createAionResolver({system}).resolve(query()); assert.equal(result.status,'UNKNOWN'); assert.equal(result.reason,'CONNECTION_POINT_UNKNOWN'); assert.equal(result.target,null); assert.equal(result.releaseTruthRef,null); } finally { await rm(dir,{recursive:true,force:true}); } });
test('AION registry exposes direct connection points without becoming an executor', async () => { const { system, dir }=await setup(); try { const entries=await createAionResolver({system}).registry(); assert.equal(entries.length,1); assert.equal(entries[0].systemId,'prism'); assert.equal(entries[0].target,'app://prism-owner'); assert.equal(entries[0].domain,'PRISM_NATIVE'); } finally { await rm(dir,{recursive:true,force:true}); } });
