---
name: wr-hook-forge
description: 高频踩坑写成确定性拦截钩子。把零例外的客观硬规矩从说明文档里抽出来，写成毫秒级零依赖静态脚本或 Agent 钩子；新钩子一律先挂 observe 观察档确认零误报，再切 enforce 硬拦；按 Claude Code 与 Antigravity 钩子输入输出格式编写并支持 Git pre-commit（附示例配置与离线双协议单测）。用于反复踩同一个低级错误、文档越写越长却管不住 AI、需要把规矩落进确定性程序拦截时使用。
---

# wr-hook-forge 高频踩坑写成确定性拦截钩子

写在文档里的规矩是概率性的，上下文一长模型总会漏看，感叹号加得越多，其他重要规矩越被冲淡。同一个坑只要踩到第二次，就立刻写成程序拦截。

## 第 0 步 首次对齐（每次启用本技能先做）

<!-- wr-onboarding:start -->
先找配置文件 `wr.config.json`：从当前目录逐级往上找，再看用户目录（`~/wr.config.json`）；两份都有时，项目里的字段覆盖用户目录的。

- 读到 `"onboarded": true`，就按里面的字段办事，不再提问，直接往下走。配置里没写的字段按下面各题的默认值理解。
- 没有这个文件，或者没有 `"onboarded": true`，先把下面 8 题一次发给用户，每题括号里是默认值，并说明「回『好』就全按默认」。用户回「好」或只改了其中几题，其余一律按默认。
- 收到答复后，把答案连同 `"onboarded": true` 写进项目根目录的 `wr.config.json`（用户要求全局生效就写 `~/wr.config.json`），已有字段保留不动，写完告诉用户写在哪、怎么改。字段全集和说明见 github.com/WindriseAI/wr-skills 的 `examples/README.md`。
- 用户说「这次先不对齐」，就按默认值办事，不写文件，下次启用时再问。
- 钩子在 `onboarded` 变成 `true` 之前一律只记录不拦截。

1. 机器与测试环境：只有这一台电脑，还是另有测试机、容器或 CI？跑测试时能不能占用这台电脑的键盘、鼠标和浏览器？（只有一台；耗时长的测试先说预计多久，同意后在本机跑；可以占用）写入 `environment.machine`（`single` / `has-runner`）、`environment.heavyTestsOnMainMachine`（`allow` / `ask` / `deny`）、`environment.quietMainMachine`（`false`）、`environment.remoteHost`（测试机的 ssh 主机名，没有就留空）。
2. 系统与工具：用什么系统和终端？在哪个 AI 工具里用？有没有装 Orca 多代理工作台？（系统、终端和宿主自动探测；Orca 自动探测）写入 `environment.os`、`environment.shell`、`environment.host`、`tools.orca`。
3. 模型与额度：手上有哪几档模型？有没有第二家厂商的模型可以交叉复核？额度紧、一般还是宽松？（只用当前这一个模型；没有第二家；一般）写入 `modelTiers` 四档（全部留空就是单模型模式）、`review.crossVendor`（`false`）、`budget.mode`（`tight` / `normal` / `generous`）。
4. 协作与发布：一个人做还是团队？要不要让 AI 开多个帮手并行？默认分支叫什么？推送、发版和对外提交由谁确认？（一个人；要并行时先问；分支自动探测；推送和发版必须用户确认）写入 `workflow.team`（`solo` / `team`）、`workflow.parallel`（`off` / `ask` / `on`）、`workflow.defaultBranch`、`workflow.branchPrefix`、`workflow.publishConfirm`（`always` / `push-and-release` / `never`）。
5. 回复语言：回复用什么语言？（跟随用户提问的语言）写入 `language.output`（`auto` / `zh-CN` / `en`）。
6. 做事强度：新功能要不要先问清并写规格？动手前搜不搜现成开源方案，搜几个？要不要定十倍目标？（大活才先问并写 `docs/SPEC.md`；搜 5 个；十倍目标只在用户提到性能或体积时提议）写入 `rigor.askFirst`（`off` / `big-only` / `always`）、`rigor.specPath`、`rigor.openSourceSurveyCount`、`rigor.tenX`（`off` / `ask`）。
7. 安全尺度：安全红线用哪一档？有没有额外不许读的目录？（标准档：碰凭据和递归强删直接拦，git 硬重置只提醒；没有额外目录；删除走回收站）写入 `hookMode`（`observe` 起步）、`safetyGuard.profile`（`relaxed` / `standard` / `strict`）、`safetyGuard.extraProtectedPatterns`、`safetyGuard.trashCommand`。
8. 项目类型：这个项目是网页或桌面界面、命令行或库、后端服务，还是官网营销站？有没有线上用户？官网是否允许 AI 训练爬虫？（自动探测类型；没有线上用户；允许搜索爬虫，训练爬虫由用户定）写入 `project.kind`（`web-ui` / `cli-lib` / `backend` / `marketing-site` / `other`）、`project.hasOnlineUsers`、`geo.languages`、`geo.region`、`geo.crawlerPolicy`（`allow-all` / `block-training` / `custom`）。
<!-- wr-onboarding:end -->

本技能主要用到第 1、2、7 题：钩子挂哪份示例由宿主决定，规则档位由 `safetyGuard.profile` 决定，本机静音、Orca 引号和远端临时目录三条规则只在第 1、2 题答了对应环境时才启用。

## 四条设计原则

1. **规矩严格二分。**
   - **留在文档**的是需要结合上下文权衡取舍的软原则（架构风格、文案语气、功能优先级）。
   - **写进钩子**的是零例外的客观硬规矩（禁读凭据目录、禁强删主工作区、禁跑 0 条测试报绿、禁带入本机绝对路径或密钥、禁出现已改名的旧产品名、改了契约必须同步版本）。
2. **先挂 `observe` 观察档，再切 `enforce` 硬拦。**
   - 新脚本上线第一步先跑 `observe` 模式，命中违规时只追加记录到 `.wr-hook-observe.jsonl` 并正常放行（退出码 `0`），绝不一下子把日常工作流卡死。本仓库的钩子在没有配置文件、或配置里还没有 `"onboarded": true` 时一律按 `observe` 跑。
   - 观察日志里有完整命令和路径，记得把 `.wr-hook-observe.jsonl` 加进项目的 `.gitignore`。
   - 真实跑过几轮确认零误报后，把配置里的 `hookMode` 切为 `enforce`，命中即返回非零退出码或拒绝决策并报出精确文件与行号。
3. **毫秒级、零依赖、可重复运行。**
   - 只使用运行环境自带标准库（例如纯 Node.js `node:fs`、`node:path`、`node:os`），免安装第三方依赖，跨 Windows、macOS、Linux 即拿即用。
   - 解析异常时除安全红线外优先安全降级并记录错误，不让格式波动把正常开发锁死。
4. **对批量包装工具展开底层参数统一过筛。**
   - 现代 Agent 常把多次文件写入、批量检索或并发命令封装在一个聚合工具调用里；钩子必须递归展开 `edits`、`commands`、`queries`、`paths`、`files` 等嵌套参数，拆出每一个原子路径与命令过同一套检查，堵死换个工具绕过守卫的漏洞。

## 第一步 把反复踩的坑翻译成可判定条件

当某类错误第二次出现时，按四问定下脚本边界。
1. **触发时机**，决定在工具执行前拦（`PreToolUse`）、工具执行后记账（`PostToolUse`）、回复收尾前查（`Stop`），还是在 Git 提交前查（`pre-commit`）。
2. **精确输入**，列清要检查的字段（文件路径、命令文本、写入内容、回复正文）。
3. **明确例外**，写出必须白名单放行的路径或写法（如示例配置 `.env.example`、系统临时目录、代码块内部、Markdown 表格线）。
4. **可执行修复提示**，拦截报错时不只说「不许做」，还要附带一行正确的替代做法（如给出跨平台移入回收站命令、指出具体哪一行违规）。

## 第二步 双宿主协议输入输出规范

同一份 Node.js 钩子脚本按 Claude Code 与 Antigravity 两种钩子输入输出格式编写，在入口统一解析 `stdin` 后按各自协议输出（仓内离线单测覆盖两种格式，挂载前先按宿主环境实跑确认）。Codex、Cursor 等其他宿主目前只能用技能本身，钩子挂不上。
- **Claude Code 格式**，输入含 `{ tool_name, tool_input, session_id, transcript_path }`。放行时直接以 `process.exit(0)` 退出；硬拦时将原因写到 `stderr` 并以 `process.exit(2)` 退出。会话记录是 JSONL，每行顶层是 `type`，角色和正文在 `message.role`、`message.content` 里；工具返回结果也记成 `type: "user"`，判断「用户说了什么」时要排除。`Stop` 阶段返回 `2` 等于让 AI 接着写，必须先看输入里的 `stop_hook_active`，为 `true` 时直接放行，否则会死循环。
- **Antigravity 格式**，输入含 `{ toolCall: { name, args }, conversationId, hookEventName, transcriptPath }`（或同义字段）。`PreToolUse` 放行时向 `stdout` 输出 `{"decision":"allow"}`，硬拦时输出 `{"decision":"deny","reason":"..."}`；`PostToolUse` 固定输出 `{}`；`Stop` 阶段只记录观察日志并输出 `{}`，均以 `process.exit(0)` 退出。

## 第三步 先写自测再挂载

每个新钩子上线前必须通过三组自动化测试。
1. **正常请求放行测试**，验证合法开发操作 100% 放行。
2. **违规请求拦截测试（`enforce` 模式）**，验证直接调用与嵌套在批量参数里的违规操作全部被精准拦下并输出清晰原因。
3. **观察档记录测试（`observe` 模式）**，验证命中违规时不阻塞（放行），且在 `.wr-hook-observe.jsonl` 准确留痕。

## 现成参考实现

本仓库 `hooks/` 目录自带 4 个可直接复制使用的零依赖通用钩子（按 Claude Code 与 Antigravity 协议编写并支持 Git `pre-commit`，随仓附带 `node hooks/test-hooks.mjs` 离线单测）。
- `hooks/safety-redline-guard.mjs`，安全红线守卫：凭据零触碰、递归强删只放行临时目录和项目内构建产物、主检出 git 硬重置提醒。另有三条按环境启用的规则，默认关：本机静音（`environment.quietMainMachine` 打开后不模拟键鼠、不跑弹浏览器的端到端测试）、Orca 长参数改 `-file`（探测到 Orca 且终端是 PowerShell 时才查）、远端临时目录防碰撞（配了 `environment.remoteHost` 才查）。每条规则可在 `safetyGuard.rules` 里单独设 `off` / `observe` / `enforce`。
- `hooks/evidence-before-pass-gate.mjs`，实证门禁（未读证据、未覆盖或零条测试禁标 `passes: true`），只在项目用 `acceptance.json` 验收单时有意义。
- `hooks/speak-before-act-hook.mjs`，先应声再动手；收尾检查只查你在 `speakBeforeAct.stopPatterns` 里写的规则，默认不查。
- `hooks/copy-and-privacy-lint.mjs`，提交前扫描本机隐私路径与常见密钥，外加你自己配置的禁用词和旧名替换。

配套挂载模板见 `examples/hooks.claude.json`、`examples/hooks.agy.json` 与 `examples/wr.config.example.json`。
