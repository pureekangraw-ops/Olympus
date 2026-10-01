import { assertAppId, cloneValue } from './model.mjs';

export const AION_SCHEMA = 'AION_TRUST_PROOF_V1';
export const AION_STATUS = Object.freeze({ VERIFIED:'VERIFIED', MISMATCH:'MISMATCH', STALE:'STALE', UNKNOWN:'UNKNOWN' });
const text = value => String(value ?? '').trim();
const safeAppId = value => { try { return assertAppId(value); } catch { return null; } };

function proof(input, overrides = {}) {
  return Object.freeze({
    schema: AION_SCHEMA,
    appId: safeAppId(input?.appId),
    version: text(input?.version) || null,
    sourceRevision: text(input?.sourceRevision) || null,
    artifactSha: text(input?.artifactSha) || null,
    destination: text(input?.destination) || null,
    target: null,
    releaseTruthRef: null,
    verifiedAt: null,
    status: AION_STATUS.UNKNOWN,
    reason: 'TRUTH_UNKNOWN',
    unknowns: ['RELEASE_TRUTH_UNAVAILABLE'],
    ...cloneValue(overrides),
  });
}

export function createConnectionPoint(input = {}) {
  const appId = safeAppId(input.appId);
  const target = text(input.target);
  const releaseTruthRef = text(input.releaseTruthRef);
  if (!appId || !target || !releaseTruthRef) throw new Error('AION_CONNECTION_POINT_INVALID');
  return Object.freeze({
    appId,
    name: text(input.name) || appId,
    target,
    endpoint: text(input.endpoint) || null,
    releaseTruthRef,
    direct: input.direct !== false,
  });
}

function connectionPoint(manifest) {
  const integration = manifest?.app?.integration;
  if (integration?.mode !== 'DIRECT') return null;
  const value = integration.connectionPoint;
  if (!value || typeof value !== 'object') return null;
  try {
    const point = createConnectionPoint(value);
    return point.direct === true ? point : null;
  } catch { return null; }
}

export function createAionResolver({ system, now = () => new Date().toISOString() } = {}) {
  if (!system || typeof system.integrationManifest !== 'function' || typeof system.currentVersion !== 'function') throw new Error('AION_OLYMPUS_SYSTEM_REQUIRED');
  return Object.freeze({
    async resolve(input = {}) {
      const appId = safeAppId(input.appId);
      if (!appId) return proof(input, { reason:'APP_ID_UNKNOWN', unknowns:['APP_ID_UNKNOWN'] });
      let manifest;
      let current;
      try {
        [manifest, current] = await Promise.all([system.integrationManifest(appId), system.currentVersion(appId)]);
      } catch {
        return proof({ ...input, appId }, { reason:'APP_PROFILE_OR_CURRENT_UNKNOWN', unknowns:['APP_PROFILE_OR_CURRENT_UNKNOWN'] });
      }
      const point = connectionPoint(manifest);
      const base = {
        appId,
        destination: manifest?.app?.destination || null,
      };
      if (!current || current.status !== 'CURRENT') return proof(input, { ...base, reason:'CURRENT_VERSION_UNKNOWN', unknowns:['CURRENT_VERSION_UNKNOWN'] });
      if (!point) return proof(input, { ...base, reason:'CONNECTION_POINT_UNKNOWN', unknowns:['CONNECTION_POINT_UNKNOWN'] });
      const verifiedBase = {
        ...base,
        target: point.target,
        releaseTruthRef: point.releaseTruthRef || current.provenanceRef || null,
      };
      if (!verifiedBase.releaseTruthRef) return proof(input, { ...base, reason:'RELEASE_TRUTH_REF_UNKNOWN', unknowns:['RELEASE_TRUTH_REF_UNKNOWN'] });
      const required = ['version','sourceRevision','artifactSha','destination'];
      const missing = required.filter(key => !text(input[key]));
      if (missing.length) return proof(input, { ...base, reason:'RESOLUTION_INPUT_UNKNOWN', unknowns:missing.map(key => `${key.toUpperCase()}_UNKNOWN`) });
      if (text(input.version) !== current.version) return proof(input, { ...base, status:AION_STATUS.STALE, reason:'REQUESTED_VERSION_STALE', unknowns:[] });
      const mismatch = [
        ['sourceRevision', current.sourceRevision],
        ['artifactSha', current.artifactSha],
        ['destination', manifest.app.destination],
      ].find(([key, expected]) => text(input[key]) !== text(expected));
      if (mismatch) return proof(input, { ...base, status:AION_STATUS.MISMATCH, reason:`${mismatch[0].toUpperCase()}_MISMATCH`, unknowns:[] });
      return proof(input, { ...verifiedBase, status:AION_STATUS.VERIFIED, reason:'OLYMPUS_TRUTH_MATCHED', verifiedAt:now(), unknowns:[] });
    },
    async registry() {
      if (typeof system.currentRegistry !== 'function') return [];
      const entries = await system.currentRegistry();
      return Promise.all(entries.map(async entry => {
        try {
          const manifest = await system.integrationManifest(entry.systemId);
          const point = connectionPoint(manifest);
          return { ...cloneValue(entry), target:point?.target || null, releaseTruthRef:point?.releaseTruthRef || entry.provenanceRef || null };
        } catch { return { ...cloneValue(entry), target:null, releaseTruthRef:null, currentStatus:AION_STATUS.UNKNOWN }; }
      }));
    },
  });
}
