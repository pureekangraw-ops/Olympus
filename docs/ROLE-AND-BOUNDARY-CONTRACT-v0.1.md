# OLYMPUS — Role & Boundary Contract v0.1

**Status:** `DRAFT v0.1 — awaiting BIG approval`

This document defines the proposed role and boundary of OLYMPUS. It is a documentation-only contract. It does not implement or change runtime behavior, APIs, schemas, routes, authority, Control Room ownership, or AION integration.

## 1. Core Role

OLYMPUS is the system's **Current Governance Command Center**. It maintains a trustworthy view of Current across participating systems without becoming the central CPU or doing work on behalf of the cities and cores that own that work.

OLYMPUS is responsible for:

- collecting and organizing information submitted by participating systems/cities;
- checking submissions against the applicable Contract;
- detecting conflicts, stale state, missing evidence, and incomplete provenance;
- controlling promotion into Current;
- maintaining the system-level Current Version Registry.

OLYMPUS organizes and verifies truth supplied by its owners. It does not create Truth by itself.

## 2. Non-Role / Boundary

OLYMPUS is not the central CPU, a general-purpose worker, or a sovereign authority.

OLYMPUS must not:

- create Truth without an authoritative Source or required Evidence;
- process work or produce artifacts on behalf of Core or a city that owns the work;
- take ownership of another city's Source, Artifact, Work, or Runtime;
- decide Policy, Product Meaning, or Authority on behalf of BIG;
- overwrite an owner's Current without the authority and evidence required by Contract;
- turn uncertainty into Current merely to make the system appear complete.

**Registry is not ownership:** OLYMPUS owns the system-level registry and its governance records. The real owner retains ownership of the Source and Artifact.

## 3. Input / Output

### Inputs

OLYMPUS receives or reads, from the responsible source or owner:

- `status`;
- `version`;
- `revision`;
- `evidence`;
- `provenance`;
- system, artifact, or record identity;
- Source / Artifact owner;
- applicable Contract and constraints;
- conflict, stale-state, and revision information.

If identity, ownership, or provenance cannot be established, the result remains `UNKNOWN`.

### Outputs

OLYMPUS may return one or more of:

- `CURRENT_STATE`;
- `CURRENT_VERSION`;
- `CONFLICT`;
- `STALE`;
- `REJECTED`;
- `RETURN_FOR_REVISION`;
- `ESCALATION_REQUIRED`;
- `UNKNOWN`;
- `PENDING_VERIFICATION`.

`PENDING_VERIFICATION` means that the evidence or readback required to claim Current is not complete. It must not be treated as `CURRENT`.

Every material result must point back to the relevant Source, Artifact, and Evidence.

## 4. Current Promotion Rule

A record or version may be promoted to `CURRENT` only when:

1. the system, artifact, or record identity is established;
2. the version and revision are established;
3. provenance and the real owner are established;
4. required evidence for the claim is verifiable;
5. the submission satisfies the applicable Contract and does not conflict with a higher-authority Current;
6. the required readback or verification for that change type is available.

> **Newest does not automatically mean Current.**

A newer version becomes Current only after it passes the applicable checks and is accepted under Contract. If the evidence is insufficient, OLYMPUS must use `UNKNOWN` or `PENDING_VERIFICATION`, or return the submission for revision. It must not promote by inference.

## 5. Escalation Rule

### Return to the source

When a submission violates Contract, is incomplete, lacks provenance, has an unclear version/revision, or lacks required evidence, OLYMPUS must:

- return it to the responsible source;
- identify the failed Contract or Rule;
- identify the missing correction or evidence;
- preserve the previous Current until a compliant update is verified.

### Escalate to BIG

OLYMPUS must escalate when:

- a conflict cannot be resolved by the existing Contract;
- the conflict concerns Policy, Product Meaning, or Authority;
- multiple owners exist without a clear authority order;
- resolving the issue requires changing the Contract or authority boundary;
- a Current decision affects other systems or cities beyond the original scope.

OLYMPUS must not silently decide these matters for BIG. It must expose `ESCALATION_REQUIRED`.

## 6. Version Authority

OLYMPUS holds the **system-level Current Version Registry** for participating systems. The Registry must be able to answer:

- which system or artifact is referring to which Current Version;
- which revision produced that version;
- who the real Source / Artifact owner is;
- where provenance and evidence are located;
- when and under which checks the version was promoted;
- whether conflict, stale state, or verification gaps remain.

The Registry does not transfer ownership from the Source / Artifact owner to OLYMPUS. Every Current Version must be traceable back to the real owner. Registry membership alone does not grant OLYMPUS authority over the source system's runtime or meaning.

## Future Boundary — AION

In the future, AION may query OLYMPUS for:

- Current Version;
- Current State;
- Current Route;
- relevant verification and conflict signals.

This is only a conceptual boundary for future design. This document does not design or implement AION, an API, a schema, or a runtime flow.

## Control Room Boundary

The existing GO Hub Control Room is a **candidate** for future ownership review under OLYMPUS because it exposes Current, Reality, Version, and observation surfaces.

This contract does **not** authorize:

- moving ownership;
- deleting or editing the existing Control Room;
- changing GO Hub runtime;
- changing routes or authority.

Those decisions require inspection of the real implementation and successful live validation first.

## Explicit Non-Goals — v0.1

This change does not include:

- creating an API;
- designing a large schema;
- designing a full system pipeline;
- moving the Control Room;
- changing GO Hub;
- changing AION;
- changing existing authority;
- creating a new city or AI;
- promoting this document to Current.

## Acceptance Questions

This contract is complete when a reader can answer immediately:

- **What does OLYMPUS do?** Organize, check Contract, detect conflict, and control Current promotion.
- **What does OLYMPUS not do?** It does not create Truth, do city work, or decide Policy for BIG.
- **What can enter Current?** A record with verified identity, version/revision, provenance, and required evidence under Contract.
- **Who decides unresolved conflict?** BIG, when Contract cannot resolve it or Policy / Authority is involved.
- **Who holds version truth?** OLYMPUS holds the Current Version Registry; the real owner retains Source / Artifact ownership.

**No Current promotion is authorized by this draft.**