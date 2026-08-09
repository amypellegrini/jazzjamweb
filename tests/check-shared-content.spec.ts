import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";

// CJS script under test — shared logic with musicpracticepro's gate.
const { checkSharedContent } = require("../scripts/check-shared-content");

const GUARDED = "src/_data/shared.json";

function git(repoDir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repoDir, encoding: "utf8" }).trim();
}

function writeFile(repoDir: string, relPath: string, contents: string): void {
  const full = path.join(repoDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function createRepo(): string {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "shared-content-"));
  git(repoDir, "init", "-q");
  git(repoDir, "config", "user.email", "test@example.com");
  git(repoDir, "config", "user.name", "Test");
  git(repoDir, "config", "commit.gpgsign", "false");
  // Isolate these fixtures from any globally configured hooks (the developer
  // machine may enforce commit signing, which would block fixture commits).
  const emptyHooks = path.join(repoDir, ".git", "empty-hooks");
  fs.mkdirSync(emptyHooks, { recursive: true });
  git(repoDir, "config", "core.hooksPath", emptyHooks);
  writeFile(repoDir, GUARDED, '{"__generated": "workbench", "paywall": {}}\n');
  writeFile(repoDir, "src/index.html", "<html></html>\n");
  git(repoDir, "add", "-A");
  git(repoDir, "commit", "-q", "-m", "init");
  return repoDir;
}

function commit(
  repoDir: string,
  relPath: string,
  contents: string,
  subject: string,
): string {
  writeFile(repoDir, relPath, contents);
  git(repoDir, "add", "-A");
  git(repoDir, "commit", "-q", "-m", subject);
  return git(repoDir, "rev-parse", "HEAD");
}

test.describe("checkSharedContent", () => {
  let repoDir: string;
  let baseRef: string;

  test.beforeEach(() => {
    repoDir = createRepo();
    // baseRef is the live base branch; PR commits land on a separate branch,
    // as they would in a real pull request.
    baseRef = git(repoDir, "rev-parse", "--abbrev-ref", "HEAD");
    git(repoDir, "checkout", "-q", "-b", "pr-branch");
  });

  test.afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  test("passes when the range touches no guarded file", () => {
    const headSha = commit(repoDir, "src/index.html", "<html>1</html>\n", "feat: unrelated");

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("fails when a non-sync commit edits a guarded file", () => {
    const headSha = commit(repoDir, GUARDED, '{"hand": "edited"}\n', "fix: tweak copy");

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      file: GUARDED,
      subject: "fix: tweak copy",
    });
  });

  test("passes when a chore(sync) commit edits a guarded file", () => {
    const headSha = commit(
      repoDir,
      GUARDED,
      '{"synced": true}\n',
      "chore(sync): regenerate from workbench",
    );

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(true);
  });

  test("accepts the breaking form chore(sync)!:", () => {
    const headSha = commit(
      repoDir,
      GUARDED,
      '{"synced": true}\n',
      "chore(sync)!: change the shared data shape",
    );

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(true);
  });

  test("a sync commit does not launder a later hand edit", () => {
    commit(repoDir, GUARDED, '{"synced": true}\n', "chore(sync): regenerate");
    const headSha = commit(repoDir, GUARDED, '{"sneaky": true}\n', "style: reword");

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(false);
    expect(result.violations.map((v: { subject: string }) => v.subject)).toEqual([
      "style: reword",
    ]);
  });

  test("inspects a hand edit even when a later revert nets the tree back", () => {
    const original = git(repoDir, "show", `HEAD:${GUARDED}`);
    commit(repoDir, GUARDED, '{"hand": "edited"}\n', "fix: sneak a change in");
    const headSha = commit(repoDir, GUARDED, `${original}\n`, "revert: undo it");

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(false);
    expect(result.violations.map((v: { subject: string }) => v.subject)).toContain(
      "fix: sneak a change in",
    );
  });

  test("ignores mainline commits merged in, judging only the PR side", () => {
    const forkPoint = git(repoDir, "rev-parse", "HEAD");

    // A real mainline commit edits the guarded file with a non-sync subject —
    // this repo has one: "feat: render Pro Unlock section from
    // _data/shared.json" (#46) touching src/_data/shared.json.
    git(repoDir, "checkout", "-q", baseRef);
    const mainlineSha = commit(
      repoDir,
      GUARDED,
      '{"mainline": "change"}\n',
      "feat: render Pro Unlock section from _data/shared.json",
    );

    // The PR branched before that and only touches unrelated files, then
    // merges main in to stay current.
    git(repoDir, "checkout", "-q", "pr-branch");
    commit(repoDir, "src/index.html", "<html>2</html>\n", "feat: unrelated work");
    git(repoDir, "merge", "-q", "--no-edit", mainlineSha);
    const headSha = git(repoDir, "rev-parse", "HEAD");

    // Resolving the LIVE base branch is what makes this pass. Taking a merge
    // base against the stale recorded base.sha (forkPoint) would still yield
    // forkPoint, leaving the mainline commit inside the range and
    // false-failing.
    expect(git(repoDir, "merge-base", forkPoint, headSha)).toBe(forkPoint);

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(true);
  });

  test("flags a hand edit smuggled into a merge-conflict resolution", () => {
    commit(repoDir, GUARDED, '{"branch": "sync"}\n', "chore(sync): regenerate");

    git(repoDir, "checkout", "-q", baseRef);
    const mainlineSha = commit(
      repoDir,
      GUARDED,
      '{"mainline": "sync"}\n',
      "chore(sync): regenerate",
    );

    // Both sides changed the same lines, so merging main in conflicts and the
    // resolution is written by hand — landing in the merge commit itself.
    git(repoDir, "checkout", "-q", "pr-branch");
    expect(() => git(repoDir, "merge", "-q", "--no-edit", mainlineSha)).toThrow();
    writeFile(repoDir, GUARDED, '{"hand": "resolved"}\n');
    git(repoDir, "add", "-A");
    git(repoDir, "commit", "-q", "--no-edit");
    const headSha = git(repoDir, "rev-parse", "HEAD");

    const result = checkSharedContent({ repoDir, baseRef, headSha, guarded: [GUARDED] });

    expect(result.ok).toBe(false);
    expect(result.violations.map((v: { file: string }) => v.file)).toContain(GUARDED);
  });

  test("fails closed when a SHA cannot be resolved", () => {
    const result = checkSharedContent({
      repoDir,
      baseRef: "0000000000000000000000000000000000000000",
      headSha: git(repoDir, "rev-parse", "HEAD"),
      guarded: [GUARDED],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/resolve/i);
  });

  test("fails closed when a guarded path does not exist in the repo", () => {
    const headSha = commit(repoDir, "src/index.html", "<html>3</html>\n", "feat: unrelated");

    const result = checkSharedContent({
      repoDir,
      baseRef,
      headSha,
      guarded: [GUARDED, "src/_data/nonexistent.json"],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/nonexistent\.json/);
  });
});
