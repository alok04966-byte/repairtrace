import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');

test('workflow buttons wrap with a consistent gap and no default top margin', () => {
  assert.match(styles, /\.workflow-actions\{display:flex;flex-wrap:wrap;gap:10px 12px/);
  assert.match(styles, /\.workflow-actions>button\{margin:0\}/);
  assert.match(styles, /@media\(max-width:650px\)\{\.workflow-actions\{gap:10px\}/);
});

test('quality content has stable flexible space and feedback can wrap without clipping', () => {
  assert.match(styles, /\.quality-panel\{[^}]*min-height:190px[^}]*min-width:0[^}]*overflow-wrap:anywhere/);
  assert.match(styles, /\.feedback-slot\{[^}]*min-height:2\.5rem[^}]*overflow-wrap:anywhere/);
  assert.match(styles, /\.quality-panel\{min-height:0\}/);
  assert.match(styles, /\.quality-result p\{[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/);
});
