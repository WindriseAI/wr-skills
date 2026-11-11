#!/usr/bin/env node
// wr-geo 检查脚本：按一份 JSON 配置检查一个静态站的构建产物。
//
// 用法：
//   node seo-check.mjs <配置.json> <产物目录>
//
// 退出码：0 = 全部通过；1 = 有不通过项；2 = 用法或配置错误。
// 只用 Node 自带模块，不装任何依赖。
//
// 配置格式见 ../references/config-example.json。脚本里没有任何具体站点的
// 域名、产品名、价格、文案：全都从配置读。

import fs from 'node:fs';
import path from 'node:path';

const [cfgPath, distArg] = process.argv.slice(2);
const die = (msg) => { console.error(`配置或用法错误：${msg}`); process.exit(2); };
if (!cfgPath || !distArg) die('用法：node seo-check.mjs <配置.json> <产物目录>');

const dist = path.resolve(distArg);
if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) die(`产物目录不存在：${dist}`);

let cfg;
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) { die(`读不懂配置 ${cfgPath}：${e.message}`); }

const ROOT = String(cfg.root || '').replace(/\/+$/, '');
if (!/^https?:\/\/[^\s/]+$/.test(ROOT)) die('配置缺 root，或不是形如 https://www.example.com 的站点根');

const PRODUCT = cfg.product || {};
const LANG = cfg.language || {};
const OG = cfg.openGraph || {};
const SD = cfg.structuredData || {};
const SITE = cfg.siteWide || {};
const PAGES = Array.isArray(cfg.pages) ? cfg.pages : [];
if (!PAGES.length) die('配置里 pages 是空的');

// ---------- 计数与输出 ----------
let passes = 0, fails = 0, warns = 0, skips = 0;
const clip = (s, n = 220) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const ok = (name, cond, evidence = '') => {
  if (cond) { passes++; console.log(`PASS  ${name}`); }
  else { fails++; console.log(`FAIL  ${name}${evidence !== '' ? '  ← ' + clip(evidence) : ''}`); }
};
const warn = (name, why) => { warns++; console.log(`WARN  ${name}  ← ${clip(why)}`); };
const skip = (name, why) => { skips++; console.log(`SKIP  ${name}  ← ${clip(why)}`); };

// ---------- HTML 小工具 ----------
const CJK = /[\u3400-\u9fff]/;
const read = (f) => fs.readFileSync(f, 'utf8');
const exists = (f) => !!f && fs.existsSync(f) && fs.statSync(f).isFile();
const head = (s) => { const i = s.search(/<\/head>/i); return i < 0 ? s : s.slice(0, i); };
const decode = (s) => String(s ?? '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"').replace(/&mdash;/g, '—').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const visible = (s) => String(s ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .split('\n').join(' ')
  .replace(/\s+/g, ' ')
  .trim();
const bodyOf = (s) => { const i = s.search(/<body/i); return i < 0 ? s : s.slice(i); };
const attr = (tag, name) => (tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`, 'i'))
  || tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*'([^']*)'`, 'i')) || [])[1];
const metas = (h) => [...h.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
const links = (h) => [...h.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
const metaBy = (h, key, val) => {
  const t = metas(h).find((t) => String(attr(t, key) || '').toLowerCase() === String(val).toLowerCase());
  return t ? attr(t, 'content') : undefined;
};

function pageFile(p) {
  const rel = String(p).replace(/^\/+|\/+$/g, '');
  const cands = rel === '' ? ['index.html'] : [`${rel}.html`, `${rel}/index.html`];
  return cands.map((c) => path.join(dist, c)).find(exists) || null;
}

// 把某个绝对地址映射到产物里的文件；不在本站根下的返回 null。
function urlToFile(u) {
  const s = typeof u === 'string' ? u : (u && typeof u === 'object' ? (u.url || u.contentUrl) : null);
  if (typeof s !== 'string' || !s.startsWith(ROOT + '/')) return null;
  const rel = decodeURIComponent(s.slice(ROOT.length + 1).split(/[?#]/)[0]);
  const f = path.resolve(dist, rel);
  return f.startsWith(path.resolve(dist) + path.sep) ? f : null;
}

function imgSize(f) {
  const b = fs.readFileSync(f);
  if (b.slice(1, 4).toString() === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

function ldNodes(html) {
  const out = []; let bad = 0; let count = 0;
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    count++;
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : (j['@graph'] || [j]);
      out.push(...arr.filter((n) => n && typeof n === 'object'));
    } catch { bad++; }
  }
  return { nodes: out, bad, count };
}
const typeOf = (n) => [].concat(n['@type'] || []).map(String);

// ---------- 逐页 ----------
const seenTitle = new Map(), seenDesc = new Map();
const sdPages = new Map((SD.pages || []).map((e) => [e.path, e]));
const htmlFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.html?$/i.test(e.name)) htmlFiles.push(f);
  }
})(dist);

for (const page of PAGES) {
  const p = page.path;
  const tag = `[${p}]`;
  const canon = String(page.canonical || ROOT + (p === '/' ? '/' : p));
  const f = pageFile(p);
  ok(`${tag} 页面文件存在`, exists(f), `在 ${dist} 下找不到 ${p} 对应的 html`);
  if (!exists(f)) continue;

  const html = read(f);
  const h = head(html);

  // <html lang>
  if (LANG.htmlLang) {
    const langTag = (html.match(/<html\b[^>]*>/i) || [])[0] || '';
    ok(`${tag} <html lang="${LANG.htmlLang}">`, String(attr(langTag, 'lang') || '').toLowerCase() === String(LANG.htmlLang).toLowerCase(), langTag);
  }

  // title
  const title = decode((h.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
  ok(`${tag} title 存在且全站唯一`, !!title && !seenTitle.has(title),
    title ? `与 ${seenTitle.get(title)} 重复：${title}` : '没有 <title>');
  if (title) seenTitle.set(title, p);
  if (LANG.titleCjk === 'forbid') ok(`${tag} title 不含中文字符`, !CJK.test(title), title);
  if (LANG.titleCjk === 'require') ok(`${tag} title 含中文字符`, CJK.test(title), title);
  for (const s of page.titleContains || []) ok(`${tag} title 含「${s}」`, title.includes(s), title);

  // description
  const desc = decode(metaBy(h, 'name', 'description') || '');
  const dlen = [...desc].length;
  ok(`${tag} description 存在且全站唯一`, !!desc && !seenDesc.has(desc),
    desc ? `与 ${seenDesc.get(desc)} 重复` : '没有 meta description');
  if (desc) seenDesc.set(desc, p);
  if (Array.isArray(LANG.descriptionLength)) {
    const [min, max] = LANG.descriptionLength;
    ok(`${tag} description 长度 ${min}–${max}（实际 ${dlen}）`, dlen >= min && dlen <= max, desc);
  }
  if (LANG.descriptionCjk === 'forbid') ok(`${tag} description 不含中文字符`, !CJK.test(desc), desc);
  for (const s of page.descriptionContains || []) ok(`${tag} description 含「${s}」`, desc.includes(s), desc);

  // canonical
  const canonTags = links(h).filter((t) => String(attr(t, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical'));
  ok(`${tag} canonical 恰好一条且 = ${canon}`,
    canonTags.length === 1 && attr(canonTags[0], 'href') === canon,
    canonTags.map((t) => attr(t, 'href')).join(' | ') || '没有 canonical');

  // Open Graph
  for (const k of OG.required || ['og:type', 'og:site_name', 'og:title', 'og:description']) {
    ok(`${tag} ${k}`, !!metaBy(h, 'property', k), '缺失或为空');
  }
  ok(`${tag} og:url = canonical`, metaBy(h, 'property', 'og:url') === canon, metaBy(h, 'property', 'og:url') || '没有 og:url');
  const ogi = metaBy(h, 'property', 'og:image') || metaBy(h, 'name', 'og:image');
  const ogiFile = ogi ? urlToFile(ogi) : null;
  ok(`${tag} og:image 是本站绝对地址且文件在产物里`, !!ogiFile && exists(ogiFile), ogi || '没有 og:image');
  const minW = OG.imageMinWidth ?? 1200, minH = OG.imageMinHeight ?? 630;
  if (ogiFile && exists(ogiFile) && minW && minH) {
    const sz = imgSize(ogiFile);
    if (sz) ok(`${tag} og:image ≥ ${minW}×${minH}（实际 ${sz.join('×')}）`, sz[0] >= minW && sz[1] >= minH);
    else warn(`${tag} og:image 尺寸`, '不是 PNG/JPEG，没核');
  }
  ok(`${tag} twitter:card = ${OG.twitterCard || 'summary_large_image'}`,
    (metaBy(h, 'name', 'twitter:card') || metaBy(h, 'property', 'twitter:card')) === (OG.twitterCard || 'summary_large_image'));

  // 索引控制
  const robotsMeta = (metaBy(h, 'name', 'robots') || '').toLowerCase();
  ok(`${tag} 没有 noindex`, !robotsMeta.includes('noindex'), robotsMeta);

  // hreflang
  const hl = links(h).filter((t) => attr(t, 'hreflang'));
  const hlGot = {};
  for (const t of hl) hlGot[attr(t, 'hreflang')] = attr(t, 'href');
  if (page.hreflang) {
    const want = page.hreflang;
    const keys = Object.keys(want);
    const same = hl.length === keys.length && keys.every((k) => hlGot[k] === want[k]);
    ok(`${tag} hreflang ${keys.length} 条且地址逐字正确`, same, JSON.stringify(hlGot));
  } else {
    ok(`${tag} 不配 hreflang`, hl.length === 0, Object.keys(hlGot).join(','));
  }

  // 不跑 JS 时的可见文字
  const v = visible(bodyOf(html));
  if (LANG.rawHtmlNoCjk) {
    const hits = v.match(/[\u3400-\u9fff][^A-Za-z]{0,24}/g) || [];
    ok(`${tag} 原始 HTML 可见文字不含中文（实际 ${hits.length} 处）`, hits.length === 0, hits.slice(0, 4).join(' / '));
  }
  if (page.h1) {
    const h1 = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    ok(`${tag} h1 = ${page.h1}（实际：${h1}）`, h1 === page.h1);
  }
  if (page.lead && page.lead.contains) {
    const n = page.lead.within || 80;
    const lead = page.lead.unit === 'chars' ? [...v].slice(0, n).join('') : v.split(/\s+/).slice(0, n).join(' ');
    ok(`${tag} 开头 ${n} ${page.lead.unit === 'chars' ? '字' : '词'}内出现「${page.lead.contains}」`, lead.includes(page.lead.contains), lead);
  }
  for (const s of page.mustContain || []) ok(`${tag} 页面出现「${s}」`, v.includes(s) || decode(html).includes(s));
  for (const s of page.mustNotContain || []) ok(`${tag} 页面不出现「${s}」`, !v.includes(s) && !decode(html).includes(s),
    (v.match(new RegExp('.{0,20}' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.{0,20}')) || [])[0]);

  // 结构化数据
  const { nodes, bad, count } = ldNodes(html);
  const sdReq = sdPages.get(p);
  const forbiddenSd = SD.forbidden || [];
  if (!count && !sdReq) skip(`${tag} 结构化数据`, '这页没有 ld+json，配置也没要求');
  else {
    ok(`${tag} 结构化数据 JSON 都能解析`, bad === 0, `${bad} 段解析失败`);
    const raw = JSON.stringify(nodes);
    for (const token of forbiddenSd) ok(`${tag} 结构化数据不含 ${token}`, !raw.includes(token), (raw.match(new RegExp('.{0,30}' + token + '.{0,40}')) || [])[0]);
    if (sdReq) {
      for (const req of sdReq.require || []) {
        const node = nodes.find((n) => typeOf(n).includes(req.type));
        ok(`${tag} 结构化数据有 ${req.type}`, !!node, raw.slice(0, 160));
        if (!node) continue;
        for (const field of req.fields || []) {
          const val = node[field];
          ok(`${tag} ${req.type}.${field} 有值`, val !== undefined && val !== null && String(typeof val === 'object' ? JSON.stringify(val) : val).length > 0, JSON.stringify(node).slice(0, 200));
        }
        for (const [field, want] of Object.entries(req.equals || {})) {
          ok(`${tag} ${req.type}.${field} = ${want}`, node[field] === want, JSON.stringify(node[field]));
        }
        for (const field of req.fileFields || []) {
          const lf = urlToFile(node[field]);
          ok(`${tag} ${req.type}.${field} 指向的文件在产物里`, !!lf && exists(lf), JSON.stringify(node[field]));
        }
      }
      const off = sdReq.offers;
      if (off) {
        const node = nodes.find((n) => typeOf(n).includes(off.node || 'SoftwareApplication'));
        const offers = node ? [].concat(node.offers || []).flatMap((o) => (o && o.offers ? [].concat(o.offers) : [o])) : [];
        ok(`${tag} offers 的 price 都是纯数字字符串`,
          offers.length > 0 && offers.every((o) => typeof o.price === 'string' && /^\d+(\.\d+)?$/.test(o.price)),
          JSON.stringify(offers.map((o) => o.price)));
        if (Array.isArray(off.prices)) {
          const got = offers.map((o) => String(o.price)).sort();
          const want = off.prices.map(String).sort();
          ok(`${tag} offers 档位 = ${want.join(' / ')}`, JSON.stringify(got) === JSON.stringify(want), got.join(' / '));
        }
        if (off.currency) {
          const cur = [...new Set(offers.map((o) => o.priceCurrency))];
          ok(`${tag} offers 的 priceCurrency = ${off.currency}`, cur.length === 1 && cur[0] === off.currency, cur.join(','));
        }
      }
    }
  }
}

// ---------- 站点级文件 ----------
const RB = cfg.robots === false ? null : (cfg.robots || {});
if (RB) {
  const rbFile = path.join(dist, RB.file || 'robots.txt');
  ok('robots.txt 存在', exists(rbFile), rbFile);
  if (exists(rbFile)) {
    const t = read(rbFile);
    const smUrl = RB.sitemapUrl || `${ROOT}/${(cfg.sitemap && cfg.sitemap.file) || 'sitemap.xml'}`;
    ok('robots.txt 有 User-agent: * 和 Sitemap 绝对地址', /User-agent:\s*\*/i.test(t) && t.includes(`Sitemap: ${smUrl}`), t.slice(0, 200));
    ok('robots.txt 没有拦整站', !/^\s*Disallow:\s*\/\s*$/mi.test(t), t.slice(0, 200));
    ok('robots.txt 没有点名拦爬虫',
      !/User-agent:\s*(GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|PerplexityBot|bingbot|Googlebot|Baiduspider|Google-Extended|Bytespider|Applebot)/i.test(t), t.slice(0, 200));
  }
}

const SM = cfg.sitemap === false ? null : (cfg.sitemap || {});
if (SM) {
  const smFile = path.join(dist, SM.file || 'sitemap.xml');
  ok('sitemap.xml 存在', exists(smFile), smFile);
  if (exists(smFile)) {
    const t = read(smFile);
    const urls = [...t.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
      loc: (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1],
      lastmod: (m[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1],
    }));
    const want = PAGES.filter((pg) => pg.sitemap !== false)
      .map((pg) => String(pg.canonical || ROOT + pg.path)).sort();
    const got = urls.map((u) => u.loc).sort();
    const extra = got.filter((x) => !want.includes(x));
    const missing = want.filter((x) => !got.includes(x));
    ok('sitemap 地址集合与契约逐字一致', extra.length === 0 && missing.length === 0,
      `多：${extra.join(' ')}｜少：${missing.join(' ')}`);
    if (SM.requireLastmod !== false) {
      ok('sitemap 每条有 lastmod（YYYY-MM-DD）',
        urls.length > 0 && urls.every((u) => /^\d{4}-\d{2}-\d{2}$/.test(u.lastmod || '')),
        JSON.stringify(urls.filter((u) => !/^\d{4}-\d{2}-\d{2}$/.test(u.lastmod || '')).slice(0, 3)));
    }
  }
}

const LL = cfg.llmsTxt === false ? null : cfg.llmsTxt;
if (LL) {
  const f = path.join(dist, LL.file || 'llms.txt');
  ok('llms.txt 存在', exists(f), f);
  if (exists(f)) {
    const t = read(f);
    if (LL.firstLine) ok(`llms.txt 第一行是 ${LL.firstLine}`, t.split(/\r?\n/)[0].trim() === LL.firstLine, t.split(/\r?\n/)[0]);
    for (const s of LL.contains || []) ok(`llms.txt 含「${s}」`, t.includes(s));
    for (const s of LL.notMatch || []) ok(`llms.txt 不出现 /${s}/`, !new RegExp(s).test(t), (t.match(new RegExp(s)) || [])[0]);
  }
}

// ---------- 全站口径 ----------
const forbidText = SITE.forbiddenText || [];
const forbidHtml = (SITE.forbiddenHtml || []).map((e) => (typeof e === 'string' ? { pattern: e } : e));
for (const f of htmlFiles) {
  const rel = path.relative(dist, f).split(path.sep).join('/');
  const s = read(f);
  const v = visible(bodyOf(s));
  for (const t of forbidText) {
    if (v.includes(t)) ok(`[${rel}] 不出现「${t}」`, false, (v.match(new RegExp('.{0,30}' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.{0,30}')) || [])[0]);
  }
  for (const e of forbidHtml) {
    if (new RegExp(e.pattern, 'i').test(s)) ok(`[${rel}] 不出现 /${e.pattern}/`, false, e.why || '');
  }
  for (const p of SITE.noindexPaths || []) {
    const hit = p.endsWith('/') ? rel.startsWith(p) : rel === p;
    if (hit) ok(`[${rel}] 带 noindex`, /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(s));
  }
}
ok('全站口径检查跑过（上面无 FAIL 即通过）', true);

for (const p of SITE.forbiddenPaths || []) {
  ok(`产物里没有 ${p}`, !exists(path.join(dist, p)), path.join(dist, p));
}

console.log(`\n合计：PASS ${passes}  FAIL ${fails}  WARN ${warns}  SKIP ${skips}`);
process.exit(fails ? 1 : 0);
