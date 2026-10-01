import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.mjs';
import { OlympusSystem } from '../src/engine.mjs';
import { createOlympusServer } from '../src/server.mjs';
import { createConnectionPoint } from '../src/aion.mjs';

async function start() {
  const dir = await mkdtemp(join(tmpdir(), 'olympus-aion-e2e-'));
  let tick = 0;
  const system = new OlympusSystem({
    store:new JsonStore(join(dir, 'state.json')),
    now:() => `2026-10-02T00:00:${String(tick++).padStart(2,'0')}Z`,
  });
  const server = createOlympusServer({ system });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { dir, server, base:`http://127.0.0.1:${port}` };
}

async function request(base, path, method='GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: body ? { 'content-type':'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(json)}`);
  return json;
}

const direct = appId => ({
  mode:'DIRECT',
  connectionPoint:createConnectionPoint({
    appId,
    target:`app://${appId}-owner`,
    endpoint:`https://${appId}.invalid/aion`,
    releaseTruthRef:`github://pureekangraw-ops/Olympus/OLYMPUS_RELEASE_MANIFEST_V1/${appId}`,
    direct:true,
  }),
});

test('AION E2E migration gate: valid, stale, mismatch, missing Current, rollback', async () => {
  const { dir, server, base } = await start();
  try {
    await request(base, '/apps', 'POST', {
      appId:'prism', name:'PRISM', destination:'PRISM_NATIVE',
      integration:direct('prism'),
    });
    await request(base, '/apps/prism/current', 'POST', {
      version:'1.0.0', sourceRevision:'rev-1', artifactSha:'sha-1',
      runtimeIdentity:'apk://prism-1.0.0',
    });

    const v1 = { appId:'prism', version:'1.0.0', sourceRevision:'rev-1', artifactSha:'sha-1', destination:'PRISM_NATIVE' };
    const verifiedV1 = await request(base, '/aion/resolve', 'POST', v1);
    assert.equal(verifiedV1.status, 'VERIFIED');
    assert.equal(verifiedV1.target, 'app://prism-owner');
    assert.ok(verifiedV1.releaseTruthRef);

    const mismatch = await request(base, '/aion/resolve', 'POST', { ...v1, artifactSha:'wrong' });
    assert.equal(mismatch.status, 'MISMATCH');
    assert.equal(mismatch.target, null);
    assert.equal(mismatch.releaseTruthRef, null);

    await request(base, '/apps', 'POST', {
      appId:'missing', name:'MISSING', destination:'MISSING_NATIVE',
      integration:direct('missing'),
    });
    const missing = await request(base, '/aion/resolve', 'POST', {
      appId:'missing', version:'1', sourceRevision:'r', artifactSha:'a', destination:'MISSING_NATIVE',
    });
    assert.equal(missing.status, 'UNKNOWN');
    assert.equal(missing.target, null);
    assert.equal(missing.releaseTruthRef, null);

    await request(base, '/updates', 'POST', {
      workId:'WORK-UP-2', checkpointId:'CP-UP-2', appId:'prism',
      fromVersion:'1.0.0', toVersion:'2.0.0',
      sourceRevision:'rev-2', artifactSha:'sha-2', destination:'PRISM_NATIVE',
      selectedDelta:['aion-e2e'], evidence:['evidence://aion-e2e-update'],
      approval:{ status:'APPROVED' },
    });
    await request(base, '/updates/WORK-UP-2/preflight', 'POST', {});
    await request(base, '/updates/WORK-UP-2/release', 'POST', {});
    await request(base, '/updates/WORK-UP-2/readback', 'POST', {
      passed:true, observedVersion:'2.0.0', observedRevision:'rev-2',
      observedArtifactSha:'sha-2', observedDestination:'PRISM_NATIVE',
      observedRuntimeIdentity:'apk://prism-2.0.0',
      evidence:['evidence://aion-e2e-update-readback'],
    });

    const staleV1 = await request(base, '/aion/resolve', 'POST', v1);
    assert.equal(staleV1.status, 'STALE');
    assert.equal(staleV1.target, null);
    assert.equal(staleV1.releaseTruthRef, null);

    const v2 = { appId:'prism', version:'2.0.0', sourceRevision:'rev-2', artifactSha:'sha-2', destination:'PRISM_NATIVE' };
    const verifiedV2 = await request(base, '/aion/resolve', 'POST', v2);
    assert.equal(verifiedV2.status, 'VERIFIED');
    assert.equal(verifiedV2.target, 'app://prism-owner');

    await request(base, '/rollbacks', 'POST', {
      workId:'WORK-RB-1', checkpointId:'CP-RB-1', appId:'prism',
      targetVersion:'1.0.0', targetSourceRevision:'rev-1',
      reason:'AION_E2E_ROLLBACK', evidence:['evidence://aion-e2e-rollback'],
      approval:{ status:'APPROVED' },
    });
    await request(base, '/rollbacks/WORK-RB-1/readback', 'POST', {
      passed:true, observedVersion:'1.0.0', observedRevision:'rev-1',
      observedArtifactSha:'sha-1', observedDestination:'PRISM_NATIVE',
      observedRuntimeIdentity:'apk://prism-1.0.0',
      evidence:['evidence://aion-e2e-rollback-readback'],
    });

    const verifiedAfterRollback = await request(base, '/aion/resolve', 'POST', v1);
    assert.equal(verifiedAfterRollback.status, 'VERIFIED');
    assert.equal(verifiedAfterRollback.target, 'app://prism-owner');

    const staleAfterRollback = await request(base, '/aion/resolve', 'POST', v2);
    assert.equal(staleAfterRollback.status, 'STALE');
    assert.equal(staleAfterRollback.target, null);

    const registry = await request(base, '/aion/registry');
    const prism = registry.entries.find(entry => entry.systemId === 'prism');
    const missingEntry = registry.entries.find(entry => entry.systemId === 'missing');
    assert.equal(prism.currentStatus, 'CURRENT');
    assert.equal(prism.target, 'app://prism-owner');
    assert.ok(prism.releaseTruthRef);
    assert.equal(missingEntry.currentStatus, 'UNKNOWN');
    assert.equal(missingEntry.target, null);
    assert.equal(missingEntry.releaseTruthRef, null);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive:true, force:true });
  }
});
