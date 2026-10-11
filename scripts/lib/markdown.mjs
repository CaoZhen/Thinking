/**
 * A small, dependency-free Markdown renderer tuned for Chinese prose.
 *
 * Supported blocks : headings, paragraphs, blockquotes, ul / ol lists, hr.
 * Supported inline : **bold**, *italic*, `code`, [text](url), ~~strike~~.
 *
 * Deliberate omissions keep the toolchain install-free and the output
 * predictable. Raw HTML is always escaped; this notebook never needs it.
 */

const CJK = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const u = String(url).trim();
  if (/^javascript:/i.test(u) || /^data:/i.test(u) || /^vbscript:/i.test(u)) return '#';
  return u;
}

/** Join wrapped source lines the way a Chinese typesetter would. */
function joinLines(lines) {
  let out = '';
  for (const line of lines) {
    if (!out) { out = line; continue; }
    const prev = out.slice(-1);
    const next = line.slice(0, 1);
    out += CJK.test(prev) && CJK.test(next) ? '' : ' ';
    out += line;
  }
  return out;
}

export function renderInline(text) {
  let out = escapeHtml(text);
  const codes = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) =>
    `<img src="${safeUrl(src)}" alt="${alt}" loading="lazy" />`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
    `<a href="${safeUrl(href)}" target="_blank" rel="noopener">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  return out;
}

export function slugifyHeading(text) {
  const ascii = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'section';
}

/**
 * Render markdown into HTML.
 * @returns {{ html: string, headings: {level:number, text:string, id:string}[], text: string }}
 */
export function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  const headings = [];
  const plain = [];
  let i = 0;
  let autoId = 0;

  const flushParagraph = (buf) => {
    if (!buf.length) return;
    const raw = joinLines(buf).trim();
    if (raw) {
      blocks.push(`<p>${renderInline(raw)}</p>`);
      plain.push(raw);
    }
    buf.length = 0;
  };

  const paragraph = [];

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { flushParagraph(paragraph); i += 1; continue; }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph(paragraph);
      blocks.push('<hr />');
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(paragraph);
      const level = heading[1].length;
      const text = heading[2].trim();
      let id = slugifyHeading(text);
      if (headings.some((h) => h.id === id)) id = `${id}-${++autoId}`;
      headings.push({ level, text, id });
      const tag = `h${Math.min(level + 1, 6)}`;
      blocks.push(`<${tag} id="${id}">${renderInline(text)}</${tag}>`);
      plain.push(text);
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph(paragraph);
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(`<blockquote>${renderInline(joinLines(buf).trim())}</blockquote>`);
      plain.push(joinLines(buf).trim());
      continue;
    }

    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flushParagraph(paragraph);
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        i += 1;
      }
      const listTag = ordered ? 'ol' : 'ul';
      blocks.push(`<${listTag}>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</${listTag}>`);
      plain.push(items.join(' '));
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph(paragraph);

  return { html: blocks.join('\n'), headings, text: plain.join('\n') };
}

/** Count CJK characters plus latin words, as a rough read-length signal. */
export function countReadable(text) {
  const cjk = (String(text).match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (String(text).match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + latin;
}

/** Visible character count used by the brevity rules (no spaces / markdown). */
export function visibleLength(text) {
  return String(text).replace(/[\s*`#>[\]()!~-]/g, '').length;
}

/**
 * Split a card body into "stops" of the journey (one per `## heading`).
 * Content before the first heading becomes a prologue stop.
 */
export function splitSections(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const chunks = [];
  let cur = { title: null, lines: [] };

  for (const line of lines) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      chunks.push(cur);
      cur = { title: h[1].trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  chunks.push(cur);

  const stops = [];
  let n = 0;
  for (const chunk of chunks) {
    const rendered = renderMarkdown(chunk.lines.join('\n'));
    if (!rendered.html.trim() && !chunk.title) continue;
    n += 1;
    stops.push({
      index: n,
      id: chunk.title ? slugifyHeading(chunk.title) : `prologue-${n}`,
      title: chunk.title ?? '序',
      prologue: !chunk.title,
      html: rendered.html,
      text: rendered.text,
    });
  }
  return stops;
}
