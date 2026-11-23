// Import the app's TypeScript modules (stores, components, lib) from a test: `await appModule("stores/x.ts")`.
// .ts/.tsx files (and the "@/" alias) are transpiled in memory with the project's own TypeScript through
// synchronous module hooks; no extra dependencies. No browser globals are faked: the persistence adapter
// already falls back to memory without `window`, and components render on the "server" (react-dom/server).
import { existsSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const NODE_MODULES = path.join(ROOT, "node_modules");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];
let registered = false;

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function findSource(base) {
  if (/\.(ts|tsx)$/.test(base) && isFile(base)) return base;
  for (const ext of EXTENSIONS) if (isFile(base + ext)) return base + ext;
  return null;
}

function isAppSource(file) {
  return file.startsWith(ROOT) && !file.startsWith(NODE_MODULES) && /\.(ts|tsx)$/.test(file);
}

function register() {
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith("@/")) {
        const found = findSource(path.join(ROOT, specifier.slice(2)));
        if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
      }
      const parent = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : null;
      if (parent && isAppSource(parent) && (specifier.startsWith("./") || specifier.startsWith("../"))) {
        const found = findSource(path.resolve(path.dirname(parent), specifier));
        if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith("file:")) {
        const file = fileURLToPath(url);
        if (isAppSource(file) && existsSync(file)) {
          const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
            compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
            fileName: file,
          });
          return { format: "module", source: outputText, shortCircuit: true };
        }
      }
      return next(url, context);
    },
  });
}

export async function appModule(rel) {
  if (!registered) {
    register();
    registered = true;
  }
  return import(pathToFileURL(path.join(ROOT, rel)).href);
}
