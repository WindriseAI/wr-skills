#!/usr/bin/env node
// 实证门禁钩子（PostToolUse 记录已读证据 + PreToolUse 校验未读/未覆盖/零用例禁标 passes: true）
// 纯 Node.js 标准库零依赖，兼容 Claude Code 与 Antigravity，支持 observe / enforce 双模式。
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';

function parseCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--phase' && argv[i + 1]) out.phase = argv[++i];
    if (argv[i] === '--mode' && argv[i + 1]) out.mode = argv[++i];
    if (argv[i] === '--cwd' && argv[i + 1]) out.cwd = argv[++i];
  }
  return out;
}

function loadConfig(cwd) {
  const cfgPath = join(cwd, 'wr.config.json');
  if (!existsSync(cfgPath)) return {};
  try {
    return JSON.parse(readFileSync(cfgPath, 'utf8'));
  } catch {
    return {};
  }
}

function parseHookInput(rawText) {
  if (!rawText || !rawText.trim()) return null;
  const data = JSON.parse(rawText);
  if (data.toolCall && typeof data.toolCall === 'object') {
    return {
      protocol: 'agy',
      event: String(data.event || data.hook_event_name || ''),
      sessionId: String(data.sessionId || data.session_id || 'default'),
      toolName: String(data.toolCall.name || ''),
      args: data.toolCall.args || {},
      cwd: data.cwd || process.cwd()
    };
  }
  return {
    protocol: 'claude',
    event: String(data.hook_event_name || data.event || ''),
    sessionId: String(data.session_id || data.sessionId || 'default'),
    toolName: String(data.tool_name || data.toolName || ''),
    args: data.tool_input || data.toolInput || {},
    cwd: data.cwd || process.cwd()
  };
}

function normPath(p, cwd) {
  return resolve(cwd, String(p || '')).replace(/\\/g, '/').toLowerCase();
}

function getLedgerPath(sessionId) {
  const dir = join(tmpdir(), 'wr-evidence-gate');
  mkdirSync(dir, { recursive: true });
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
  return join(dir, `${safe}.jsonl`);
}

function readLedgerSet(sessionId) {
  const file = getLedgerPath(sessionId);
  const set = new Set();
  if (!existsSync(file)) return set;
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line);
      if (obj.path) set.add(obj.path);
    }
  } catch {
    // 忽略损坏行
  }
  return set;
}

function extractReadPaths(args) {
  const out = [];
  if (!args || typeof args !== 'object') return out;
  for (const k of ['Path', 'path', 'file_path', 'AbsolutePath', 'TargetFile']) {
    if (typeof args[k] === 'string' && args[k].trim()) out.push(args[k]);
  }
  if (Array.isArray(args.paths)) {
    for (const p of args.paths) if (typeof p === 'string') out.push(p);
  }
  if (Array.isArray(args.slices)) {
    for (const s of args.slices) if (s && typeof s.path === 'string') out.push(s.path);
  }
  return out;
}

function extractWriteTargets(args) {
  const items = [];
  if (!args || typeof args !== 'object') return items;
  const singlePath = args.Path || args.path || args.file_path || args.TargetFile;
  const singleContent = args.Content || args.content || args.Replacement || args.new_string || '';
  if (typeof singlePath === 'string') {
    items.push({ path: singlePath, content: String(singleContent) });
  }
  if (Array.isArray(args.edits)) {
    for (const e of args.edits) {
      if (!e || typeof e.path !== 'string') continue;
      if (typeof e.create === 'string') {
        items.push({ path: e.path, content: e.create });
      } else if (Array.isArray(e.hunks)) {
        const joined = e.hunks.map((h) => String(h.replacement || '')).join('\n');
        items.push({ path: e.path, content: joined });
      }
    }
  }
  return items;
}

function validateAcceptanceJson(doc, cwd, readSet) {
  if (!doc || typeof doc !== 'object') return null;
  const gate = doc.coverageGate || {};
  const waiver = String(gate.waiverReason || '').trim();
  if (!waiver) {
    if (Array.isArray(gate.unmappedFiles) && gate.unmappedFiles.length > 0) {
      return `实证门禁拦截：存在未映射测试的改动文件（UNMAPPED: ${gate.unmappedFiles.join(', ')}），请补齐行为测试或由负责人填写 waiverReason。`;
    }
    if (Array.isArray(gate.zeroRunSuites) && gate.zeroRunSuites.length > 0) {
      return `实证门禁拦截：存在执行 0 条用例的测试套件（ZERO_RUN: ${gate.zeroRunSuites.join(', ')}），零条用例不得报绿。`;
    }
  }
  const items = Array.isArray(doc.items) ? doc.items : [];
  for (const item of items) {
    if (!item || item.passes !== true) continue;
    const ev = String(item.evidence || '').trim();
    const label = item.id || item.title || '未命名条目';
    if (!ev) {
      return `实证门禁拦截：条目 "${label}" 试图标为 passes: true，但 evidence 字段为空。`;
    }
    const abs = resolve(cwd, ev);
    if (!existsSync(abs)) {
      return `实证门禁拦截：条目 "${label}" 引用的证据文件 "${ev}" 在磁盘上不存在。`;
    }
    const key = normPath(ev, cwd);
    if (!readSet.has(key)) {
      return `实证门禁拦截：条目 "${label}" 引用的证据文件 "${ev}" 本会话尚未亲眼读取，请先读完证据再标记通过。`;
    }
  }
  return null;
}

function recordObserve(cwd, config, payload) {
  const logRel = config.observeLogPath || '.wr-hook-observe.jsonl';
  try {
    appendFileSync(
      resolve(cwd, logRel),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'evidence-before-pass-gate', mode: 'observe', ...payload }) + '\n',
      'utf8'
    );
  } catch {
    // 忽略日志写入异常
  }
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  let rawText = '';
  try {
    rawText = readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }
  let parsed;
  try {
    parsed = parseHookInput(rawText);
  } catch {
    process.exit(0);
  }
  if (!parsed) process.exit(0);

  const cwd = cli.cwd || parsed.cwd || process.cwd();
  const config = loadConfig(cwd);
  const mode = (cli.mode || process.env.WR_HOOK_MODE || config.hookMode || 'enforce').toLowerCase();
  const phase = (cli.phase || (/post/i.test(parsed.event) ? 'post' : 'pre')).toLowerCase();

  if (phase === 'post') {
    const isReadTool = /read|view|slice/i.test(parsed.toolName);
    if (!isReadTool) process.exit(0);
    const paths = extractReadPaths(parsed.args);
    const ledger = getLedgerPath(parsed.sessionId);
    for (const p of paths) {
      const key = normPath(p, cwd);
      try {
        appendFileSync(ledger, JSON.stringify({ ts: new Date().toISOString(), path: key }) + '\n', 'utf8');
      } catch {
        // 忽略
      }
    }
    process.exit(0);
  }

  // PreToolUse：拦截未经核验证据就往验收单写 passes: true
  const targetNames = new Set(
    ((config.evidenceGate && config.evidenceGate.targetFiles) || ['acceptance.json', 'batch-results.json']).map((n) =>
      n.toLowerCase()
    )
  );
  const writes = extractWriteTargets(parsed.args);
  const readSet = readLedgerSet(parsed.sessionId);

  for (const w of writes) {
    const base = basename(w.path).toLowerCase();
    if (!targetNames.has(base)) continue;
    if (!/"passes"\s*:\s*true\b/.test(w.content)) continue;

    let doc = null;
    try {
      doc = JSON.parse(w.content);
    } catch {
      // 局部编辑替换片段时，如果磁盘文件存在则读磁盘文件再核对
      const absTarget = resolve(cwd, w.path);
      if (existsSync(absTarget)) {
        try {
          doc = JSON.parse(readFileSync(absTarget, 'utf8'));
          if (Array.isArray(doc.items)) {
            for (const it of doc.items) it.passes = true;
          }
        } catch {
          doc = null;
        }
      }
    }

    const reason = doc
      ? validateAcceptanceJson(doc, cwd, readSet)
      : '实证门禁拦截：向验收单局部写入 passes: true 时无法核验完整证据结构，请先读取证据文件后整体更新验收单。';

    if (reason) {
      if (mode === 'observe') {
        recordObserve(cwd, config, { file: w.path, reason });
        process.exit(0);
      }
      if (parsed.protocol === 'agy') {
        process.stdout.write(JSON.stringify({ decision: 'deny', reason }) + '\n');
        process.exit(0);
      }
      process.stderr.write(reason + '\n');
      process.exit(2);
    }
  }
  process.exit(0);
}

main();
