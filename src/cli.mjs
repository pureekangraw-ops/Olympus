import { startFromFile } from "./server.mjs";
const file = process.env.OLYMPUS_STATE || "./.olympus/state.json";
const port = Number(process.env.PORT || 8787);
const { port:actual } = await startFromFile(file, port);
console.log(`OLYMPUS listening on http://127.0.0.1:${actual}`);
