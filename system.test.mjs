import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../src/store.mjs";
import { OlympusSystem } from "../src/engine.mjs";
import { createOlympusServer } from "../src/server.mjs";

async function setup() {
  const dir=await mkdtemp(join(tmpdir(),"olympus-"));
  const system=new OlympusSystem({store:new JsonStore(join(dir,"state.json")),now:()=>"2026-09-29T00:00:00Z"});
  await system.registerApp({appId:"demo-app",versionScheme:"semver",destination:"demo-runtime",readback:{method:"manifest"}});
  await system.registerCurrent({appId:"demo-app",version:"0.1.0",sourceRevision:"sha-current",artifactSha:"artifact-current",runtimeIdentity:"runtime-0.1.0"});
  return {system,dir};
}
function input(workId,destination="demo-runtime"){return {workId,checkpointId:`CP-${workId}`,appId:"demo-app",fromVersion:"0.1.0",toVersion:"0.2.0",sourceRevision:"sha-next",artifactSha:"artifact-next",destination,selectedDelta:["add manifest"],evidence:["test://candidate"],approval:{status:"APPROVED",by:"BIG"}}}

test("full release cycle changes Current only after exact readback",async()=>{const {system,dir}=await setup();try{const u=await system.createUpdate(input("WORK-001"));assert.equal((await system.preflight(u.workId)).gateResult,"OUTBOUND_READY");assert.equal((await system.release(u.workId)).status,"READBACK_PENDING");assert.equal((await system.snapshot()).versions["demo-app"].version,"0.1.0");const r=await system.readback({workId:u.workId,observedVersion:"0.2.0",observedRevision:"sha-next",observedArtifactSha:"artifact-next",observedDestination:"demo-runtime",passed:true,evidence:["runtime://demo"]});assert.equal(r.readbackResult,"VERIFIED");assert.equal((await system.snapshot()).versions["demo-app"].version,"0.2.0")}finally{await rm(dir,{recursive:true,force:true})}});
test("preflight blocks destination, data, and authority errors",async()=>{const {system,dir}=await setup();try{const u=await system.createUpdate({...input("WORK-002","wrong-runtime"),selectedDelta:[],evidence:[],approval:{status:"PENDING"}});const g=await system.preflight(u.workId);assert.equal(g.gateResult,"OUTBOUND_BLOCKED");assert.deepEqual(g.blockingReasons,["DESTINATION_MISMATCH","DELTA_MISSING","EVIDENCE_MISSING","BIG_APPROVAL_MISSING"])}finally{await rm(dir,{recursive:true,force:true})}});
test("mismatch creates a readback record but preserves Current",async()=>{const {system,dir}=await setup();try{const u=await system.createUpdate(input("WORK-003"));await system.preflight(u.workId);await system.release(u.workId);const r=await system.readback({workId:u.workId,observedVersion:"0.2.0",observedRevision:"wrong",observedArtifactSha:"artifact-next",passed:true});assert.equal(r.readbackResult,"MISMATCH");assert.equal((await system.snapshot()).versions["demo-app"].version,"0.1.0")}finally{await rm(dir,{recursive:true,force:true})}});
test("state survives process-style reload",async()=>{const {system,dir}=await setup();try{await system.recordCase({appId:"demo-app",caseId:"CASE-001",summary:"previous rollback",result:"ROLLED_BACK"});const reloaded=new OlympusSystem({store:new JsonStore(join(dir,"state.json"))});const state=await reloaded.snapshot();assert.equal(state.apps["demo-app"].destination,"demo-runtime");assert.equal(state.cases[0].caseId,"CASE-001")}finally{await rm(dir,{recursive:true,force:true})}});
test("HTTP API exposes health and cards without Hub dependencies",async()=>{const {system,dir}=await setup();const server=createOlympusServer({system});await new Promise(resolve=>server.listen(0,resolve));try{const port=server.address().port;const health=await fetch(`http://127.0.0.1:${port}/health`);assert.deepEqual(await health.json(),{ok:true,system:"OLYMPUS",builder:"LIGHT",authority:"BIG"});const cards=await fetch(`http://127.0.0.1:${port}/cards`);assert.equal((await cards.json()).length,0)}finally{server.close();await rm(dir,{recursive:true,force:true})}});
