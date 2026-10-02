import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.mjs';
import { OlympusSystem } from '../src/engine.mjs';
import { createAionResolver, createConnectionPoint } from '../src/aion.mjs';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'olympus-capability-'));
  const system = new OlympusSystem({ store:new JsonStore(join(dir, 'state.json')), now:() => '2026-10-02T00:00:00Z' });
  return { dir, system };
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

test('capability registry resolves stable role to one CURRENT implementation', async () => {
  const { dir, system } = await setup();
  try {
    await system.registerApp({
      appId:'prism-browser',
      name:'PRISM',
      capabilityIds:['OBSERVER'],
      destination:'PRISM_NATIVE',
      integration:direct('prism-browser'),
    });
    await system.registerCurrent({
      appId:'prism-browser',
      version:'1.0.0',
      sourceRevision:'rev-1',
      artifactSha:'sha-1',
      runtimeIdentity:'apk://prism-1.0.0',
    });
    const result = await system.resolveCapability('observer');
    assert.equal(result.capabilityId, 'OBSERVER');
    assert.equal(result.status, 'CURRENT');
    assert.equal(result.currentImplementation.implementationId, 'prism-browser');
    assert.equal(result.currentImplementation.displayName, 'PRISM');
    assert.equal(result.currentImplementation.version, '1.0.0');
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('display-name changes do not change capability identity or implementation id', async () => {
  const { dir, system } = await setup();
  try {
    await system.registerApp({
      appId:'prism-browser',
      name:'AURORA',
      capabilityIds:['OBSERVER'],
      destination:'PRISM_NATIVE',
      integration:direct('prism-browser'),
    });
    await system.registerCurrent({
      appId:'prism-browser',
      version:'1.0.0',
      sourceRevision:'rev-1',
      artifactSha:'sha-1',
      runtimeIdentity:'apk://prism-1.0.0',
    });
    const result = await system.resolveCapability('OBSERVER');
    assert.equal(result.currentImplementation.implementationId, 'prism-browser');
    assert.equal(result.currentImplementation.displayName, 'AURORA');
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('a capability cannot have two CURRENT implementations', async () => {
  const { dir, system } = await setup();
  try {
    for (const appId of ['prism-browser','next-browser']) {
      await system.registerApp({
        appId,
        name:appId,
        capabilityIds:['OBSERVER'],
        destination:appId.toUpperCase(),
        integration:direct(appId),
      });
    }
    await system.registerCurrent({
      appId:'prism-browser',
      version:'1.0.0',
      sourceRevision:'rev-1',
      artifactSha:'sha-1',
      runtimeIdentity:'apk://prism-1.0.0',
    });
    await assert.rejects(
      () => system.registerCurrent({
        appId:'next-browser',
        version:'1.0.0',
        sourceRevision:'rev-2',
        artifactSha:'sha-2',
        runtimeIdentity:'apk://next-1.0.0',
      }),
      /CAPABILITY_CURRENT_CONFLICT:OBSERVER:prism-browser/
    );
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('AION resolves a capability through OLYMPUS current truth without product-name coupling', async () => {
  const { dir, system } = await setup();
  try {
    await system.registerApp({
      appId:'prism-browser',
      name:'Any Display Name',
      capabilityIds:['OBSERVER'],
      destination:'PRISM_NATIVE',
      integration:direct('prism-browser'),
    });
    await system.registerCurrent({
      appId:'prism-browser',
      version:'1.0.0',
      sourceRevision:'rev-1',
      artifactSha:'sha-1',
      runtimeIdentity:'apk://prism-1.0.0',
    });
    const result = await createAionResolver({system}).resolveCapability({capabilityId:'OBSERVER'});
    assert.equal(result.schema, 'AION_CAPABILITY_TRUST_PROOF_V1');
    assert.equal(result.status, 'CURRENT');
    assert.equal(result.currentImplementation.implementationId, 'prism-browser');
    assert.equal(result.target, 'app://prism-browser-owner');
    assert.ok(result.releaseTruthRef);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
