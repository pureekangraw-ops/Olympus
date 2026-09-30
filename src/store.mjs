import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

export const emptyState = () => ({
  schemaVersion: 3,
  apps: {},
  versions: {},
  versionHistory: {},
  cases: [],
  cards: [],
  updates: {},
  rollbacks: {},
  events: [],
});

const clone = value => structuredClone(value);
const locks = new Map();

function migrate(state) {
  const next = { ...emptyState(), ...(state || {}) };
  next.schemaVersion = Math.max(Number(next.schemaVersion || 0), 3);
  next.versionHistory ||= {};
  next.rollbacks ||= {};
  next.cases ||= []; next.cards ||= []; next.updates ||= {}; next.events ||= [];
  for (const [appId, current] of Object.entries(next.versions || {})) {
    next.versionHistory[appId] ||= [];
    if (current && !next.versionHistory[appId].some(entry => entry.version === current.version && entry.sourceRevision === current.sourceRevision)) {
      next.versionHistory[appId].push({ ...clone(current), recordedAt: current.updatedAt || new Date().toISOString() });
    }
  }
  return next;
}

export class JsonStore {
  constructor(filePath) { this.filePath = filePath; }
  async read() {
    try { return migrate(JSON.parse(await readFile(this.filePath, "utf8"))); }
    catch (error) { if (error.code === "ENOENT") return emptyState(); throw error; }
  }
  async write(state) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = join(dirname(this.filePath), `.${this.filePath.split("/").pop()}.${process.pid}.${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(migrate(state), null, 2) + "\n", "utf8");
    await rename(temp, this.filePath);
    return clone(state);
  }
  async transact(fn) {
    const previous = locks.get(this.filePath) || Promise.resolve();
    let resolve;
    const current = new Promise(r => { resolve = r; });
    locks.set(this.filePath, previous.catch(() => {}).then(async () => {
      try {
        const state = await this.read();
        const result = await fn(state);
        await this.write(state);
        return clone(result);
      } finally { resolve(); }
    }));
    try { return await locks.get(this.filePath); }
    finally { if (locks.get(this.filePath) === current) locks.delete(this.filePath); }
  }
}
