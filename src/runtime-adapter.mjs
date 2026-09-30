import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const required = (value, label) => { const result = String(value ?? '').trim(); if (!result) throw new Error(`${label} is required`); return result; };

export function createFileRuntimeAdapter({ root }) {
  const base = resolve(required(root, 'root'));
  const appRoot = appId => join(base, 'apps', required(appId, 'appId'));
  const versionRoot = (appId, version) => join(appRoot(appId), 'versions', required(version, 'version'));
  const currentFile = appId => join(appRoot(appId), 'current.json');
  async function atomicJson(path, value) {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await rename(temp, path);
  }
  return Object.freeze({
    async install(input = {}) {
      const appId = required(input.appId, 'appId'), version = required(input.version, 'version');
      const sourceDir = resolve(required(input.sourceDir, 'sourceDir'));
      const destination = versionRoot(appId, version);
      await rm(destination, { recursive: true, force: true });
      await mkdir(destination, { recursive: true });
      await cp(sourceDir, destination, { recursive: true });
      return { ok: true, appId, version, destination, artifactSha: input.artifactSha || null };
    },
    async activate(input = {}) {
      const appId = required(input.appId, 'appId'), version = required(input.version, 'version');
      const path = versionRoot(appId, version);
      await readFile(join(path, input.entrypoint || ''));
      const record = { appId, version, sourceRevision: input.sourceRevision || null, artifactSha: input.artifactSha || null, destination: input.destination || appRoot(appId), activatedAt: new Date().toISOString() };
      await atomicJson(currentFile(appId), record);
      return record;
    },
    async readback(appId) {
      try { return JSON.parse(await readFile(currentFile(appId), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async rollback(input = {}) {
      return this.activate(input);
    },
  });
}
