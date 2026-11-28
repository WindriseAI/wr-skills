#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// wr-plain-cn 可选文风检查脚本（破折号、翻案句、说教冒号、塑料假俚语、顿号连串、分号拆句、相邻句同构）
// 纯 Node.js 标准库零依赖。默认关闭；仅当 wr.config.json 中 style.enabled 为 true 时在钩子/整库模式下生效，
// 且默认只报告不拦截（退出码 0）。命令行显式传入文件路径时可直接体检单篇草稿。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, extname, dirname, isAbsolute } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';

function readJsonSafe(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

function realHome() {
  try {
    const h = userInfo().homedir;
    if (h) return h;
  } catch {
    // 忽略受限环境
  }
  return homedir();
}

function findProjectConfig(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    const p = join(dir, 'wr.config.json');
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadConfig(cwd, explicitPath, cliUserConfig) {
  let userCfg = {};
  try {
    const p = cliUserConfig && isAbsolute(cliUserConfig) ? resolve(cliUserConfig) : join(realHome(), 'wr.config.json');
    if (existsSync(p)) userCfg = readJsonSafe(p) || {};
  } catch {
    // 忽略受限环境
  }
  const projPath = explicitPath ? resolve(cwd, explicitPath) : findProjectConfig(cwd);
  const projCfg = projPath && existsSync(projPath) ? readJsonSafe(projPath) || {} : {};
  return deepMerge(isPlainObject(userCfg) ? userCfg : {}, isPlainObject(projCfg) ? projCfg : {});
}

function parseCliArgs(argv) {
  const out = { targets: [], hook: false, enforce: false, json: false, ignoreDisabled: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cwd' && argv[i + 1]) out.cwd = argv[++i];
    else if (a === '--config' && argv[i + 1]) out.config = argv[++i];
    else if (a === '--user-config' && argv[i + 1]) out.userConfig = argv[++i];
    else if (a === '--mode' && argv[i + 1]) out.mode = argv[++i];
    else if (a === '--hook') out.hook = true;
    else if (a === '--enforce') out.enforce = true;
    else if (a === '--json') out.json = true;
    else if (a === '--ignore-disabled') out.ignoreDisabled = true;
    else out.targets.push(a);
  }
  return out;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walkFiles(baseDir, targetPaths, exts, excludeNames) {
  const found = [];
  const roots = targetPaths.length ? targetPaths.map((p) => resolve(baseDir, p)) : [baseDir];

  function visit(absPath) {
    if (!existsSync(absPath)) return;
    const st = statSync(absPath);
    if (st.isFile()) {
      if (targetPaths.length || exts.includes(extname(absPath).toLowerCase())) found.push(absPath);
      return;
    }
    if (!st.isDirectory()) return;
    for (const entry of readdirSync(absPath, { withFileTypes: true })) {
      if (excludeNames.has(entry.name)) continue;
      visit(join(absPath, entry.name));
    }
  }

  for (const r of roots) visit(r);
  return [...new Set(found)];
}

// 清理行内代码、Markdown 链接目标和强调符号，避免误伤路径与 URL
function stripInlineMarkup(line) {
  return line
    .replace(/`[^`]*`/g, (m) => ' '.repeat(m.length))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<\/?(?:del|ins|em|strong|b|i|code|span|br)\b[^>]*>/gi, '');
}

function isTableLine(line) {
  const t = line.trim();
  if (!t) return false;
  return t.startsWith('|') && t.includes('|', 1);
}

function isChecklistLine(line) {
  return /^\s*[-*+]\s*\[[ xX]\]/.test(line);
}

function isHeadingLine(line) {
  return /^\s*#{1,6}\s+/.test(line);
}

function isHorizontalRule(line) {
  return /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

const DEFAULT_SLANG = ['漏勺', '焊死', '硬搓', '瞎搓', '截胡', '爆雷', '兜底', '底座', '打回重修'];

const PREACH_COLON_RE =
  /(?:核心(?:在于|是)|本质(?:上|在于|是)|说白了|换句话说|换言之|值得注意的是|残酷的现实是|真相是|结论是|这意味着|一句话总结|关键(?:在于|是)|根本原因(?:在于|是)|简而言之|总而言之|综上所述)\s*[：:]/g;

const NOT_BUT_RE =
  /(?:不是|并非|不只是|不仅仅|不在于)[^。！？；\n]{1,36}(?:而是|而在于|更是)/g;

const EM_DASH_RE = /——|(?<![-\w])—(?![-\w])/g;

const ORDINAL_START_RE =
  /^(?:第[一二三四五六七八九十百\d]+[道个条步种类点项席层件次套路]|[一二三四五六七八九十]、|首先|其次|再次|最后|一是|二是|三是|四是)/;

const FRAME_PIVOTS = ['是', '把', '让', '会', '要', '能', '可以', '需要', '用来', '专门', '负责', '就是'];

function cleanSentenceForSkeleton(s) {
  return s
    .replace(/^[\s>*+\-\d.、"'「」『』（）()【】]+/, '')
    .replace(/\*\*|__/g, '')
    .trim();
}

function sentenceSkeleton(s) {
  const clean = cleanSentenceForSkeleton(s);
  const cjkLen = (clean.match(/[\u3400-\u9fff]/g) || []).length;
  const ord = clean.match(ORDINAL_START_RE);
  const ordKind = ord
    ? ord[0].startsWith('第')
      ? '第X' + ord[0].slice(-1)
      : /^[一二三四五六七八九十]、/.test(ord[0])
        ? '数、'
        : /^[一二三四]是/.test(ord[0])
          ? '数是'
          : '序词'
    : '';
  const prefix2 = clean.slice(0, 2);
  const prefix3 = clean.slice(0, 3);
  const pivots = FRAME_PIVOTS.filter((p) => clean.includes(p));
  return { clean, cjkLen, ordKind, prefix2, prefix3, pivots };
}

function isTripletIsomorphic(a, b, c) {
  if (a.cjkLen < 6 || b.cjkLen < 6 || c.cjkLen < 6) return false;

  // 1. 序数/并列引导三连同构（如「第一道……第二道……第三道……」「第一个……第二个……第三个……」）
  if (a.ordKind && a.ordKind === b.ordKind && b.ordKind === c.ordKind) {
    return true;
  }

  // 2. 相同三字起手骨架（如「如果你……」「如果你……」「如果你……」）
  if (a.prefix3.length === 3 && a.prefix3 === b.prefix3 && b.prefix3 === c.prefix3) {
    return true;
  }

  // 3. 相同两字起手 + 共享相同骨架动词/连接词
  if (a.prefix2.length === 2 && a.prefix2 === b.prefix2 && b.prefix2 === c.prefix2) {
    const shared = a.pivots.filter((p) => b.pivots.includes(p) && c.pivots.includes(p));
    if (shared.length >= 1) return true;
  }

  return false;
}

export const RULE_LABELS = {
  em_dash: '破折号',
  not_but: '翻案句',
  preach_colon: '说教冒号',
  plastic_slang: '塑料假俚语',
  dunhao_chain: '顿号连串',
  semicolon_split: '分号拆句',
  adjacent_isomorphism: '相邻句同构'
};

export function scanText(content, fileLabel = '<text>', opts = {}) {
  const lines = String(content || '').split(/\r?\n/);
  const hits = [];
  const slangWords = [...DEFAULT_SLANG, ...(Array.isArray(opts.extraSlang) ? opts.extraSlang : []).filter(Boolean)];
  const slangRe = slangWords.length ? new RegExp(slangWords.map(escapeRegExp).join('|'), 'g') : null;

  let inFrontmatter = false;
  let inCodeFence = false;
  let fenceChar = '';
  const proseUnits = []; // { line, text, paraId }
  let paraId = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNo = idx + 1;

    // 跳过开头的 YAML frontmatter
    if (idx === 0 && rawLine.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (rawLine.trim() === '---') inFrontmatter = false;
      continue;
    }

    // 跳过围栏代码块
    const fenceMatch = rawLine.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      if (!inCodeFence) {
        inCodeFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inCodeFence = false;
        fenceChar = '';
      }
      paraId++;
      continue;
    }
    if (inCodeFence) continue;

    if (!rawLine.trim()) {
      paraId++;
      continue;
    }
    if (isHorizontalRule(rawLine)) {
      paraId++;
      continue;
    }

    const table = isTableLine(rawLine);
    const checklist = isChecklistLine(rawLine);
    const heading = isHeadingLine(rawLine);
    const clean = stripInlineMarkup(rawLine);

    // 1. 破折号
    if (!table) {
      for (const m of clean.matchAll(EM_DASH_RE)) {
        const start = Math.max(0, m.index - 12);
        hits.push({
          rule: 'em_dash',
          label: RULE_LABELS.em_dash,
          file: fileLabel,
          line: lineNo,
          snippet: rawLine.slice(start, m.index + m[0].length + 12).trim()
        });
      }
    }

    // 2. 翻案句
    for (const m of clean.matchAll(NOT_BUT_RE)) {
      hits.push({
        rule: 'not_but',
        label: RULE_LABELS.not_but,
        file: fileLabel,
        line: lineNo,
        snippet: m[0].trim()
      });
    }

    // 3. 说教冒号（排除标题行）
    if (!heading) {
      for (const m of clean.matchAll(PREACH_COLON_RE)) {
        const start = Math.max(0, m.index - 8);
        hits.push({
          rule: 'preach_colon',
          label: RULE_LABELS.preach_colon,
          file: fileLabel,
          line: lineNo,
          snippet: clean.slice(start, m.index + m[0].length + 14).trim()
        });
      }
    }

    // 4. 塑料假俚语
    if (slangRe) {
      for (const m of clean.matchAll(slangRe)) {
        const start = Math.max(0, m.index - 10);
        hits.push({
          rule: 'plastic_slang',
          label: RULE_LABELS.plastic_slang,
          file: fileLabel,
          line: lineNo,
          snippet: clean.slice(start, m.index + m[0].length + 10).trim()
        });
      }
    }

    // 5. 顿号连串（一个分句里用顿号连着并列三项以上；表格和刻意列全的检查清单除外）
    if (!table && !checklist && !heading) {
      const clauses = clean.split(/[。！？；，,：:]/);
      for (const clause of clauses) {
        const count = (clause.match(/、/g) || []).length;
        if (count >= 2) {
          hits.push({
            rule: 'dunhao_chain',
            label: RULE_LABELS.dunhao_chain,
            file: fileLabel,
            line: lineNo,
            snippet: clause.trim().slice(0, 60)
          });
        }
      }
    }

    // 6. 分号拆句（正文用分号接句子，表格除外）
    if (!table && !heading) {
      for (const m of clean.matchAll(/；/g)) {
        const start = Math.max(0, m.index - 14);
        hits.push({
          rule: 'semicolon_split',
          label: RULE_LABELS.semicolon_split,
          file: fileLabel,
          line: lineNo,
          snippet: clean.slice(start, m.index + 15).trim()
        });
      }
    }

    // 收集正文句子，用于第 7 项：相邻句同构
    if (!table && !heading && !checklist) {
      const sentences = clean
        .split(/[。！？；]/)
        .map((s) => s.trim())
        .filter((s) => cleanSentenceForSkeleton(s).length > 0);
      for (const s of sentences) {
        proseUnits.push({ line: lineNo, text: s, paraId, sk: sentenceSkeleton(s) });
      }
    } else {
      paraId++;
    }
  }

  // 7. 相邻句同构（同段相邻三句，或连续单句段形成的相邻三句）
  let i = 0;
  while (i + 2 < proseUnits.length) {
    const u1 = proseUnits[i];
    const u2 = proseUnits[i + 1];
    const u3 = proseUnits[i + 2];
    const samePara = u1.paraId === u2.paraId && u2.paraId === u3.paraId;
    const consecutiveLead =
      u1.sk.ordKind &&
      u1.sk.ordKind === u2.sk.ordKind &&
      u2.sk.ordKind === u3.sk.ordKind &&
      u3.line - u1.line <= 25;

    if ((samePara || consecutiveLead) && isTripletIsomorphic(u1.sk, u2.sk, u3.sk)) {
      hits.push({
        rule: 'adjacent_isomorphism',
        label: RULE_LABELS.adjacent_isomorphism,
        file: fileLabel,
        line: u1.line,
        snippet: `${u1.sk.clean.slice(0, 16)} / ${u2.sk.clean.slice(0, 16)} / ${u3.sk.clean.slice(0, 16)}`
      });
      i += 3;
    } else {
      i += 1;
    }
  }

  return hits;
}

function summarizeHits(hits) {
  const counts = {};
  for (const key of Object.keys(RULE_LABELS)) counts[key] = 0;
  for (const h of hits) counts[h.rule] = (counts[h.rule] || 0) + 1;
  return counts;
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const cwd = cli.cwd ? resolve(cli.cwd) : process.cwd();
  const config = loadConfig(cwd, cli.config, cli.userConfig);
  const styleCfg = isPlainObject(config.style) ? config.style : {};
  const enabled = styleCfg.enabled === true;

  // 钩子模式或整库扫描模式下，未在 wr.config.json 中启用 style.enabled 时默认跳过
  const explicitTargets = cli.targets.length > 0;
  if (!cli.ignoreDisabled && (cli.hook || !explicitTargets) && !enabled) {
    if (cli.json) {
      console.log(JSON.stringify({ skipped: true, reason: 'style.enabled is not true', files: 0, total: 0, counts: summarizeHits([]), hits: [] }, null, 2));
    } else {
      console.log('wr-plain-cn 文风检查未启用（wr.config.json 中 style.enabled 默认为 false），已跳过。');
    }
    process.exit(0);
  }

  const mode = cli.enforce
    ? 'enforce'
    : String(cli.mode || styleCfg.mode || 'report').toLowerCase();

  if (mode === 'off') {
    if (cli.json) {
      console.log(JSON.stringify({ skipped: true, reason: 'mode is off', files: 0, total: 0, counts: summarizeHits([]), hits: [] }, null, 2));
    }
    process.exit(0);
  }

  const exts = (Array.isArray(styleCfg.extensions) ? styleCfg.extensions : ['.md', '.txt']).map((e) => e.toLowerCase());
  const excludeNames = new Set(Array.isArray(styleCfg.excludePaths) ? styleCfg.excludePaths : ['node_modules', '.git', 'dist', 'build']);
  const files = walkFiles(cwd, cli.targets, exts, excludeNames);

  const allHits = [];
  for (const f of files) {
    const rel = relative(cwd, f).replace(/\\/g, '/') || f;
    const content = readFileSync(f, 'utf8');
    allHits.push(...scanText(content, rel, { extraSlang: styleCfg.extraSlang }));
  }

  const counts = summarizeHits(allHits);

  if (cli.json) {
    console.log(JSON.stringify({ skipped: false, mode, files: files.length, total: allHits.length, counts, hits: allHits }, null, 2));
  } else {
    for (const h of allHits) {
      console.log(`WARN ${h.label}  ${h.file}:${h.line}  ${h.snippet}`);
    }
    const summaryParts = Object.entries(RULE_LABELS).map(([k, label]) => `${label} ${counts[k]}`);
    console.log(`扫描 ${files.length} 个文件，共提示 ${allHits.length} 处（模式：${mode}）：${summaryParts.join('，')}。`);
  }

  process.exit(mode === 'enforce' && allHits.length > 0 ? 1 : 0);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main();
}
