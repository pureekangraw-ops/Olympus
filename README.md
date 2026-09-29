# OLYMPUS

Standalone version-truth and release-governance system built by **LIGHT** from BIG's design.

OLYMPUS has no dependency on GO Hub, Control Room, or AION. It owns its own registry, cards, evidence ledger, release gates, runtime readback, and debug loop. Target applications connect through their own App Profile and direct release/readback contract.

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

`RELEASED` is not `VERIFIED`. A new Current version is recorded only when runtime readback matches version, source revision, artifact SHA, and destination.

## API

```txt
GET  /health
GET  /snapshot
GET  /cards
POST /apps
POST /apps/:appId/current
POST /cases
POST /references
POST /updates
POST /updates/:workId/preflight
POST /updates/:workId/release
POST /updates/:workId/readback
POST /debug
```

## Run

```sh
npm test
npm start
npm run demo
```

State is persisted as JSON through an atomic write. The core is intentionally adapter-driven: each application can define its own version scheme, storage, release method, readback method, migration rules, and rollback rules without changing OLYMPUS invariants.
