import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.mjs';
import { OlympusSystem } from '../src/engine.mjs';
import { createFileRuntimeAdapter } from '../src/runtime-adapter.mjs';
import { createReleaseManifest, manifestToUpdateInput } from '../src/release-manifest.mjs';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'olympus-safety-'));
  const system = new OlympusSystem({ store: new JsonStore(join(dir, 'state.json')), now: () => '2026-09-30T00:00:00Z' });
  await system.registerApp({ appId: 'safe-app', versionScheme: 'semver', destination: 'safe-runtime', rules: { requireManifest: true } });
  await system.registerCurrent({ appId: 'safe-app', version: '1.0.0', sourceRevision: 'sha-1', artifactSha: 'artifact-1', runtimeIdentity: 'runtime-1' });
  return { system, dir };
}

test('Updater enforces semver, manifest, duplicate work, and keeps history', async () => {
  const { system, dir } = await setup();
  try {
    await assert.rejects(() => system.createUpdate({ appId: 'safe-app', workId: 'W-BAD', checkpointId: 'CP', fromVersion: '1.0.0', toVersion: 'bad', sourceRevision: 's', artifactSha: 'a', destination: 'safe-runtime', selectedDelta: ['x'], evidence: ['e'], approval: { status: 'APPROVED' } }), /VERSION_FORMAT_INVALID/);
    const update = await system.createUpdate({ appId: 'safe-app', workId: 'W-OK', checkpointId: 'CP', fromVersion: '1.0.0', toVersion: '1.1.0', sourceRevision: 'sha-2', artifactSha: 'artifact-2', destination: 'safe-runtime', manifestRef: 'manifest://2', selectedDelta: ['x'], evidence: ['e'], approval: { status: 'APPROVED' } });
    assert.equal((await system.preflight(update.workId)).gateResult, 'OUTBOUND_READY');
    await assert.rejects(() => system.createUpdate({ appId: 'safe-app', workId: 'W-OK', checkpointId: 'CP', fromVersion: '1.0.0', toVersion: '1.1.0', sourceRevision: 'sha-2', artifactSha: 'artifact-2', destination: 'safe-runtime', selectedDelta: ['x'], evidence: ['e'], approval: { status: 'APPROVED' } }), /UPDATE_ALREADY_EXISTS/);
    await system.release(update.workId);
    await system.readback({ workId: update.workId, passed: true, observedVersion: '1.1.0', observedRevision: 'sha-2', observedArtifactSha: 'artifact-2', observedDestination: 'safe-runtime', observedChecksumAlgorithm: 'sha256', evidence: ['runtime://2'] });
    assert.equal((await system.versions('safe-app')).length, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('file runtime adapter installs, activates, reads back, and rolls back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'olympus-runtime-'));
  try {
    const source = join(dir, 'source'); await mkdir(source); await writeFile(join(source, 'index.html'), 'v1');
    const adapter = createFileRuntimeAdapter({ root: join(dir, 'runtime') });
    await adapter.install({ appId: 'safe-app', version: '1.0.0', sourceDir: source, artifactSha: 'a1' });
    const current = await adapter.activate({ appId: 'safe-app', version: '1.0.0', sourceRevision: 's1', artifactSha: 'a1', entrypoint: 'index.html' });
    assert.equal((await adapter.readback('safe-app')).version, '1.0.0');
    assert.equal((await adapter.rollback({ appId: 'safe-app', version: '1.0.0', sourceRevision: 's1', artifactSha: 'a1', entrypoint: 'index.html' })).version, current.version);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('release manifest is explicit, transition-complete, and maps into update input', () => {
  const manifest = createReleaseManifest({
    appId: 'safe-app',
    fromVersion: '1.0.0',
    version: '1.1.0',
    sourceRevision: 's',
    artifactSha: 'a',
    artifactRef: 'manifest://safe-app/1.1.0',
    destination: 'safe-runtime',
    workId: 'W',
    checkpointId: 'CP',
    selectedDelta: ['ship 1.1.0'],
    rejectedDelta: ['skip experimental flag'],
    evidenceRefs: ['e'],
  });
  assert.equal(manifest.schema, 'OLYMPUS_RELEASE_MANIFEST_V1');
  assert.equal(manifest.fromVersion, '1.0.0');
  assert.deepEqual(manifest.evidenceRefs, ['e']);

  const input = manifestToUpdateInput(manifest, { status: 'APPROVED', by: 'BIG' });
  assert.equal(input.fromVersion, '1.0.0');
  assert.equal(input.toVersion, '1.1.0');
  assert.equal(input.manifestRef, 'manifest://safe-app/1.1.0');
  assert.deepEqual(input.selectedDelta, ['ship 1.1.0']);
  assert.deepEqual(input.rejectedDelta, ['skip experimental flag']);
  assert.equal(input.approval.status, 'APPROVED');
});

test('release manifest cannot omit the source Current version', () => {
  assert.throws(
    () => createReleaseManifest({ appId: 'safe-app', version: '1.1.0', sourceRevision: 's', artifactSha: 'a', destination: 'safe-runtime', workId: 'W', checkpointId: 'CP', evidenceRefs: ['e'] }),
    /fromVersion is required/,
  );
});
