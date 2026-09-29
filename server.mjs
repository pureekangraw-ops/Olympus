import http from "node:http";
import { URL } from "node:url";
import { JsonStore } from "./store.mjs";
import { OlympusSystem } from "./engine.mjs";

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
async function body(req) { let raw=""; for await (const chunk of req) raw+=chunk; return raw ? JSON.parse(raw) : {}; }
function route(path) { return path.split("/").filter(Boolean); }

export function createOlympusServer({ system } = {}) {
  if (!system) throw new Error("system is required");
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost"), parts = route(url.pathname), method = req.method;
      if (method === "GET" && url.pathname === "/health") return json(res, 200, { ok:true, system:"OLYMPUS", builder:"LIGHT", authority:"BIG" });
      if (method === "GET" && url.pathname === "/snapshot") return json(res, 200, await system.snapshot());
      if (method === "GET" && url.pathname === "/cards") { const state=await system.snapshot(); return json(res, 200, state.cards.filter(card => !url.searchParams.get("appId") || card.appId === url.searchParams.get("appId"))); }
      const input = method === "POST" ? await body(req) : null;
      if (method === "POST" && parts[0] === "apps" && parts.length === 1) return json(res, 201, await system.registerApp(input));
      if (method === "POST" && parts[0] === "apps" && parts[2] === "current") return json(res, 201, await system.registerCurrent({ ...input, appId: parts[1] }));
      if (method === "POST" && parts[0] === "cases") return json(res, 201, await system.recordCase(input));
      if (method === "POST" && parts[0] === "references") return json(res, 201, await system.referenceCard(input));
      if (method === "POST" && parts[0] === "updates" && parts.length === 1) return json(res, 201, await system.createUpdate(input));
      if (method === "POST" && parts[0] === "updates" && parts[2] === "preflight") return json(res, 200, await system.preflight(parts[1]));
      if (method === "POST" && parts[0] === "updates" && parts[2] === "release") return json(res, 200, await system.release(parts[1]));
      if (method === "POST" && parts[0] === "updates" && parts[2] === "readback") return json(res, 200, await system.readback({ ...input, workId: parts[1] }));
      if (method === "POST" && parts[0] === "debug") return json(res, 201, await system.debug(input));
      return json(res, 404, { error:"NOT_FOUND" });
    } catch (error) { return json(res, 400, { error:error.message }); }
  });
}

export async function startFromFile(filePath, port=8787) {
  const system = new OlympusSystem({ store:new JsonStore(filePath) });
  const server = createOlympusServer({ system });
  await new Promise(resolve => server.listen(port, resolve));
  return { server, system, port:server.address().port };
}
