# AION → OLYMPUS migration v1

This is a compatibility-first migration seam. It does not remove `go-hub-aion.mjs`, the GO Hub Control Room, or any existing consumer.

## Contract

```txt
OLYMPUS release truth → AION resolve/confirm → verified App target
```

AION is a read-only confirmer. It does not select work routes, create work, execute a tool, or replace the target App's runtime owner.

## Release truth

OLYMPUS owns `OLYMPUS_RELEASE_MANIFEST_V1` and the Current Version Registry. A proof is `VERIFIED` only when the request matches the registered `appId`, `version`, `sourceRevision`, `artifactSha`, and `destination`, and the App Profile has a declared direct connection point and `releaseTruthRef`.

The resolver returns a trust proof containing:

- `appId`
- `version`
- `sourceRevision`
- `artifactSha`
- `destination`
- `target`
- `releaseTruthRef`
- `verifiedAt`
- `status`

Missing app, Current, connection point, release reference, or required input stays `UNKNOWN`; no target or release reference is guessed. A version mismatch is `STALE`; a known artifact/source/destination mismatch is `MISMATCH`.

## Direct App connection

An App Profile may declare:

```json
{
  "integration": {
    "mode": "DIRECT",
    "connectionPoint": {
      "appId": "prism",
      "target": "app://prism-owner",
      "endpoint": "https://example.invalid/aion",
      "releaseTruthRef": "github://pureekangraw-ops/Olympus/OLYMPUS_RELEASE_MANIFEST_V1/prism"
    }
  }
}
```

The App can consume `POST /aion/resolve` or `GET /aion/registry` directly. GO Hub remains an orchestration consumer through a compatibility adapter; it is not the owner of AION.

## Migration gates

1. Baseline `go-hub-aion.mjs` and its tests remain unchanged.
2. Olympus resolver tests cover verified, stale, mismatch, missing Current, missing connection point, and registry readback.
3. Consumer adapters remain available while direct App connections are validated.
4. Cutover requires E2E evidence for valid/invalid/stale/missing/rollback paths.
5. Only after E2E and owner approval may the legacy Control Room dependency be removed.
