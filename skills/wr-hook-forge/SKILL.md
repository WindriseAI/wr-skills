---
name: wr-hook-forge
description: 同坑二次写进钩子。把零例外的客观硬规矩从说明文档里抽出来，写成毫秒级零依赖静态脚本或 Agent 钩子；新钩子一律先挂 observe 观察档确认零误报，再切 enforce 硬拦；自动适配 Claude Code、Antigravity 与 Git pre-commit。用于反复踩同一个低级错误、文档越写越长却管不住 AI、需要把规矩落进确定性程序拦截时使用。
---

# wr-hook-forge：同坑二次写进钩子

写在文档里的规矩是概率性的，上下文一长模型总会漏看，感叹号加得越多，其他重要规矩越被冲淡。同一个坑只要踩到第二次，就立刻写成程序拦截。

## 四条设计原则

1. **规矩严格二分。**
   - **留在文档**：需要结合上下文权衡取舍的软原则（架构风格、文案语气、功能优先级）。
   - **写进钩子**：零例外的客观硬规矩（禁读凭据目录、禁强删主工作区、禁跑 0 条测试报绿、禁带入本机绝对路径、禁破折号或旧产品名、改了契约必须同步版本）。
2. **先挂 `observe` 观察档，再切 `enforce` 硬拦。**
   - 新脚本上线第一步先跑 `observe` 模式：命中违规时只追加记录到 `.wr-hook-observe.jsonl` 并正常放行（退出码 `0`），绝不一下子把日常工作流卡死。
   - 真实跑过几轮确认零误报后，把配置里的 `hookMode` 切为 `enforce`，命中即返回非零退出码或拒绝决策并报出精确文件与行号。
3. **毫秒级、零依赖、可重复运行。**
   - 只使用运行环境自带标准库（例如纯 Node.js `node:fs`、`node:path`、`node:os`），免安装第三方依赖，跨 Windows、macOS、Linux 即拿即用。
   - 解析异常时除安全红线外优先安全降级并记录错误，不让格式波动把正常开发锁死。
4. **对批量包装工具展开底层参数统一过筛。**
   - 现代 Agent 常把多次文件写入、批量检索或并发命令封装在一个聚合工具调用里；钩子必须递归展开 `edits`、`commands`、`queries`、`paths`、`files` 等嵌套参数，拆出每一个原子路径与命令过同一套检查，堵死换个工具绕过守卫的漏洞。

## 第一步：把反复踩的坑翻译成可判定条件

当某类错误第二次出现时，按四问定下脚本边界：
1. **触发时机**：在工具执行前拦（`PreToolUse`）、工具执行后记账（`PostToolUse`）、回复收尾前查（`Stop`），还是在 Git 提交前查（`pre-commit`）？
2. **精确输入**：检查哪些字段（文件路径、命令文本、写入内容、回复正文）？
3. **明确例外**：哪些路径或写法必须白名单放行（如示例配置 `.env.example`、系统临时目录、代码块内部、Markdown 表格线）？
4. **可执行修复提示**：拦截报错时不只说「不许做」，还要附带一行正确的替代做法（如给出跨平台移入回收站命令、指出具体哪一行违规）。

## 第二步：双宿主统一协议封装

同一份 Node.js 钩子脚本可以同时兼容 Claude Code 与 Antigravity，只需在入口统一解析 `stdin`：
- **Claude Code 格式**：`{ tool_name, tool_input, session_id, transcript_path }`。硬拦时将原因写到 `stderr` 并以 `process.exit(2)` 退出。
- **Antigravity 格式**：`{ toolCall: { name, args }, sessionId, transcriptPath }`（或同义字段）。硬拦时向 `stdout` 输出 `{"decision":"deny","reason":"..."}` 并以 `process.exit(0)` 退出。

## 第三步：先写自测再挂载

每个新钩子上线前必须通过三组自动化测试：
1. **正常请求放行测试**：合法开发操作 100% 放行。
2. **违规请求拦截测试（`enforce` 模式）**：直接调用与嵌套在批量参数里的违规操作全部被精准拦下并输出清晰原因。
3. **观察档记录测试（`observe` 模式）**：命中违规时不阻塞（放行），且在 `.wr-hook-observe.jsonl` 准确留痕。

## 现成参考实现

本仓库 `hooks/` 目录自带 4 个可直接复制使用的零依赖通用钩子：
- `hooks/safety-redline-guard.mjs`：安全四红线守卫（凭据、删除、主分支重置、主力机静音）。
- `hooks/evidence-before-pass-gate.mjs`：实证门禁（未读证据、未覆盖或零条测试禁标 `passes: true`）。
- `hooks/speak-before-act-hook.mjs`：先应声再动手与收尾人话检查。
- `hooks/copy-and-privacy-lint.mjs`：提交前中文文风与本机隐私路径动态扫描。

配套挂载模板见 `examples/hooks.claude.json`、`examples/hooks.agy.json` 与 `examples/wr.config.example.json`。
