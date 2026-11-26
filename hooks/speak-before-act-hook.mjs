#!/usr/bin/env node
// 先应声再动手与收尾人话门禁（PreToolUse + Stop）
// 纯 Node.js 标准库零依赖，解析异常一律 fail-open 放行绝不卡死会话；支持 observe / enforce 双模式。
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
    cwd: data.cwd || process.cwd()
  };
}

function loadMessages(parsed) {
  if (parsed.transcript) return parsed.transcript;
  if (!parsed.transcriptPath || !existsSync(parsed.transcriptPath)) return null;
  try {
    const raw = readFileSync(parsed.transcriptPath, 'utf8').trim();
    if (!raw) return [];
    if (raw.startsWith('[')) return JSON.parse(raw);
    return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return null;
  }
}

function extractText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  if (typeof msg.text === 'string') return msg.text.trim();
  if (typeof msg.content === 'string') return msg.content.trim();
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b) => b && (b.type === 'text' || typeof b.text === 'string'))
      .map((b) => String(b.text || ''))
      .join(' ')
      .trim();
  }
  return '';
}

function getStateFile(sessionId) {
  const dir = join(tmpdir(), 'wr-speak-gate');
  mkdirSync(dir, { recursive: true });
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
  return join(dir, `${safe}.json`);
}

function hasRemindedTurn(sessionId, turnKey) {
  const file = getStateFile(sessionId);
  if (!existsSync(file)) return false;
  try {
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

  let lastUserIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const role = String(msgs[i].role || '').toLowerCase();
    if (role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return null;

  let assistantSpoke = false;
  for (let i = lastUserIdx + 1; i < msgs.length; i++) {
    const role = String(msgs[i].role || '').toLowerCase();
    if (role === 'assistant' && extractText(msgs[i]).length > 0) {
      assistantSpoke = true;
      break;
    }
  }
  if (assistantSpoke) return null;

  const turnKey = parsed.turnId || `u_${lastUserIdx}_${extractText(msgs[lastUserIdx]).slice(0, 24)}`;
  if (hasRemindedTurn(parsed.sessionId, turnKey)) {
    return null; // 同一轮最多提醒一次，避免卡死
  }
  markRemindedTurn(parsed.sessionId, turnKey);
  return '先应声再动手提醒：收到用户消息后，请先用一两句平实的话说明收到了什么、打算怎么做，再调用工具（本轮仅温和提醒一次）。';
}

function stripCodeBlocks(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

function checkStopResponse(text) {
  const clean = stripCodeBlocks(text);
  if (!clean.trim()) return null;

  const hits = [];
  if (/\b[0-9a-f]{40}\b/i.test(clean)) hits.push('裸露 40 位完整提交哈希');
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(clean)) hits.push('裸露内部会话 UUID');
  if (/\bPID\s*[:=]?\s*\d{3,7}\b/i.test(clean)) hits.push('裸露内部进程号');
  if (/^\s*(?:直接结论|核心总结|总结如下)\s*[:：]/m.test(clean)) hits.push('僵硬公文头');

  if (hits.length === 0) return null;
  return `收尾人话检查命中：${hits.join('、')}。建议改用普通同事当面说话的平实表述，不直接粘贴内部编号。`;
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
  const mode = (cli.mode || process.env.WR_HOOK_MODE || config.hookMode || 'enforce').toLowerCase();
  const phase = (cli.phase || (/stop/i.test(parsed.event) ? 'stop' : 'pre')).toLowerCase();

  let reason = null;
  if (phase === 'pre') {
    reason = checkPreSpeak(parsed);
  } else if (phase === 'stop') {
    const enabled = !config.speakBeforeAct || config.speakBeforeAct.checkStopResponse !== false;
    if (enabled) {
      let resp = parsed.responseText;
      if (!resp) {
        const msgs = loadMessages(parsed) || [];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (String(msgs[i].role || '').toLowerCase() === 'assistant') {
            resp = extractText(msgs[i]);
            break;
          }
        }
      }
      reason = checkStopResponse(resp);
    }
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

  if (mode === 'observe') {
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
