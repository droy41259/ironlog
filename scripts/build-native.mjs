// Builds the static web bundle that ships inside the Capacitor Android/iOS apps.
//
// Next.js `output: "export"` cannot coexist with dynamic API routes
// (/api/gemini, /api/health are force-dynamic). The native apps don't need
// them — they call the hosted proxy over the network — so we temporarily move
// the `api` directory out of the App Router during the export, then restore it.
//
// The try/finally (plus the restore-on-start guard) guarantees the source tree
// is put back even if the build fails or is interrupted.
import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "src", "app", "api");
const stashDir = join(root, ".api-stash");

// Recover from a previously interrupted run.
if (existsSync(stashDir) && !existsSync(apiDir)) {
  renameSync(stashDir, apiDir);
}

let stashed = false;
try {
  if (existsSync(apiDir)) {
    renameSync(apiDir, stashDir);
    stashed = true;
  }
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "native" },
  });
} finally {
  if (stashed && existsSync(stashDir)) {
    renameSync(stashDir, apiDir);
  }
}
