import { randomUUID } from "node:crypto";
import { STATES, assertAppId, assertRequired, assertVersionForScheme, compareVersions, cloneValue } from "./model.mjs";

const id = prefix => `${prefix}-${randomUUID()}`;
const card = (type, body, now) => ({ cardId: id(type), cardType: type, createdAt: now(), ...cloneValue(body) });
const list = value => Array.isArray(value) ? value : [];

export class OlympusSystem {
  constructor({ store, now = () => new Date().toISOString(), actor = "LIGHT" } = {}) {
    if (!store) throw new Error("store is required");
    this.store = store; this.now = now; this.actor = actor;
  }
  async mutate(fn) { return this.store.transact(state => fn(state)); }
  async registerApp(profile) { return this.mutate(state => {
    const appId = assertAppId(profile.appId);
    if (state.apps[appId]) throw new Error(`app already registered: ${appId}`);
    const integration = cloneValue(profile.integration || {});
    state.apps[appId] = {
      kind: "APP_PROFILE", appId, name: profile.name || appId,
      versionScheme: profile.versionScheme || "custom",
      destination: assertRequired(profile.destination, "destination"),
      storage: cloneValue(profile.storage || {}),
      release: cloneValue(profile.release || integration.release || {}),
      readback: cloneValue(profile.readback || integration.readback || {}),
      rollback: cloneValue(profile.rollback || integration.rollback || {}),
      integration: {
        mode: integration.mode || "PULL",
        manifestPath: integration.manifestPath || `/.well-known/olympus/${appId}.json`,
        release: cloneValue(integration.release || profile.release || {}),
        readback: cloneValue(integration.readback || profile.readback || {}),
        rollback: cloneValue(integration.rollback || profile.rollback || {}),
      },
      rules: { requireApproval: true, requireEvidence: true, allowDowngrade: false, requireManifest: false, ...(profile.rules || {}) },
      createdAt: this.now(),
    };
    if (!state.versionHistory) state.versionHistory = {};
    state.versionHistory[appId] ||= [];
    this.event(state, "APP_REGISTERED", { appId });
    return state.apps[appId];
  }); }
  async registerCurrent(input) { return this.mutate(state => {
    const appId = assertAppId(input.appId); this.app(state, appId);
    if (state.versions[appId]) throw new Error("CURRENT_ALREADY_REGISTERED_USE_RELEASE_READBACK");
    if (!state.versionHistory) state.versionHistory = {};
    state.versionHistory[appId] ||= [];
    const version = this.versionRecord(input, "CURRENT", state.apps[appId]);
    this.recordVersion(state, appId, version, null);
    this.event(state, "CURRENT_BOOTSTRAPPED", { appId, version: version.version });
    return version;
  }); }
  async listApps() {
    const state = await this.snapshot();
    return Object.values(state.apps).map(app => ({
      ...cloneValue(app), current: cloneValue(state.versions[app.appId] || null),
      versionCount: list(state.versionHistory?.[app.appId]).length,
    }));
  }
  async appStatus(appIdInput) {
    const appId = assertAppId(appIdInput), state = await this.snapshot();
    const app = this.app(state, appId);
    return {
      app: cloneValue(app), current: cloneValue(state.versions[appId] || null),
      versions: cloneValue(list(state.versionHistory?.[appId])),
      updates: Object.values(state.updates).filter(update => update.appId === appId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(cloneValue),
    };
  }
  async currentVersion(appIdInput) {
    const appId = assertAppId(appIdInput), state = await this.snapshot();
    this.app(state, appId); return cloneValue(state.versions[appId] || null);
  }
  async versions(appIdInput) {
    const appId = assertAppId(appIdInput), state = await this.snapshot();
    this.app(state, appId); return cloneValue(list(state.versionHistory?.[appId]));
  }
  async integrationManifest(appIdInput) {
    const appId = assertAppId(appIdInput), state = await this.snapshot();
    const app = this.app(state, appId);
    return {
      schemaVersion: 1, system: "OLYMPUS",
      app: { appId: app.appId, name: app.name, versionScheme: app.versionScheme, destination: app.destination, integration: cloneValue(app.integration) },
      current: cloneValue(state.versions[appId] || null),
      versionCount: list(state.versionHistory?.[appId]).length,
      endpoints: {
        status: `/apps/${appId}`, current: `/apps/${appId}/current`,
        versions: `/apps/${appId}/versions`, updates: `/apps/${appId}/updates`,
        readback: "/updates/{workId}/readback",
      },
    };
  }
  async recordCase(input) { return this.mutate(state => {
    const entry = { kind: "CASE_REFERENCE", caseId: input.caseId || id("CASE"), appId: assertAppId(input.appId), summary: assertRequired(input.summary, "summary"), result: input.result || STATES.UNKNOWN, evidence: cloneValue(input.evidence || []), createdAt: this.now() };
    state.cases.push(entry); this.event(state, "CASE_RECORDED", { caseId: entry.caseId, appId: entry.appId }); return entry;
  }); }
  async referenceCard(input) { return this.mutate(state => {
    const appId = assertAppId(input.appId), current = state.versions[appId] || null;
    const output = card("REFERENCE", { kind: "WORK_CARD", workId: assertRequired(input.workId, "workId"), checkpointId: assertRequired(input.checkpointId, "checkpointId"), appId, query: input.query || null, current: current && cloneValue(current), cases: state.cases.filter(x => x.appId === appId), status: current ? "READY" : STATES.UNKNOWN, unknowns: current ? [] : ["CURRENT_VERSION"] }, this.now);
    state.cards.push(output); this.event(state, "REFERENCE_CARD_CREATED", { cardId: output.cardId, appId }); return output;
  }); }
  async createUpdate(input) { return this.mutate(state => {
    const appId = assertAppId(input.appId), app = this.app(state, appId), current = state.versions[appId];
    if (!current) throw new Error("CURRENT_VERSION_UNKNOWN");
    if (current.version !== assertRequired(input.fromVersion, "fromVersion")) throw new Error("fromVersion does not match Current");
    const workId = assertRequired(input.workId, "workId");
    if (state.updates[workId]) throw new Error("UPDATE_ALREADY_EXISTS");
    const toVersion = assertVersionForScheme(input.toVersion, app.versionScheme);
    const direction = compareVersions(toVersion, current.version, app.versionScheme);
    if (direction < 0 && !app.rules.allowDowngrade) throw new Error("DOWNGRADE_NOT_ALLOWED");
    const update = { kind: "UPDATE", workId: assertRequired(input.workId, "workId"), checkpointId: assertRequired(input.checkpointId, "checkpointId"), appId, fromVersion: current.version, toVersion, channel: input.channel || "stable", checksumAlgorithm: input.checksumAlgorithm || "sha256", manifestRef: input.manifestRef || null, sourceRevision: assertRequired(input.sourceRevision, "sourceRevision"), artifactSha: assertRequired(input.artifactSha, "artifactSha"), destination: assertRequired(input.destination, "destination"), selectedDelta: cloneValue(input.selectedDelta || []), rejectedDelta: cloneValue(input.rejectedDelta || []), evidence: cloneValue(input.evidence || []), approval: cloneValue(input.approval || { status: "PENDING" }), appDestination: app.destination, status: STATES.CANDIDATE, createdAt: this.now() };
    state.updates[update.workId] = update;
    const output = card("UPDATE", { kind: "WORK_CARD", ...update }, this.now); state.cards.push(output); this.event(state, "UPDATE_CREATED", { workId: update.workId, appId }); return output;
  }); }
  async preflight(workId) { return this.mutate(state => {
    const update = this.update(state, workId), reasons = [], app = this.app(state, update.appId);
    if (![STATES.CANDIDATE, STATES.OUTBOUND_READY, STATES.OUTBOUND_BLOCKED].includes(update.status)) {
      throw new Error("PREFLIGHT_STATE_INVALID");
    }
    if (update.destination !== app.destination) reasons.push("DESTINATION_MISMATCH");
    if (!update.toVersion || update.toVersion === update.fromVersion) reasons.push("VERSION_TRANSITION_INVALID");
    if (!update.selectedDelta.length) reasons.push("DELTA_MISSING");
    if (app.rules.requireManifest && !update.manifestRef) reasons.push("MANIFEST_MISSING");
    if (!update.artifactSha) reasons.push("ARTIFACT_IDENTITY_MISSING");
    if (app.rules.requireEvidence && !update.evidence.length) reasons.push("EVIDENCE_MISSING");
    if (app.rules.requireApproval && update.approval?.status !== "APPROVED") reasons.push("BIG_APPROVAL_MISSING");
    update.status = reasons.length ? STATES.OUTBOUND_BLOCKED : STATES.OUTBOUND_READY;
    const output = card("RELEASE_GATE", { kind: "WORK_CARD", ...update, gateResult: update.status, blockingReasons: reasons }, this.now); state.cards.push(output); this.event(state, "PREFLIGHT_COMPLETED", { workId, result: update.status, reasons }); return output;
  }); }
  async release(workId) { return this.mutate(state => {
    const update = this.update(state, workId); if (update.status !== STATES.OUTBOUND_READY) throw new Error("release gate is not ready");
    if ([STATES.READBACK_PENDING, STATES.VERIFIED].includes(update.status)) throw new Error("UPDATE_ALREADY_RELEASED");
    update.status = STATES.READBACK_PENDING; const output = card("RELEASE", { kind: "WORK_CARD", ...update }, this.now); state.cards.push(output); this.event(state, "RELEASED", { workId, toVersion: update.toVersion }); return output;
  }); }
  async readback(input) { return this.mutate(state => {
    const update = this.update(state, input.workId);
    if (![STATES.READBACK_PENDING, STATES.MISMATCH].includes(update.status)) {
      throw new Error("READBACK_STATE_INVALID");
    }
    const destinationMatch = input.observedDestination === update.destination;
    const matches = input.passed === true && input.observedVersion === update.toVersion && input.observedRevision === update.sourceRevision && input.observedArtifactSha === update.artifactSha && destinationMatch && (input.observedChecksumAlgorithm == null || input.observedChecksumAlgorithm === update.checksumAlgorithm);
    update.status = matches ? STATES.VERIFIED : STATES.MISMATCH;
    if (matches) this.recordVersion(state, update.appId, { appId: update.appId, version: update.toVersion, sourceRevision: update.sourceRevision, artifactSha: update.artifactSha, runtimeIdentity: input.observedRuntimeIdentity || input.observedRevision, status: "CURRENT", evidence: cloneValue(input.evidence || []), updatedAt: this.now() }, state.versions[update.appId] || null);
    const output = card("READBACK", { kind: "WORK_CARD", ...update, observedVersion: input.observedVersion, observedRevision: input.observedRevision, observedArtifactSha: input.observedArtifactSha, observedDestination: input.observedDestination, readbackResult: matches ? STATES.VERIFIED : STATES.MISMATCH, evidence: cloneValue(input.evidence || []) }, this.now);
    state.cards.push(output); this.event(state, "READBACK_COMPLETED", { workId: input.workId, result: output.readbackResult }); return output;
  }); }
  async rollback(input) { return this.mutate(state => {
    const appId = assertAppId(input.appId), app = this.app(state, appId), targetVersion = assertVersionForScheme(input.targetVersion, app.versionScheme);
    const target = list(state.versionHistory?.[appId]).find(entry => entry.version === targetVersion && entry.status !== "SUPERSEDED");
    if (!target) throw new Error("ROLLBACK_TARGET_UNKNOWN");
    if (app.rules.requireApproval && input.approval?.status !== "APPROVED") throw new Error("BIG_APPROVAL_MISSING");
    if (!Array.isArray(input.evidence) || !input.evidence.length) throw new Error("EVIDENCE_MISSING");
    const workId = assertRequired(input.workId, "workId");
    if (state.rollbacks[workId]) throw new Error("ROLLBACK_ALREADY_EXISTS");
    const record = { kind: "ROLLBACK", workId, checkpointId: assertRequired(input.checkpointId, "checkpointId"), appId, fromVersion: state.versions[appId]?.version, targetVersion, sourceRevision: target.sourceRevision, artifactSha: target.artifactSha, destination: app.destination, reason: assertRequired(input.reason, "reason"), evidence: cloneValue(input.evidence), approval: cloneValue(input.approval), status: STATES.ROLLBACK_PENDING, createdAt: this.now() };
    state.rollbacks[workId] = record; this.event(state, "ROLLBACK_REQUESTED", { workId, appId, targetVersion });
    return card("ROLLBACK", { kind: "WORK_CARD", ...record }, this.now);
  }); }
  async debug(input) { return this.mutate(state => { const output = card("DEBUG", { kind: "WORK_CARD", workId: assertRequired(input.workId, "workId"), appId: assertAppId(input.appId), symptom: assertRequired(input.symptom, "symptom"), suspectedCause: input.suspectedCause || null, evidence: cloneValue(input.evidence || []), status: STATES.UNKNOWN }, this.now); state.cards.push(output); this.event(state, "DEBUG_CARD_CREATED", { cardId: output.cardId }); return output; }); }
  async snapshot() { return this.store.read(); }
  event(state, type, data) { state.events.push({ eventId: id("EVENT"), type, actor: this.actor, at: this.now(), data: cloneValue(data) }); }
  app(state, appId) { const value = state.apps[appId]; if (!value) throw new Error(`unknown app: ${appId}`); return value; }
  update(state, workId) { const value = state.updates[assertRequired(workId, "workId")]; if (!value) throw new Error(`unknown update: ${workId}`); return value; }
  recordVersion(state, appId, version, previous) {
    if (!state.versionHistory) state.versionHistory = {};
    state.versionHistory[appId] ||= [];
    const history = state.versionHistory[appId];
    if (previous && previous.version !== version.version) {
      const previousRecord = [...history].reverse().find(entry => entry.version === previous.version && entry.sourceRevision === previous.sourceRevision && entry.status !== "SUPERSEDED");
      if (previousRecord) {
        previousRecord.status = "SUPERSEDED";
        previousRecord.supersededAt = this.now();
      } else {
        history.push({ ...cloneValue(previous), status: "SUPERSEDED", supersededAt: this.now() });
      }
    }
    const last = history.at(-1);
    if (!last || last.version !== version.version || last.sourceRevision !== version.sourceRevision) history.push({ kind: "VERSION_TRUTH", recordedAt: this.now(), ...cloneValue(version) });
    state.versions[appId] = { kind: "VERSION_TRUTH", ...cloneValue(version) };
  }
  versionRecord(input, status, app = null) { return { kind: "VERSION_TRUTH", appId: assertAppId(input.appId), version: assertVersionForScheme(input.version, app?.versionScheme || "custom"), sourceRevision: assertRequired(input.sourceRevision, "sourceRevision"), artifactSha: assertRequired(input.artifactSha, "artifactSha"), runtimeIdentity: assertRequired(input.runtimeIdentity, "runtimeIdentity"), status, evidence: cloneValue(input.evidence || []), updatedAt: this.now() }; }
}