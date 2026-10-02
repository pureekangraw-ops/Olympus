export const STATES = Object.freeze({ CANDIDATE:"CANDIDATE", OUTBOUND_READY:"OUTBOUND_READY", OUTBOUND_BLOCKED:"OUTBOUND_BLOCKED", RELEASED:"RELEASED", READBACK_PENDING:"READBACK_PENDING", VERIFIED:"VERIFIED", MISMATCH:"MISMATCH", ROLLBACK_PENDING:"ROLLBACK_PENDING", ROLLED_BACK:"ROLLED_BACK", UNKNOWN:"UNKNOWN" });
export const cloneValue = value => structuredClone(value);
export function assertRequired(value, name) { const result = String(value ?? "").trim(); if (!result) throw new Error(`${name} is required`); return result; }
export function assertAppId(value) { return assertRequired(value, "appId").toLowerCase().replace(/[^a-z0-9._-]/g, "-"); }
export function assertCapabilityId(value) {
  const id = assertRequired(value, "capabilityId").toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
  if (!/^[A-Z][A-Z0-9._-]*$/.test(id)) throw new Error("CAPABILITY_ID_INVALID");
  return id;
}
export function assertVersionForScheme(value, scheme = "custom") {
  const version = assertRequired(value, "version");
  if (scheme === "semver" && !/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) throw new Error("VERSION_FORMAT_INVALID");
  return version;
}
export function compareVersions(left, right, scheme = "custom") {
  if (scheme !== "semver") return String(left).localeCompare(String(right), undefined, { numeric: true });
  const parse = value => { const match=String(value).replace(/^v/, "").split("+")[0].split("-")[0].split(".").map(Number); return match; };
  const a=parse(left), b=parse(right); for (let i=0;i<3;i+=1) if (a[i]!==b[i]) return a[i]-b[i]; return 0;
}
