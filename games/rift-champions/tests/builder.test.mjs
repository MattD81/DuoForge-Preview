import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const asset = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('CSS has no remote @import (DuoForge must not resolve https: as npm dependency)', () => {
  const css = asset('style.css');
  assert.doesNotMatch(css, /@import\s+(?:url\s*\()?\s*['"]?https?:/i);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/i);
  assert.match(css, /Trebuchet MS/);
});

test('Three.js exists in package dependencies for isolated builder', () => {
  const pkg = JSON.parse(asset('package.json'));
  assert.match(pkg.dependencies.three, /^\^?0\.180\.0$/);
  assert.match(asset('main.mjs'), /from ['"]three['"]/);
});

test('game entry points to local CSS and JavaScript', () => {
  const html = asset('index.html');
  assert.match(html, /href="\.\/style\.css"/);
  assert.match(html, /src="\.\/main\.mjs"/);
});
