import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const html = readFileSync(new URL("../showcase/index.html", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const boundary = readFileSync(new URL("../docs/PUBLIC_BOUNDARY.md", import.meta.url), "utf8");

test("Public showcase guides visitors to the real DuoForge game world", () => {
  const route = "https://duoforge-gaming.cuddlyelk8.chatgpt.site/games";
  assert.ok(html.includes(route));
  assert.ok(readme.includes(route));
  assert.match(html, /A world grows/);
  assert.match(readme, /Build a World Together/);
});

test("Showcase distinguishes platform, previews and future ideas", () => {
  for (const section of ["EXISTING PLATFORM", "PUBLIC PREVIEW", "FUTURE DIRECTION"]) {
    assert.ok(html.includes(section), section);
  }
  assert.match(readme, /not automatically connected/i);
  assert.match(boundary, /Private by default/);
});

test("Static showcase uses no private platform source, credentials or external scripts", () => {
  assert.doesNotMatch(html, /<script\s+[^>]*src\s*=/i);
  assert.doesNotMatch(html, /(?:sk-proj-|ghp_|github_pat_|BEGIN PRIVATE KEY)/);
  assert.doesNotMatch(html, /api\.github\.com\/repos\/MattD81\/DuoForge-Platform/);
  assert.doesNotMatch(html, /fetch\s*\(/);
  assert.ok(existsSync(new URL("../docs/COMMUNITY_VISION.md", import.meta.url)));
});

test("Showcase supplies basic responsive and accessibility features", () => {
  assert.match(html, /name="viewport"/);
  assert.match(html, /@media\(max-width:600px\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /href="#main"/);
  assert.match(html, /data-sv=/);
});
