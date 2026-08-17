/**
 * Spins up a real, ephemeral PocketBase instance for integration tests, so
 * server/erp.ts and server/pos.ts run against actual PocketBase behavior
 * instead of a hand-rolled mock of it. Requires the binary fetched by
 * scripts/fetch-pocketbase-test-binary.sh (into .pocketbase-test/, which is
 * git-ignored); tests using this harness skip themselves when it's absent —
 * run that script first for full local coverage.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import PocketBase from "pocketbase";
import { applyPocketbaseSchema } from "../../scripts/pocketbase-schema";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function findBinary(): string | null {
  const candidates = [process.env.POCKETBASE_BIN, path.join(REPO_ROOT, ".pocketbase-test", "pocketbase")].filter((value): value is string => Boolean(value));
  return candidates.find(existsSync) ?? null;
}

export function isPocketbaseTestBinaryAvailable(): boolean {
  return findBinary() !== null;
}

async function waitForHealth(url: string, timeoutMs = 45000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("PocketBase test instance did not become healthy in time.");
}

export type TestPocketBase = {
  url: string;
  superuserEmail: string;
  superuserPassword: string;
  pb: PocketBase;
  stop: () => Promise<void>;
};

export async function startTestPocketBase(): Promise<TestPocketBase> {
  const binary = findBinary();
  if (!binary) throw new Error("No PocketBase test binary found — run scripts/fetch-pocketbase-test-binary.sh first.");

  const dataDir = mkdtempSync(path.join(tmpdir(), "pb-test-"));
  const port = 9000 + Math.floor(Math.random() * 9000);
  const url = `http://127.0.0.1:${port}`;
  const email = "test-superuser@example.com";
  const password = "TestSuperuser123!";

  execFileSync(binary, ["superuser", "create", email, password, "--dir", dataDir], { stdio: "ignore" });
  // --automigrate defaults to true and (unhelpfully) writes its migration
  // snapshots to a directory *next to* --dir rather than inside it, so
  // concurrent instances under the same tmp root collide on one shared
  // folder. This harness bootstraps schema over the REST API instead, so
  // migration tracking is disabled outright.
  const proc: ChildProcess = spawn(binary, ["serve", `--http=127.0.0.1:${port}`, "--dir", dataDir, "--automigrate=0"], { stdio: "ignore" });

  try {
    await waitForHealth(url);
  } catch (err) {
    proc.kill();
    rmSync(dataDir, { recursive: true, force: true });
    throw err;
  }

  const pb = new PocketBase(url);
  await pb.collection("_superusers").authWithPassword(email, password);
  await applyPocketbaseSchema(pb);

  return {
    url, superuserEmail: email, superuserPassword: password, pb,
    stop: async () => {
      proc.kill();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Points server/pb.ts's admin client at this test instance. Call before importing server/erp.ts or server/pos.ts. */
export function useTestPocketBaseEnv(instance: TestPocketBase) {
  process.env.POCKETBASE_URL = instance.url;
  process.env.POCKETBASE_SUPERUSER_EMAIL = instance.superuserEmail;
  process.env.POCKETBASE_SUPERUSER_PASSWORD = instance.superuserPassword;
}
