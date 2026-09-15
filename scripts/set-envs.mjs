import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(new URL(import.meta.url))), "..");

const FALLBACKS = {
  APIURL: "http://localhost:3000",
  PUBLICURL: "http://localhost:4201",
  TURNSTILESITEKEY: "1x00000000000000000000AA",
};

for (const file of ["src/environments/environment.ts", "src/environments/environment.prod.ts"]) {
  const path = resolve(root, file);
  let source = readFileSync(path, "utf8");

  source = source.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) => {
    return process.env[name] ?? FALLBACKS[name] ?? match;
  });

  writeFileSync(path, source);
}