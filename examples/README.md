# examples 配置与模板说明

[← 返回 wr-skills](../README.md)

| 文件 | 用途 |
| --- | --- |
| `wr.config.example.json` | 配置全集模板。技能第一次启用时会先做首次对齐，把你的答案写成项目根目录的 `wr.config.json`；也可以手动复制改名 |
| `onboarding-step0.md` | 每个 SKILL.md 开头「第 0 步 首次对齐」的原文，八道题和默认值都在里面 |
| `hooks.claude.json` / `hooks.agy.json` | Claude Code 与 Antigravity 的钩子挂载示例 |
| `AGENTS.template.md` | 项目协作总纲模板（完整档写法） |
| `acceptance.example.json` | 验收单示例，配合 `hooks/evidence-before-pass-gate.mjs` 使用 |

## 配置文件放在哪

钩子和技能按同一个顺序找 `wr.config.json`：先读用户目录（`~/wr.config.json`，Windows 是 `C:\Users\<你>\wr.config.json`），再从当前目录逐级往上找项目里的那份，项目里写了的字段覆盖用户目录的。两份都没有时一律按下表默认值。

## 钩子怎么决定拦不拦

1. 命令行参数 `--mode observe|enforce|off` 最优先，其次是环境变量 `WR_HOOK_MODE`。
2. 都没给时，配置里没有 `"onboarded": true`（包括根本没有配置文件），**全部钩子只记录不拦截**，凭据和强删也一样。首次对齐写完配置之后才开始按下面的规则拦。
3. 完成首次对齐后看 `hookMode`，再叠加安全守卫的档位 `safetyGuard.profile`：

| 档位 | 凭据零触碰 | 递归强删 | git 硬重置 | 其余规则 |
| --- | --- | --- | --- | --- |
| `relaxed` 宽松 | 跟随 `hookMode` | 跟随 `hookMode` | 不查 | 跟随 `hookMode` |
| `standard` 标准（默认） | 永远硬拦 | 永远硬拦 | 只记录 | 跟随 `hookMode` |
| `strict` 严格 | 硬拦 | 硬拦 | 硬拦 | 硬拦 |

单条规则还可以在 `safetyGuard.rules.<规则名>` 里写 `off` / `observe` / `enforce` 覆盖档位。规则名是 `credentials`、`hardDelete`、`gitReset`、`quietHost`、`orcaQuote`、`remoteTmp`。

## 字段说明

### 首次对齐与钩子总开关

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `onboarded` | `false` | 首次对齐做完后由 AI 写成 `true`。不是 `true` 时钩子只记录不拦，技能每次启用都会先问一遍八道题 |
| `hookMode` | `observe` | 完成对齐后钩子的总模式：`observe` 只记录，`enforce` 硬拦，`off` 全关 |
| `observeLogPath` | `.wr-hook-observe.jsonl` | 观察日志路径（相对项目根）。日志里有完整命令和路径，记得加进 `.gitignore` |

### environment 机器与环境（第 1、2 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `environment.machine` | `single` | `single` 只有这一台电脑；`has-runner` 另有测试机、容器或 CI。决定 wr-real-qa 门禁 5 怎么执行 |
| `environment.heavyTestsOnMainMachine` | `ask` | 只有一台电脑时，耗时长的端到端测试：`allow` 直接跑，`ask` 先说耗时等你点头，`deny` 只把命令列给你 |
| `environment.quietMainMachine` | `false` | 本机静音。打开后安全守卫不许在这台电脑模拟全局键鼠、不许直接跑 `playwright test`、`cypress run`、`electron .` 这类会弹窗口的测试 |
| `environment.remoteHost` | 空 | 测试机的 ssh 主机名（字符串或数组）。填了才启用「远端临时目录防碰撞」规则，并且只检查发往这些主机的 `ssh` / `scp` 命令 |
| `environment.os` / `environment.shell` / `environment.host` | 空（自动探测） | 系统、终端、AI 宿主。`shell` 为 `powershell` 或 `pwsh` 且探测到 Orca 时启用 Orca 引号规则；空着时按 Windows 视为 PowerShell |

### tools 工具（第 2 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `tools.orca` | `null`（自动探测） | 是否在 Orca 多代理工作台里用。`true` / `false` 强制指定；空着时看环境变量 `ORCA_APP_VERSION` 等是否存在。决定 wr-split-work 走哪条路线、Orca 引号规则启不启用 |

### 模型、复核与额度（第 3 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `modelTiers.tier1_architect` | 空 | 最强推理档：架构定盘、界面设计、最终总审 |
| `modelTiers.tier2_builder` | 空 | 主力编码档：核心功能、重构、修根因 |
| `modelTiers.tier3_reviewer` | 空 | 独立复核档：只读审查、假绿排查 |
| `modelTiers.tier4_runner` | 空 | 快速经济档：批量改名、格式化、检索汇总 |
| `review.crossVendor` | `false` | 有没有第二家厂商的模型可以交叉复核。`false` 时复核用同一模型开新会话 |
| `budget.mode` | `normal` | 额度松紧：`tight` / `normal` / `generous`。`tight` 时 wr-skeptic-audit 走精简档，并行路数也会收着 |

四档全部留空就是单模型模式，所有子任务都用当前模型。

### workflow 协作与发布（第 4 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `workflow.team` | `solo` | `solo` 一个人；`team` 团队 |
| `workflow.parallel` | `ask` | 让 AI 开多个帮手并行：`off` 不开，`ask` 先问，`on` 直接开 |
| `workflow.defaultBranch` | 空（自动探测） | 默认分支名，例如 `main` 或 `master` |
| `workflow.branchPrefix` | `feat/` | 新分支前缀 |
| `workflow.publishConfirm` | `push-and-release` | 哪些动作必须你确认：`always` 每次提交都问，`push-and-release` 推送和发版要问，`never` 不问 |

### language 回复语言（第 5 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `language.output` | `auto` | 回复语言：`auto` 跟随你提问的语言，或写 `zh-CN`、`en` |

### rigor 做事强度（第 6 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `rigor.askFirst` | `big-only` | 什么活先问清并写规格：`off` / `big-only` / `always` |
| `rigor.specPath` | `docs/SPEC.md` | 规格文件位置 |
| `rigor.openSourceSurveyCount` | `5` | 动手前搜几个现成开源方案，小活可以写 `0` |
| `rigor.tenX` | `ask` | 十倍目标：`off` 不提，`ask` 只在你提到性能或体积时提议 |
| `rigor.impactCheck` | `on` | 界面改动前是否推演二阶、三阶影响 |

### project 与 geo 项目类型（第 8 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `project.kind` | 空（自动探测） | `web-ui` / `cli-lib` / `backend` / `marketing-site` / `other`。不是界面类时跳过像素扫描和界面打磨 |
| `project.hasOnlineUsers` | `false` | 有没有线上用户，决定要不要展示「群反馈归批」那套流程 |
| `geo.languages` | `[]` | 官网有哪些语言版本 |
| `geo.region` | 空 | 主要地区，例如 `cn`、`global`。面向中文用户时 wr-geo 会加测 `Baiduspider` |
| `geo.crawlerPolicy` | 空（由你定） | `allow-all` 全放行；`block-training` 只拦训练类爬虫；`custom` 自定 |

### safetyGuard 安全守卫（第 7 题）

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `safetyGuard.profile` | `standard` | 档位，见上面的表 |
| `safetyGuard.rules` | `{}` | 单条规则覆盖，例如 `{ "gitReset": "off" }` |
| `safetyGuard.allowedDeleteDirs` | `dist`、`build`、`node_modules`、`.cache`、`worktrees` | 递归强删放行的目录名。按路径段整段匹配，并且必须在项目目录里面；临时目录（系统临时目录或路径里有 `tmp` / `temp` 这一段）始终放行 |
| `safetyGuard.extraProtectedPatterns` | `[]` | 额外不许碰的路径正则 |
| `safetyGuard.allowPatterns` | `[]` | 凭据规则的白名单正则，例如测试夹具 `^fixtures/` |
| `safetyGuard.trashCommand` | 空 | 拦下强删时提示用的回收站命令；空着时按系统给默认写法 |
| `safetyGuard.orcaInlineMaxChars` | `120` | Orca 引号规则里内联参数的长度上限 |
| `safetyGuard.remoteTmpSuffixes` | 空（用内置的 task、run、job、wt、branch、worker、时间戳、短哈希） | 远端临时目录被视为「已带唯一后缀」的正则片段 |

### 其他钩子

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `evidenceGate.targetFiles` | `["acceptance.json"]` | 实证门禁盯哪些验收单文件名。项目不用验收单时这个钩子可以不挂 |
| `speakBeforeAct.checkStopResponse` | `true` | 是否启用收尾检查 |
| `speakBeforeAct.stopPatterns` | `[]` | 收尾检查的规则，字符串正则或 `{ "pattern": "...", "hint": "..." }`。默认为空，也就是什么都不查；提交哈希、会话编号这类内容不会被拦 |
| `copyLint.extensions` | `.md` `.txt` `.html` `.js` `.mjs` `.ts` `.json` `.css` | 隐私扫描的文件类型 |
| `copyLint.excludePaths` | `node_modules`、`.git`、`dist`、`build` | 跳过的目录名 |
| `copyLint.customBannedWords` | `[]` | 你自己的禁用词，例如已经改名的旧代号。没有任何内置词表 |
| `copyLint.termReplacements` | `{}` | 旧名到新名的替换提示，例如 `{ "旧产品名": "请改为新产品名" }` |

### 环境变量

| 变量 | 含义 |
| --- | --- |
| `WR_HOOK_MODE` | 临时指定所有钩子的模式（`observe` / `enforce` / `off`），优先级高于配置 |
| `WR_QUIET_HOST=1` | 临时打开本机静音，效果同 `environment.quietMainMachine: true` |
| `WR_TEST_RUNNER=1` | 本机静音打开时，你同意在本机跑某条重型测试，就在那条命令前加上它放行 |
