/**
 * A tiny, dependency-free front-matter parser.
 *
 * Supports:
 *   key: value
 *   key: "quoted value"
 *   key: [a, b, "c, with comma"]
 *   key:
 *     - a
 *     - b
 *
 * It intentionally supports only the subset the notebook needs, so that the
 * whole toolchain can run on a bare `node` with no install step.
 */

function unquote(value) {
  let v = String(value).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function splitInlineList(inner) {
  const out = [];
  let cur = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => unquote(s)).filter((s) => s !== '');
}

export function parseFrontMatter(raw) {
  const text = String(raw).replace(/^\uFEFF/, '');
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(text);
  if (!match) return { data: {}, body: text, hasFrontMatter: false };

  const data = {};
  let listKey = null;

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^\s*#/.test(line)) continue;

    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      if (!Array.isArray(data[listKey])) data[listKey] = [];
      data[listKey].push(unquote(item[1]));
      continue;
    }

    const kv = /^([A-Za-z0-9_.-]+)\s*:\s*([\s\S]*)$/.exec(line);
    if (!kv) continue;

    const key = kv[1];
    const value = kv[2].trim();

    if (value === '') {
      data[key] = [];
      listKey = key;
      continue;
    }

    listKey = null;
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = splitInlineList(value.slice(1, -1));
    } else {
      data[key] = unquote(value);
    }
  }

  return { data, body: text.slice(match[0].length), hasFrontMatter: true };
}
