#!/usr/bin/env node
/**
 * Content quality gate for the notebook.
 *
 *   node scripts/validate.mjs            # report, fail only on errors
 *   node scripts/validate.mjs --strict   # warnings also fail (CI default)
 *
 * This is the same rule set the site build uses, exposed as a CLI so an agent
 * can run it before committing.
 */
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadCards, MODES } from './lib/cards.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const strict = process.argv.includes('--strict');
const dir = path.join(root, 'content', 'cards');

const today = new Date().toISOString().slice(0, 10);
const { cards, problems, ok } = loadCards(dir, { today });

const RED = process.stdout.isTTY ? '\u001b[31m' : '';
const YELLOW = process.stdout.isTTY ? '\u001b[33m' : '';
const DIM = process.stdout.isTTY ? '\u001b[2m' : '';
const RESET = process.stdout.isTTY ? '\u001b[0m' : '';

for (const p of problems) {
  const tag = p.level === 'error' ? `${RED}error${RESET}` : `${YELLOW}warn ${RESET}`;
  console.log(`${tag} ${p.file}  ${p.message}`);
}

const modes = new Map();
for (const c of cards) modes.set(c.mode, (modes.get(c.mode) ?? 0) + 1);

console.log('');
console.log(`${DIM}模式说明：${RESET}${Object.entries(MODES).map(([k, v]) => `${v.emoji}${k}`).join('  ')}`);
console.log(`${DIM}卡片总数：${RESET}${cards.length}    ${DIM}平均箴言长度：${RESET}${
  cards.length ? Math.round(cards.reduce((s, c) => s + c.title.length, 0) / cards.length) : 0
} 字    ${DIM}模式分布：${RESET}${[...modes].map(([k, v]) => `${k}×${v}`).join(' ')}`);

const warns = problems.filter((p) => p.level === 'warn').length;
const errs = problems.filter((p) => p.level === 'error').length;

if (!ok) {
  console.log(`\n${RED}校验失败：${errs} 个错误、${warns} 个提醒${RESET}`);
  process.exit(1);
}
if (strict && warns) {
  console.log(`\n${RED}--strict 模式：${warns} 个提醒被当作失败${RESET}`);
  process.exit(1);
}
console.log(`\n${cards.length} 张卡片通过校验${warns ? `（${warns} 条提醒）` : ''}。`);
