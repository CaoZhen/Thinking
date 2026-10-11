#!/usr/bin/env node
/**
 * Scaffold a new card.
 *
 *   node scripts/new-card.mjs --slug delete-needs-courage --title 删除比添加更需要勇气 \
 *        --mode 会话回望 --tags 克制,手艺 --seed "重构时删掉 400 行之后"
 *
 * Creates content/cards/<slug>.md and refuses to overwrite anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { MODES } from './lib/cards.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dir = path.join(root, 'content', 'cards');

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i += 1; } else args[key] = 'true';
  }
}

if (args.help || (!args.slug && !args.title)) {
  console.log(`用法：
  node scripts/new-card.mjs --slug <kebab-case> --title <箴言> [--mode <模式>] [--tags a,b] [--seed "起点"] [--place 场景]

可用模式：${Object.keys(MODES).join(' / ')}`);
  process.exit(args.help ? 0 : 1);
}

const today = new Date().toLocaleDateString('sv-SE');
const slug = (args.slug || `card-${today}`).trim().toLowerCase();
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error(`slug 必须是 kebab-case 英文：${slug}`);
  process.exit(1);
}
const file = path.join(dir, `${slug}.md`);
if (fs.existsSync(file)) {
  console.error(`已存在，拒绝覆盖：content/cards/${slug}.md`);
  process.exit(1);
}

const tags = (args.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
const quoted = tags.length ? `[${tags.join(', ')}]` : '[]';

const tpl = `---
title: ${args.title || '在这里写一句十个字左右的话'}
date: ${today}
mode: ${args.mode || '悬问求索'}
tags: ${quoted}
place: ${args.place || ''}
seed: ${args.seed || ''}
---

## 起：一个具体的画面

先写一个可以看见、听见、摸到的场景，不要评论，不要总结。两三句就够。

## 转：它让我想到什么

把画面推到它背后的问题上。允许自己走偏，但每一步都要留下脚印。

## 落：一句话的落点

回到那张卡片本身。不必给出答案，给出一把更好的问题。
`;

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, tpl, 'utf8');
console.log(`已创建 content/cards/${slug}.md`);
console.log('写作提醒：箴言 8–16 字；正文 120–900 字；2–6 个 "##" 小节；不要流水账。');
console.log('写完运行：node scripts/validate.mjs --strict');
