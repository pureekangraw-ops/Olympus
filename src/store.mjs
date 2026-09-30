import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

export const emptyState = () => ({
  schemaVersion: 2,
  apps: {},
  versions: {},
  versionHistory: {},
  cases: [],
  cards: [],
  updates: {},
  events: [],
});

const clone = value => structuredClone(value);

export class JsonStore {
  constructor(filePath) { this.filePath = filePath; }
  async read() {
    try { return JSON.parse(await readFile(this.filePath, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return emptyState(); throw error; }
  }
  async write(state) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = join(dirname(this.filePath), `.${this.filePath.split("/").pop()}.${process.pid}.tmp`);
    await writeFile(temp, JSON.stringify(state, null, 2) + "\n", "utf8");
    await rename(temp, this.filePath);
    return clone(state);
  }
  async transact(fn) { const state = await this.read(); const result = await fn(state); await this.write(state); return clone(result); }
}
