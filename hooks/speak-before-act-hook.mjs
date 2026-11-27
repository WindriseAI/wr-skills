#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// 先应声再动手与收尾自定义检查（PreToolUse + Stop）
// 纯 Node.js 标准库零依赖，解析异常一律 fail-open 放行绝不卡死会话；支持 observe / enforce 双模式。
// 会话记录同时兼容两种格式：顶层 role/content（Antigravity 等），以及 Claude Code 的 type + message.role/message.content。
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir, homedir, userInfo } from 'node:os';

// <wr-config> 配置读取、模式判定、提示语言与日志脱敏（四个钩子共用同一段，改动时四处保持一致，自测会逐字比对）
// 查找顺序：先读用户目录 ~/wr.config.json（按系统账户的真实用户目录，不看 HOME 等环境变量），再从当前目录逐级往上找项目里的 wr.config.json，项目字段覆盖用户目录字段。
// 模式优先级：命令行 --mode > 环境变量 WR_HOOK_MODE > 未完成首次对齐（onboarded 不是 true）按 observe > 配置 hookMode > 默认 observe。
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
// 真实的用户目录：os.userInfo() 读系统账户信息，不受 HOME / USERPROFILE 环境变量影响，项目改不了它
function realHome() {
  try {
    const h = userInfo().homedir;
    if (h) return h;
  } catch {
    // 个别受限环境拿不到账户信息时退回 homedir()
  }
  return homedir();
}
// 用户目录配置的位置：钩子命令行写了 --user-config 就用它（命令行是用户自己写在钩子设置里的），否则是真实用户目录下的 wr.config.json
function userConfigPath(cliUserConfig) {
  return cliUserConfig ? resolve(String(cliUserConfig)) : join(realHome(), 'wr.config.json');
}
function loadConfig(cwd, explicitPath, cliUserConfig) {
  let userCfg = {};
  try {
    const p = userConfigPath(cliUserConfig);
    if (existsSync(p)) userCfg = readJsonSafe(p) || {};
  } catch {
    // 受限环境读不到用户目录时忽略
  }
  const projPath = explicitPath ? resolve(cwd, explicitPath) : findProjectConfig(cwd);
  const projCfg = projPath && existsSync(projPath) ? readJsonSafe(projPath) || {} : {};
  const user = isPlainObject(userCfg) ? userCfg : {};
  const project = isPlainObject(projCfg) ? projCfg : {};
  const merged = deepMerge(user, project);
  // 两条安全红线只认用户目录那份配置能放宽，这里把两份来源单独留着
  Object.defineProperty(merged, '__sources', { value: { user, project }, enumerable: false });
  return merged;
}
function resolveMode(cliMode, config) {
  if (cliMode) return { mode: String(cliMode).toLowerCase(), explicit: true, source: 'cli' };
  if (process.env.WR_HOOK_MODE) return { mode: String(process.env.WR_HOOK_MODE).toLowerCase(), explicit: true, source: 'env' };
  if (config.onboarded !== true) return { mode: 'observe', explicit: false };
  return { mode: String(config.hookMode || 'observe').toLowerCase(), explicit: false };
}
// 提示语言：language.output 为 en 或 en-* 时用英文，其余（含 auto、没写）用中文
function pickLang(config) {
  const out = String((config.language && config.language.output) || '').toLowerCase();
  return out === 'en' || out.startsWith('en-') ? 'en' : 'zh';
}
function tr(lang, zh, en) {
  return lang === 'en' ? en : zh;
}
// 观察日志默认脱敏：路径只留最后一段；命令只留程序名、单字母开关和不带值的长开关，NAME=值 只留 NAME=…；observeLogDetail 写 full 才记完整内容
function logFull(config) {
  return String(config.observeLogDetail || '').toLowerCase() === 'full';
}
function redactPath(p) {
  const parts = String(p || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 1 ? '…/' + parts[parts.length - 1] : String(p || '');
}
function redactCommand(c) {
  const kept = [];
  let expectProgram = true;
  // 按 shell 的方式切词：引号里的空格不算分隔，TOKEN="abc def" 是一个词
  for (const raw of String(c || '').trim().match(/(?:[^\s"']+|"[^"]*"?|'[^']*'?)+/g) || []) {
    if (/^(?:&&|\|\||\||;)$/.test(raw)) {
      kept.push(raw);
      expectProgram = true;
      continue;
    }
    const t = raw.replace(/^["'`(]+|["'`);]+$/g, '');
    const env = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (env) {
      kept.push(env[1] + '=…');
    } else if (expectProgram) {
      if (t) kept.push(redactPath(t));
      expectProgram = false;
    } else if (/^-[A-Za-z]$/.test(t) || /^--[A-Za-z][\w-]*$/.test(t)) {
      kept.push(t);
    }
    if (/;$/.test(raw)) {
      kept.push(';');
      expectProgram = true;
    }
  }
  return kept.length ? kept.join(' ') + ' …' : '';
}
function redactQuoted(text) {
  return String(text || '').replace(/"([^"]*)"/g, (m, inner) => `"${redactPath(inner)}"`);
}
// </wr-config>

function parseCliArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--phase' && argv[i + 1]) out.phase = argv[++i];
    if (argv[i] === '--mode' && argv[i + 1]) out.mode = argv[++i];
    if (argv[i] === '--cwd' && argv[i + 1]) out.cwd = argv[++i];
    if (argv[i] === '--user-config' && argv[i + 1]) out.userConfig = argv[++i];
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

function checkPreSpeak(parsed, lang) {
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
  return tr(
    lang,
    '先应声再动手提醒：收到用户消息后，请先用一两句平实的话说明收到了什么、打算怎么做，再调用工具（本轮只提醒这一次）。',
    'Speak-before-act reminder: after a new user message, first say in a sentence or two what you received and what you plan to do, then call tools (reminded once per turn).'
  );
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

function checkStopResponse(text, rules, lang) {
  if (!rules.length) return null;
  const clean = stripCodeBlocks(text);
  if (!clean.trim()) return null;
  const hits = rules.filter((r) => r.re.test(clean)).map((r) => r.label);
  if (hits.length === 0) return null;
  return tr(
    lang,
    `收尾检查命中：${hits.join('、')}。请按项目约定改写这段回复后再结束。`,
    `End-of-reply check matched: ${hits.join(', ')}. Rewrite the reply to follow the project's rules before finishing.`
  );
}

function recordObserve(cwd, config, phase, reason) {
  const logRel = config.observeLogPath || '.wr-hook-observe.jsonl';
  try {
    appendFileSync(
      resolve(cwd, logRel),
      JSON.stringify({ ts: new Date().toISOString(), hook: 'speak-before-act-hook', phase, mode: 'observe', reason: logFull(config) ? reason : redactQuoted(reason) }) + '\n',
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
  const config = loadConfig(cwd, undefined, cli.userConfig);
  const { mode } = resolveMode(cli.mode, config);
  const lang = pickLang(config);
  const phase = (cli.phase || (/stop/i.test(parsed.event) ? 'stop' : 'pre')).toLowerCase();
  const allowOut = () => {
    if (parsed.protocol === 'agy') process.stdout.write(phase === 'stop' ? '{}\n' : JSON.stringify({ decision: 'allow' }) + '\n');
    process.exit(0);
  };

  if (mode === 'off') allowOut();

  // Stop 钩子已经让 AI 续写过一次时直接放行，防止死循环
  if (phase === 'stop' && parsed.stopHookActive) allowOut();

  let reason = null;
  try {
    if (phase === 'pre') {
      reason = checkPreSpeak(parsed, lang);
    } else if (phase === 'stop') {
      const enabled = !config.speakBeforeAct || config.speakBeforeAct.checkStopResponse !== false;
      if (enabled) reason = checkStopResponse(lastResponseText(parsed), buildStopRules(config), lang);
    }
  } catch {
    reason = null; // fail-open
  }

  if (!reason) allowOut();

  // Antigravity 的 Stop 阶段只记录
  if (phase === 'stop' && parsed.protocol === 'agy') {
    recordObserve(cwd, config, phase, reason);
    allowOut();
  }

  if (mode !== 'enforce') {
    recordObserve(cwd, config, phase, reason);
    allowOut();
  }

  // enforce 下的「先应声」默认只给软提示：放行这次工具调用，同时把提醒塞进 AI 的上下文；
  // speakBeforeAct.preAction 写 block 才拒绝这次调用
  const preAction = String((config.speakBeforeAct && config.speakBeforeAct.preAction) || 'hint').toLowerCase();
  if (phase === 'pre' && preAction !== 'block') {
    if (parsed.protocol === 'agy') {
      recordObserve(cwd, config, phase, reason);
      process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    } else {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: reason } }) + '\n');
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
