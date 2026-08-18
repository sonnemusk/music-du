import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { assertBundleBudget, INDEX_GZIP_MAX } from "../scripts/check-bundle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function htmlFor(scriptHref: string, preloads: string[] = []) {
  const links = preloads
    .map((href) => `<link rel="modulepreload" crossorigin href="${href}">`)
    .join("\n");
  return `<!doctype html><html><head>${links}</head><body>
    <script type="module" crossorigin src="${scriptHref}"></script>
  </body></html>`;
}

describe("check-bundle", () => {
  it("rejects a modulepreloaded SearchOverlay chunk", () => {
    const html = htmlFor("/assets/index-aaaa.js", ["/assets/SearchOverlay-bbbb.js"]);
    expect(() =>
      assertBundleBudget(html, () => Buffer.from("ok"))
    ).toThrow(/SearchOverlay/);
  });

  it("rejects an oversized gzip entry", () => {
    const raw = randomBytes(INDEX_GZIP_MAX + 8 * 1024);
    expect(() =>
      assertBundleBudget(htmlFor("/assets/index-cccc.js"), () => raw)
    ).toThrow(/exceeds/);
  });

  it("accepts a lazy overlay and a small entry", () => {
    const raw = Buffer.from("console.log('entry')");
    const result = assertBundleBudget(htmlFor("/assets/index-dddd.js"), () => raw);
    expect(result.src).toBe("/assets/index-dddd.js");
    expect(result.gzip).toBe(gzipSync(raw).length);
    expect(result.gzip).toBeLessThan(INDEX_GZIP_MAX);
  });

  it("wires the budget into CI and adds CodeQL", () => {
    const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    const codeql = fs.readFileSync(path.join(root, ".github/workflows/codeql.yml"), "utf8");
    const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");
    expect(pkg).toMatch(/"check:bundle": "node scripts\/check-bundle.mjs"/);
    expect(ci).toMatch(/npm run check:bundle/);
    expect(codeql).toMatch(/github\/codeql-action\/init@v4/);
    expect(codeql).toMatch(/javascript-typescript/);
    expect(codeql).toMatch(/build-mode: none/);
  });
});
