import { assertRequired, cloneValue } from './model.mjs';

export const RELEASE_MANIFEST_SCHEMA = 'OLYMPUS_RELEASE_MANIFEST_V1';

function list(value, fallback = []) {
  if (value == null) return cloneValue(fallback);
  if (!Array.isArray(value)) throw new Error('RELEASE_MANIFEST_LIST_INVALID');
  return cloneValue(value);
}

export function createReleaseManifest(input = {}) {
  return validateReleaseManifest({
    schema: RELEASE_MANIFEST_SCHEMA,
    appId: assertRequired(input.appId, 'appId'),
    fromVersion: assertRequired(input.fromVersion, 'fromVersion'),
    version: assertRequired(input.version, 'version'),
    channel: input.channel || 'stable',
    sourceRevision: assertRequired(input.sourceRevision, 'sourceRevision'),
    artifactSha: assertRequired(input.artifactSha, 'artifactSha'),
    checksumAlgorithm: input.checksumAlgorithm || 'sha256',
    artifactRef: input.artifactRef || null,
    destination: assertRequired(input.destination, 'destination'),
    workId: assertRequired(input.workId, 'workId'),
    checkpointId: assertRequired(input.checkpointId, 'checkpointId'),
    selectedDelta: list(input.selectedDelta, ['release manifest']),
    rejectedDelta: list(input.rejectedDelta),
    evidenceRefs: list(input.evidenceRefs),
    createdAt: input.createdAt || new Date().toISOString(),
  });
}

export function validateReleaseManifest(value = {}) {
  if (value.schema !== RELEASE_MANIFEST_SCHEMA) throw new Error('RELEASE_MANIFEST_SCHEMA_INVALID');
  for (const key of ['appId', 'fromVersion', 'version', 'sourceRevision', 'artifactSha', 'checksumAlgorithm', 'destination', 'workId', 'checkpointId']) {
    assertRequired(value[key], key);
  }
  if (!['stable', 'beta', 'dev'].includes(value.channel || 'stable')) throw new Error('RELEASE_CHANNEL_INVALID');
  for (const key of ['selectedDelta', 'rejectedDelta', 'evidenceRefs']) {
    if (!Array.isArray(value[key])) throw new Error(`RELEASE_${key.toUpperCase()}_INVALID`);
  }
  if (!value.selectedDelta.length) throw new Error('RELEASE_SELECTEDDELTA_EMPTY');
  return cloneValue(value);
}

export function manifestToUpdateInput(manifest, approval = { status: 'PENDING' }) {
  const value = validateReleaseManifest(manifest);
  return {
    workId: value.workId,
    checkpointId: value.checkpointId,
    appId: value.appId,
    fromVersion: value.fromVersion,
    toVersion: value.version,
    channel: value.channel,
    sourceRevision: value.sourceRevision,
    artifactSha: value.artifactSha,
    checksumAlgorithm: value.checksumAlgorithm,
    manifestRef: value.artifactRef,
    destination: value.destination,
    selectedDelta: cloneValue(value.selectedDelta),
    rejectedDelta: cloneValue(value.rejectedDelta),
    evidence: cloneValue(value.evidenceRefs),
    approval: cloneValue(approval),
  };
}
