import { assertRequired, cloneValue } from './model.mjs';

export const RELEASE_MANIFEST_SCHEMA = 'OLYMPUS_RELEASE_MANIFEST_V1';

export function createReleaseManifest(input = {}) {
  return validateReleaseManifest({
    schema: RELEASE_MANIFEST_SCHEMA,
    appId: assertRequired(input.appId, 'appId'),
    version: assertRequired(input.version, 'version'),
    channel: input.channel || 'stable',
    sourceRevision: assertRequired(input.sourceRevision, 'sourceRevision'),
    artifactSha: assertRequired(input.artifactSha, 'artifactSha'),
    checksumAlgorithm: input.checksumAlgorithm || 'sha256',
    artifactRef: input.artifactRef || null,
    destination: assertRequired(input.destination, 'destination'),
    workId: assertRequired(input.workId, 'workId'),
    checkpointId: assertRequired(input.checkpointId, 'checkpointId'),
    evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [],
    createdAt: input.createdAt || new Date().toISOString(),
  });
}

export function validateReleaseManifest(value = {}) {
  if (value.schema !== RELEASE_MANIFEST_SCHEMA) throw new Error('RELEASE_MANIFEST_SCHEMA_INVALID');
  for (const key of ['appId', 'version', 'sourceRevision', 'artifactSha', 'checksumAlgorithm', 'destination', 'workId', 'checkpointId']) assertRequired(value[key], key);
  if (!['stable', 'beta', 'dev'].includes(value.channel || 'stable')) throw new Error('RELEASE_CHANNEL_INVALID');
  if (!Array.isArray(value.evidenceRefs)) throw new Error('RELEASE_EVIDENCE_INVALID');
  return cloneValue(value);
}

export function manifestToUpdateInput(manifest, approval = { status: 'PENDING' }) {
  const value = validateReleaseManifest(manifest);
  return {
    workId: value.workId, checkpointId: value.checkpointId, appId: value.appId,
    fromVersion: value.fromVersion, toVersion: value.version,
    channel: value.channel, sourceRevision: value.sourceRevision, artifactSha: value.artifactSha,
    checksumAlgorithm: value.checksumAlgorithm, manifestRef: value.artifactRef,
    destination: value.destination, selectedDelta: value.selectedDelta || ['release manifest'],
    evidence: value.evidenceRefs, approval,
  };
}
