/*
 * Give a cloned SVG its own element ids. Mermaid output carries ids for the root <svg> (its <style> is
 * scoped by it), arrowhead <marker>s, gradients and so on. A second copy in the same document (the
 * lightbox) would duplicate them: invalid HTML, and url(#…) references resolve to the first match in the
 * document, so the copy's arrowheads would depend on the original staying rendered. Every id defined in
 * the markup is renamed with a suffix and every reference to it is rewritten to match:
 *   id="x"  ·  url(#x) / url('#x') / url("#x") / url(&quot;#x&quot;)  ·  href / xlink:href="#x"
 *   aria-labelledby / aria-describedby / aria-controls lists  ·  #x selectors inside <style>
 * References to ids that are not defined in the markup (page-level markers) are left alone.
 * Pure string work (no DOM), unit tested in scripts/tests/diagrams.test.mjs.
 */

const ID_ATTR = /(\sid\s*=\s*)(["'])([^"']+)\2/g;
const URL_REF = /url\(\s*(&quot;|["']?)#([^"'&)\s]+)\1\s*\)/g;
const HREF_REF = /(\s(?:xlink:)?href\s*=\s*)(["'])#([^"']+)\2/g;
const IDREF_LIST = /(\saria-(?:labelledby|describedby|controls|owns|activedescendant)\s*=\s*)(["'])([^"']*)\2/g;
const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
const CSS_ID = /#(-?[A-Za-z_][\w-]*)/g;

/** Ids defined by `id="…"` attributes in the markup. */
export function collectSvgIds(markup: string): Set<string> {
  const ids = new Set<string>();
  for (const match of markup.matchAll(ID_ATTR)) ids.add(match[3]);
  return ids;
}

export function suffixSvgIds(markup: string, suffix: string): string {
  if (!suffix) return markup;
  const ids = collectSvgIds(markup);
  if (ids.size === 0) return markup;
  const rename = (id: string) => (ids.has(id) ? id + suffix : id);

  return markup
    .replace(STYLE_BLOCK, (_all, open: string, css: string, close: string) => open + css.replace(CSS_ID, (m, id: string) => (ids.has(id) ? `#${id}${suffix}` : m)) + close)
    .replace(ID_ATTR, (_all, lead: string, quote: string, id: string) => `${lead}${quote}${rename(id)}${quote}`)
    .replace(URL_REF, (_all, quote: string, id: string) => `url(${quote}#${rename(id)}${quote})`)
    .replace(HREF_REF, (_all, lead: string, quote: string, id: string) => `${lead}${quote}#${rename(id)}${quote}`)
    .replace(IDREF_LIST, (_all, lead: string, quote: string, list: string) => `${lead}${quote}${list.split(/(\s+)/).map((part) => (part.trim() ? rename(part) : part)).join("")}${quote}`);
}
