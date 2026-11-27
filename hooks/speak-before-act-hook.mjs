#!/usr/bin/env node
// 先应声再动手与收尾自定义检查（PreToolUse + Stop）
// 纯 Node.js 标准库零依赖，解析异常一律 fail-open 放行绝不卡死会话；支持 observe / enforce 双模式。
// 会话记录同时兼容两种格式：顶层 role/content（Antigravity 等），以及 Claude Code 的 type + message.role/message.content。
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';

// <wr-config> 配置读取与模式判定（四个钩子共用同一段，改动时四处保持一致，自测会逐字比对）
// 查找顺序：先读用户目录 ~/wr.config.json，再从当前目录逐级往上找项目里的 wr.config.json，项目字段覆盖用户目录字段。
// 模式优先级：命令行 --mode > 环境变量 WR_HOOK_MODE > 未完成首次对齐（onboarded 不是 true）一律 observe > 配置 hookMode > 默认 observe。
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
function loadConfig(cwd, explicitPath) {
  let userCfg = {};
  try {
    const p = join(homedir(), 'wr.config.json');
    if (existsSync(p)) userCfg = readJsonSafe(p) || {};
  } catch {
    // 受限环境读不到用户目录时忽略
  }
  const projPath = explicitPath ? resolve(cwd, explicitPath) : findProjectConfig(cwd);
  const projCfg = projPath && existsSync(projPath) ? readJsonSafe(projPath) || {} : {};
  return deepMerge(isPlainObject(userCfg) ? userCfg : {}, isPlainObject(projCfg) ? projCfg : {});
}
function resolveMode(cliMode, config) {
  const explicit = cliMode || process.env.WR_HOOK_MODE;
  if (explicit) return { mode: String(explicit).toLowerCase(), explicit: true };
  if (config.onboarded !== true) return { mode: 'observe', explicit: false };
  return { mode: String(config.hookMode || 'observe').toLowerCase(), explicit: false };
}
// </wr-config>

function parseCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--phase' && argv[i + 1]) out.phase = argv[++i];
    if (argv[i] === '--mode' && argv[i + 1]) out.mode = argv[++i];
    if (argv[i] === '--cwd' && argv[i + 1]) out.cwd = argv[++i];
  }
  return out;
}

function parseHookInput(rawText) {
  if (!rawText || !rawText.trim()) return null;
  const data = JSON.parse(rawText);
  const isAgy = Boolean(
    data.toolCall ||
    data.sessionId ||
    data.conversationId ||
    data.hookEventName ||
    data.transcriptPath ||
    typeof data.response === 'string'
  );
  return {
    protocol: isAgy ? 'agy' : 'claude',
    event: String(data.hookEventName || data.hook_event_name || data.event || ''),
    sessionId: String(data.conversationId || data.session_id || data.sessionId || 'default'),
    turnId: String(data.turn_id || data.turnId || ''),
    transcriptPath: data.transcript_path || data.transcriptPath || '',
    transcript: Array.isArray(data.transcript) ? data.transcript : null,
    responseText: typeof data.last_assistant_message === 'string'
      ? data.last_assistant_message
      : (typeof data.response === 'string' ? data.response : ''),
    stopHookActive: data.stop_hook_active === true || data.stopHookActive === true,
    cwd: data.cwd || process.cwd()
  };
}

function loadRawMessages(parsed) {
  if (parsed.transcript) return parsed.transcript;
  if (!parsed.transcriptPath || !existsSync(parsed.transcriptPath)) return null;
  try {
    const raw = readFileSync(parsed.transcriptPath, 'utf8').trim();
    if (!raw) return [];
    if (raw.startsWith('[')) return JSON.parse(raw);
    const out = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // 跳过写了一半的行
      }
    }
    return out;
  } catch {
    return null;
  }
}

// 把两种记录格式统一成 { role, content, text, id, toolResult }；不是对话消息的条目返回 null
function normalizeEntry(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.message && typeof o.message === 'object') {
    // Claude Code：只认 type 为 user / assistant 的对话条目，跳过请求快照、附件、摘要、元信息与旁支会话
    if (typeof o.type === 'string' && o.type !== 'user' && o.type !== 'assistant') return null;
    if (o.isMeta === true || o.isSidechain === true) return null;
    return {
      role: String(o.message.role || o.type || '').toLowerCase(),
      content: o.message.content,
      text: o.message.text,
      id: String(o.uuid || ''),
      toolResult: Boolean(o.toolUseResult)
    };
  }
  return { role: String(o.role || '').toLowerCase(), content: o.content, text: o.text, id: String(o.id || ''), toolResult: false };
}

function loadMessages(parsed) {
  const raw = loadRawMessages(parsed);
  if (!raw) return null;
  return raw.map(normalizeEntry).filter(Boolean);
}

function extractText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  if (typeof msg.text === 'string') return msg.text.trim();
  if (typeof msg.content === 'string') return msg.content.trim();
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b) => b && (b.type === 'text' || (b.type === undefined && typeof b.text === 'string')))
      .map((b) => String(b.text || ''))
      .join(' ')
      .trim();
  }
  return '';
}

// 工具返回结果在 Claude Code 里也记成 user 条目，不算用户新说的话
function isGenuineUserMessage(msg) {
  if (!msg || msg.role !== 'user') return false;
  if (msg.toolResult) return false;
  if (Array.isArray(msg.content) && msg.content.length > 0 && msg.content.every((b) => b && b.type === 'tool_result')) {
    return false;
  }
  return true;
}

function findLastUserIndex(msgs) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (isGenuineUserMessage(msgs[i])) return i;
  }
  return -1;
}

function getStateFile(sessionId) {
  const dir = join(tmpdir(), 'wr-speak-gate');
  mkdirSync(dir, { recursive: true });
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
  return join(dir, `${safe}.json`);
}

function hasRemindedTurn(sessionId, turnKey) {
  try {
    const file = getStateFile(sessionId);
    if (!existsSync(file)) return false;
    const st = JSON.parse(readFileSync(file, 'utf8'));
    return st.lastTurnKey === turnKey;
  } catch {
    return false;
  }
}

function markRemindedTurn(sessionId, turnKey) {
  try {
    writeFileSync(getStateFile(sessionId), JSON.stringify({ lastTurnKey: turnKey, ts: new Date().toISOString() }), 'utf8');
  } catch {
    // 忽略状态写入异常
  }
}

function checkPreSpeak(parsed) {
  const msgs = loadMessages(parsed);
  if (!msgs || msgs.length === 0) return null; // fail-open

  const lastUserIdx = findLastUserIndex(msgs);
  if (lastUserIdx < 0) return null;

  for (let i = lastUserIdx + 1; i < msgs.length; i++) {
    if (msgs[i].role === 'assistant' && extractText(msgs[i]).length > 0) return null;
  }

  const userMsg = msgs[lastUserIdx];
  const turnKey = parsed.turnId || userMsg.id || `u_${lastUserIdx}_${extractText(userMsg).slice(0, 24)}`;
  if (hasRemindedTurn(parsed.sessionId, turnKey)) {
    return null; // 同一轮最多提醒一次，避免卡死
  }
  markRemindedTurn(parsed.sessionId, turnKey);
  return '先应声再动手提醒：收到用户消息后，请先用一两句平实的话说明收到了什么、打算怎么做，再调用工具（本轮只提醒这一次）。';
}

function lastResponseText(parsed) {
  if (parsed.responseText) return parsed.responseText;
  const msgs = loadMessages(parsed) || [];
  const lastUserIdx = findLastUserIndex(msgs);
  return msgs
    .slice(lastUserIdx + 1)
    .filter((m) => m.role === 'assistant')
    .map(extractText)
    .filter(Boolean)
    .join('\n');
}

function stripCodeBlocks(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

// 收尾检查不带任何内置词句，只查用户在 speakBeforeAct.stopPatterns 里写的正则
function buildStopRules(config) {
  const sba = config.speakBeforeAct || {};
  const rules = [];
  for (const item of Array.isArray(sba.stopPatterns) ? sba.stopPatterns : []) {
    const pattern = typeof item === 'string' ? item : item && item.pattern;
    if (!pattern) continue;
    try {
      rules.push({ re: new RegExp(String(pattern), 'im'), label: (item && item.hint) || String(pattern) });
    } catch {
      // 写错的正则直接忽略
    }
  }
  return rules;
}

function checkStopResponse(text, rules) {
  if (!rules.length) return null;
  const clean = stripCodeBlocks(text);
  if (!clean.trim()) return null;
  const hits = rules.filter((r) => r.re.test(clean)).map((r) => r.label);
  if (hits.length === 0) return null;
  return `收尾检查命中：${hits.join('、')}。请按项目约定改写这段回复后再结束。`;
}

function recordObserve(cwd, config, phase, reason) {
  const logRel = config.observeLogPath || '.wr-hook-observe.jsonl';
  try {
    appendFileSync(
      resolve(cwd, logRel),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'speak-before-act-hook', phase, mode: 'observe', reason }) + '\n',
      'utf8'
    );
  } catch {
    // 忽略
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
    process.exit(0); // fail-open
  }
  if (!parsed) process.exit(0);

  const cwd = cli.cwd || parsed.cwd || process.cwd();
  const config = loadConfig(cwd);
  const { mode } = resolveMode(cli.mode, config);
  const phase = (cli.phase || (/stop/i.test(parsed.event) ? 'stop' : 'pre')).toLowerCase();

  if (mode === 'off') {
    if (parsed.protocol === 'agy') process.stdout.write(phase === 'stop' ? '{}\n' : JSON.stringify({ decision: 'allow' }) + '\n');
    process.exit(0);
  }

  // Stop 钩子已经让 AI 续写过一次时直接放行，防止死循环
  if (phase === 'stop' && parsed.stopHookActive) {
    if (parsed.protocol === 'agy') process.stdout.write('{}\n');
    process.exit(0);
  }

  let reason = null;
  try {
    if (phase === 'pre') {
      reason = checkPreSpeak(parsed);
    } else if (phase === 'stop') {
      const enabled = !config.speakBeforeAct || config.speakBeforeAct.checkStopResponse !== false;
      if (enabled) reason = checkStopResponse(lastResponseText(parsed), buildStopRules(config));
    }
  } catch {
    reason = null; // fail-open
  }

  if (phase === 'stop' && parsed.protocol === 'agy') {
    if (reason) {
      recordObserve(cwd, config, phase, reason);
    }
    process.stdout.write('{}\n');
    process.exit(0);
  }

  if (!reason) {
    if (parsed.protocol === 'agy') {
      process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    }
    process.exit(0);
  }

  if (mode !== 'enforce') {
    recordObserve(cwd, config, phase, reason);
    if (parsed.protocol === 'agy') {
      process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    }
    process.exit(0);
  }

  if (parsed.protocol === 'agy') {
    process.stdout.write(JSON.stringify({ decision: 'deny', reason }) + '\n');
    process.exit(0);
  }
  process.stderr.write(reason + '\n');
  process.exit(2);
}

main();
