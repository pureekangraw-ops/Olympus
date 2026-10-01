# OLYMPUS

Standalone version-truth and release-governance system built by **LIGHT** from BIG's design.

The system-facing role and boundary are proposed in [`docs/ROLE-AND-BOUNDARY-CONTRACT-v0.1.md`](docs/ROLE-AND-BOUNDARY-CONTRACT-v0.1.md), currently `DRAFT v0.1 — awaiting BIG approval`. In that draft, **Current Governance Command Center** means governance coordination over Current, version, provenance, and evidence. It does not mean a central CPU, a city-work executor, or a runtime dependency on GO Hub.

OLYMPUS has no runtime dependency on GO Hub, Control Room, or AION. It owns its own registry, cards, evidence ledger, release gates, runtime readback, and debug loop. Target applications connect through their own App Profile and direct release/readback contract.

## Role boundary

The draft Role & Boundary Contract is documentation-only and does not change the implementation described in this README.

- OLYMPUS coordinates Current governance, checks Contract, detects conflict/stale state, and controls promotion.
- OLYMPUS is not the central CPU and does not perform work owned by a target application, Core, or city.
- The Current Version Registry is OLYMPUS's governance record; Source, Artifact, and Runtime ownership remain with their real owners.
- GO Hub Control Room and AION are future boundary/candidate topics only. No ownership move, runtime change, route change, API, or authority change is authorized by the draft.
- `PENDING_VERIFICATION` means the evidence or readback required to claim Current is not complete; it must not be treated as `CURRENT`.

Until BIG approves the draft and implementation/live validation is completed, the existing standalone runtime boundary remains authoritative.

## Internal zones

1. **Intake & Reference** — searches Version Registry and Case Library, then creates Reference Cards.
2. **Update Design & Build** — creates selected/rejected delta, artifact identity, migration and rollback plans.
3. **Release Preflight** — verifies destination, values, update data, evidence, compatibility, and BIG approval.
4. **Observe & Debug** — reads back runtime truth, preserves Current on mismatch, and records debug cases.

## Truth model

```txt
Version Registry = version truth
App Profile      = app-specific behavior
Working Card     = internal work packet
Evidence         = proof
Runtime Readback = final reality check
```

`RELEASED` is not `VERIFIED`. A new Current version is recorded only when runtime readback matches version, source revision, artifact SHA, and destination. `POST /apps/:appId/current` is a one-time bootstrap for an app with no Current; once Current exists, every later change must pass update → preflight → release → runtime readback.

## API

```txt
GET  /health
GET  /snapshot
GET  /cards
GET  /apps
GET  /apps/:appId
GET  /apps/:appId/manifest
GET  /apps/:appId/current
GET  /apps/:appId/versions
GET  /apps/:appId/updates
GET  /apps/:appId/rollbacks
POST /apps
POST /apps/:appId/current
POST /cases
POST /references
POST /updates
POST /updates/:workId/preflight
POST /updates/:workId/release
POST /updates/:workId/readback
POST /rollbacks
POST /rollbacks/:workId/readback
POST /debug
```

## Run

```sh
npm test
npm start
npm run demo
```

State is persisted as JSON through an atomic write. The core is intentionally adapter-driven: each application can define its own version scheme, storage, release method, readback method, migration rules, and rollback rules without changing OLYMPUS invariants.

## Central app integration

Register each target application once with an `appId`, destination, version scheme, and integration adapters. OLYMPUS then owns the version registry, current-version readback, update cards, release gates, and version history while the target application remains the owner of its runtime truth.

The target application can use `src/client.mjs` or call:

```txt
GET /apps/:appId/manifest
GET /apps/:appId/current
GET /apps/:appId/versions
```

An update becomes `VERIFIED` only after the target reports matching version, source revision, artifact SHA, destination, and passing readback to:

```txt
POST /updates/:workId/readback
```


## Release-path invariants

- Current cannot be overwritten directly after bootstrap.
- Readback cannot verify an update before the release gate has moved it to `READBACK_PENDING`.
- A mismatched readback may be retried; a verified update cannot be reopened through readback.
- Runtime destination is required proof. Omitting it is a mismatch, not a pass.
- A release manifest carries both `fromVersion` and target `version`, so the manifest-to-update path cannot lose the Current transition.


## Rollback invariants

- Rollback may target a `SUPERSEDED` historical version; that is the normal rollback source.
- The rollback request records the exact target version, source revision, artifact SHA, and destination.
- Current does not change when rollback is requested. It changes only after exact rollback runtime readback.
- Missing or mismatched destination/revision/artifact keeps Current unchanged and records `MISMATCH`.
- If one version number maps to multiple historical source revisions, the caller must provide `targetSourceRevision`; OLYMPUS will not guess.
