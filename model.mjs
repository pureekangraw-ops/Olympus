export const STATES = Object.freeze({ CANDIDATE:"CANDIDATE", OUTBOUND_READY:"OUTBOUND_READY", OUTBOUND_BLOCKED:"OUTBOUND_BLOCKED", RELEASED:"RELEASED", READBACK_PENDING:"READBACK_PENDING", VERIFIED:"VERIFIED", MISMATCH:"MISMATCH", UNKNOWN:"UNKNOWN" });
export const cloneValue = value => structuredClone(value);
export function assertRequired(value, name) { const result = String(value ?? "").trim(); if (!result) throw new Error(`${name} is required`); return result; }
export function assertAppId(value) { return assertRequired(value, "appId").toLowerCase().replace(/[^a-z0-9._-]/g, "-"); }
