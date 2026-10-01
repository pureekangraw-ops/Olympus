import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../src/store.mjs";
import { OlympusSystem } from "../src/engine.mjs";
import { createOlympusServer } from "../src/server.mjs";
import { createOlympusClient } from "../src/client.mjs";

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
test("mismatch creates a readback record but preserves Current",async()=>{const {system,dir}=await setup();try{const u=await system.createUpdate(input("WORK-003"));await system.preflight(u.workId);await system.release(u.workId);const r=await system.readback({workId:u.workId,observedVersion:"0.2.0",observedRevision:"wrong",observedArtifactSha:"artifact-next",observedDestination:"demo-runtime",passed:true});assert.equal(r.readbackResult,"MISMATCH");assert.equal((await system.snapshot()).versions["demo-app"].version,"0.1.0")}finally{await rm(dir,{recursive:true,force:true})}});
test("state survives process-style reload",async()=>{const {system,dir}=await setup();try{await system.recordCase({appId:"demo-app",caseId:"CASE-001",summary:"previous rollback",result:"ROLLED_BACK"});const reloaded=new OlympusSystem({store:new JsonStore(join(dir,"state.json"))});const state=await reloaded.snapshot();assert.equal(state.apps["demo-app"].destination,"demo-runtime");assert.equal(state.cases[0].caseId,"CASE-001")}finally{await rm(dir,{recursive:true,force:true})}});
test("HTTP API exposes health and cards without Hub dependencies",async()=>{const {system,dir}=await setup();const server=createOlympusServer({system});await new Promise(resolve=>server.listen(0,resolve));try{const port=server.address().port;const health=await fetch(`http://127.0.0.1:${port}/health`);assert.deepEqual(await health.json(),{ok:true,system:"OLYMPUS",builder:"LIGHT",authority:"BIG"});const cards=await fetch(`http://127.0.0.1:${port}/cards`);assert.equal((await cards.json()).length,0)}finally{server.close();await rm(dir,{recursive:true,force:true})}});
test("central registry exposes current version, history, and integration manifest",async()=>{const {system,dir}=await setup();try{const u=await system.createUpdate(input("WORK-HISTORY"));await system.preflight(u.workId);await system.release(u.workId);await system.readback({workId:u.workId,observedVersion:"0.2.0",observedRevision:"sha-next",observedArtifactSha:"artifact-next",observedDestination:"demo-runtime",passed:true,evidence:["runtime://history"]});const status=await system.appStatus("demo-app");assert.equal(status.current.version,"0.2.0");assert.equal(status.versions.length,2);assert.equal(status.versions[0].status,"SUPERSEDED");const manifest=await system.integrationManifest("demo-app");assert.equal(manifest.system,"OLYMPUS");assert.equal(manifest.endpoints.current,"/apps/demo-app/current")}finally{await rm(dir,{recursive:true,force:true})}});
test("target app client can read its central version contract",async()=>{const {system,dir}=await setup();const server=createOlympusServer({system});await new Promise(resolve=>server.listen(0,resolve));try{const client=createOlympusClient({baseUrl:`http://127.0.0.1:${server.address().port}`,appId:"demo-app"});assert.equal((await client.getCurrent()).version,"0.1.0");assert.equal((await client.getManifest()).app.appId,"demo-app");assert.equal((await client.getVersions()).length,1)}finally{server.close();await rm(dir,{recursive:true,force:true})}});

test("governance path cannot be bypassed by direct Current overwrite or early readback",async()=>{const {system,dir}=await setup();try{
  await assert.rejects(
    ()=>system.registerCurrent({appId:"demo-app",version:"9.9.9",sourceRevision:"bypass",artifactSha:"bypass",runtimeIdentity:"bypass"}),
    /CURRENT_ALREADY_REGISTERED_USE_RELEASE_READBACK/
  );
  const u=await system.createUpdate(input("WORK-GUARD"));
  await assert.rejects(
    ()=>system.readback({workId:u.workId,observedVersion:"0.2.0",observedRevision:"sha-next",observedArtifactSha:"artifact-next",observedDestination:"demo-runtime",passed:true}),
    /READBACK_STATE_INVALID/
  );
  assert.equal((await system.currentVersion("demo-app")).version,"0.1.0");
}finally{await rm(dir,{recursive:true,force:true})}});

test("runtime destination is mandatory evidence for verification",async()=>{const {system,dir}=await setup();try{
  const u=await system.createUpdate(input("WORK-DEST"));
  await system.preflight(u.workId);
  await system.release(u.workId);
  const r=await system.readback({workId:u.workId,observedVersion:"0.2.0",observedRevision:"sha-next",observedArtifactSha:"artifact-next",passed:true});
  assert.equal(r.readbackResult,"MISMATCH");
  assert.equal((await system.currentVersion("demo-app")).version,"0.1.0");
}finally{await rm(dir,{recursive:true,force:true})}});


test("rollback can target superseded historical truth and changes Current only after exact rollback readback",async()=>{const {system,dir}=await setup();try{
  const update=await system.createUpdate(input("WORK-UPGRADE"));
  await system.preflight(update.workId);
  await system.release(update.workId);
  await system.readback({workId:update.workId,observedVersion:"0.2.0",observedRevision:"sha-next",observedArtifactSha:"artifact-next",observedDestination:"demo-runtime",passed:true,evidence:["runtime://upgrade"]});
  assert.equal((await system.currentVersion("demo-app")).version,"0.2.0");
  const historyBefore=await system.versions("demo-app");
  assert.equal(historyBefore.find(v=>v.version==="0.1.0")?.status,"SUPERSEDED");

  const rollback=await system.rollback({
    workId:"WORK-ROLLBACK",
    checkpointId:"CP-WORK-ROLLBACK",
    appId:"demo-app",
    targetVersion:"0.1.0",
    reason:"regression",
    evidence:["incident://1"],
    approval:{status:"APPROVED",by:"BIG"}
  });
  assert.equal(rollback.status,"ROLLBACK_PENDING");
  assert.equal(rollback.sourceRevision,"sha-current");
  assert.equal((await system.currentVersion("demo-app")).version,"0.2.0");

  const mismatch=await system.rollbackReadback({
    workId:"WORK-ROLLBACK",
    observedVersion:"0.1.0",
    observedRevision:"sha-current",
    observedArtifactSha:"artifact-current",
    observedDestination:"wrong-runtime",
    passed:true,
    evidence:["runtime://wrong"]
  });
  assert.equal(mismatch.readbackResult,"MISMATCH");
  assert.equal((await system.currentVersion("demo-app")).version,"0.2.0");

  const verified=await system.rollbackReadback({
    workId:"WORK-ROLLBACK",
    observedVersion:"0.1.0",
    observedRevision:"sha-current",
    observedArtifactSha:"artifact-current",
    observedDestination:"demo-runtime",
    observedRuntimeIdentity:"runtime-0.1.0-restored",
    passed:true,
    evidence:["runtime://rollback"]
  });
  assert.equal(verified.readbackResult,"ROLLED_BACK");
  assert.equal((await system.currentVersion("demo-app")).version,"0.1.0");
  const historyAfter=await system.versions("demo-app");
  assert.equal(historyAfter.at(-1).version,"0.1.0");
  assert.equal(historyAfter.at(-1).status,"CURRENT");
}finally{await rm(dir,{recursive:true,force:true})}});

test("rollback API client exposes request, list, and exact readback",async()=>{const {system,dir}=await setup();const server=createOlympusServer({system});await new Promise(resolve=>server.listen(0,resolve));try{
  const update=await system.createUpdate(input("WORK-UPGRADE-HTTP"));
  await system.preflight(update.workId);
  await system.release(update.workId);
  await system.readback({workId:update.workId,observedVersion:"0.2.0",observedRevision:"sha-next",observedArtifactSha:"artifact-next",observedDestination:"demo-runtime",passed:true,evidence:["runtime://upgrade-http"]});
  const client=createOlympusClient({baseUrl:`http://127.0.0.1:${server.address().port}`,appId:"demo-app"});
  const rollback=await client.requestRollback({workId:"WORK-RB-HTTP",checkpointId:"CP-WORK-RB-HTTP",targetVersion:"0.1.0",reason:"rollback test",evidence:["test://rb"],approval:{status:"APPROVED",by:"BIG"}});
  assert.equal(rollback.status,"ROLLBACK_PENDING");
  assert.equal((await client.getRollbacks()).length,1);
  const result=await client.rollbackReadback("WORK-RB-HTTP",{observedVersion:"0.1.0",observedRevision:"sha-current",observedArtifactSha:"artifact-current",observedDestination:"demo-runtime",passed:true,evidence:["runtime://rb-http"]});
  assert.equal(result.readbackResult,"ROLLED_BACK");
  assert.equal((await client.getCurrent()).version,"0.1.0");
}finally{server.close();await rm(dir,{recursive:true,force:true})}});


test("Current Version Registry exposes identity without taking source ownership", async () => {
  const { emptyState } = await import("../src/store.mjs");
  let state = emptyState();
  const store = { async read(){ return structuredClone(state); }, async transact(fn){ const result = await fn(state); return structuredClone(result); } };
  const system = new OlympusSystem({ store });
  await system.registerApp({ appId:"factory", destination:"ERGASTERION" });
  let registry = await system.currentRegistry();
  assert.equal(registry.length, 1);
  assert.equal(registry[0].systemId, "factory");
  assert.equal(registry[0].domain, "ERGASTERION");
  assert.equal(registry[0].currentStatus, "UNKNOWN");
  assert.equal(registry[0].version, null);

  await system.registerCurrent({ appId:"factory", version:"1.0.0", sourceRevision:"abc123", artifactSha:"sha256:factory", runtimeIdentity:"worker:factory", evidence:["factory-readback://1"] });
  registry = await system.currentRegistry();
  assert.equal(registry[0].version, "1.0.0");
  assert.equal(registry[0].revision, "abc123");
  assert.equal(registry[0].runtime, "worker:factory");
  assert.deepEqual(registry[0].evidence, ["factory-readback://1"]);
  assert.equal(registry[0].owner, "factory");
});
