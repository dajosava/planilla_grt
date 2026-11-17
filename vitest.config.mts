import path from "node:path";
import {fileURLToPath} from "node:url";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vitest/config";

const root=path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
 plugins:[react()],
 test:{
  environment:"node",
  setupFiles:["./vitest.setup.ts"],
  include:["tests/**/*.{test,spec}.{ts,tsx}","src/**/*.{test,spec}.{ts,tsx}"],
  exclude:["node_modules",".next","e2e"],
 },
 resolve:{
  alias:{"@":path.resolve(root,"./src")},
 },
});
