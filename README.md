# wr-skills

简体中文 | [English](README.en.md)

> Windrise AI 的中文 AI Skills 合集与软件工程实战体系。把日常和做软件时验证过的好习惯做成独立 Skill 和零依赖钩子脚本，装上就能用。

[![Docs: CC BY-NC 4.0](https://img.shields.io/badge/docs-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Code: MIT](https://img.shields.io/badge/code-MIT-16A34A.svg?style=flat-square)](LICENSE-MIT)
[![Skills](https://img.shields.io/badge/skills-11-2563EB.svg?style=flat-square)](#skills-一览)
[![Hooks](https://img.shields.io/badge/hooks-4-0F766E.svg?style=flat-square)](#通用钩子脚本)
[![中文](https://img.shields.io/badge/语言-中文-B4532A.svg?style=flat-square)](#)

**按 Skills 通用格式编写，可用于 Claude Code、Codex、Cursor、Antigravity（反重力）、claude.ai 等支持 Skills 的 Agent**（各家没有逐一实测）。每个 Skill 都附一份独立提示词清单，用的 AI 不支持 Skill 也能直接复制。

[四个核心推荐技能](#四个核心推荐技能) · [Skills 一览](#skills-一览) · [首次对齐](#首次对齐) · [通用钩子脚本](#通用钩子脚本) · [安装](#安装) · [仓库结构](#仓库结构) · [授权](#授权) · [更新记录](https://github.com/WindriseAI/wr-skills/commits/main)

> 本仓库是这套技能、提示词和钩子的唯一来源。飞书文档、文章里贴的版本都是从这里摘的，两边对不上时以仓库为准。

## 四个核心推荐技能

这 4 个技能是整套工程做法的骨架，按开工前准备到验货顺序安排，建议新项目或重要任务优先装上。

### wr-ask-first 动手前先挑刺并问清需求

- **解决什么**：AI 一听需求就埋头写，写到一半才发现方向错了、有现成方案没用、或者需求自己打架。
- **装好后这样说**：「先别写代码，帮我挑挑毛病再定规格。」
- **做完你拿到**：一张风险清单（泄密、上下文膨胀、需求矛盾、连带影响），一张现成开源方案对比表（数量可配置，默认 5 个），以及你点过头的规格文件 `docs/SPEC.md`。
- [完整说明](docs/wr-ask-first/README.md) · [提示词清单](docs/wr-ask-first/提示词清单.md)

### wr-10x-goal 定十倍目标并堵死作弊与假通过

- **解决什么**：优化只挤出百分之十，或者 AI 为了凑指标偷删功能、写死返回值、改弱断言。
- **装好后这样说**：「这个导出要跑十分钟，按十倍目标帮我优化，别靠删功能凑数。」
- **做完你拿到**：硬盘、内存、网络的物理下限估算，按十倍定的速度和体积目标，改前改后同一口径的实测对比，以及四条防作弊红线的逐条自查。
- [完整说明](docs/wr-10x-goal/README.md) · [提示词清单](docs/wr-10x-goal/提示词清单.md)

### wr-axiomatic-design 提取功能需求做下三角解耦

- **解决什么**：模块改一处坏一片，几路并行开发合到一起互相打架。
- **装好后这样说**：「这几个模块老是互相牵连，拆活之前先帮我做一下解耦。」
- **做完你拿到**：功能需求与设计参数的依赖矩阵，消掉反向耦合后的实现顺序，哪些可以并行、哪些公共真源要先锁定。
- [完整说明](docs/wr-axiomatic-design/README.md) · [提示词清单](docs/wr-axiomatic-design/提示词清单.md)

### wr-skeptic-audit 三席物理隔离独立盲审

- **解决什么**：写代码的会话自己审自己，几乎永远说没问题。
- **装好后这样说**：「这批改动合完了，帮我开三席盲审。」
- **做完你拿到**：新手用户审交互、老编辑替普通读者把关文案、资深工程师只读审 diff，三份结果合成一张阻断、建议、不改三档的问题表，每条带截图位置、原句或 `file:line`。
- [完整说明](docs/wr-skeptic-audit/README.md) · [提示词清单](docs/wr-skeptic-audit/提示词清单.md)

一行命令装齐四个核心推荐技能。

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first wr-10x-goal wr-axiomatic-design wr-skeptic-audit
```

## Skills 一览

### 风起软件工程套件（8 个按开工前到验收顺序排列的成熟技能）

按「开工前准备（`wr-ask-first`、`wr-10x-goal`、`wr-axiomatic-design`） → 开工与多路并行（`wr-split-work`、`wr-hook-forge`） → 跑通功能与排错验收（`wr-real-qa`、`wr-skeptic-audit`） → 功能稳后界面打磨（`wr-ux-craft`）」完整串起带 AI 做软件的全流程，每个技能独立可用，也可以整套配合。

| 阶段 | Skill | 一句话说清干什么 | 文档 | 提示词清单 |
| --- | --- | --- | --- | --- |
| 开工前准备 | [wr-ask-first](docs/wr-ask-first/README.md) | 动手前先挑刺、比现成方案、问清需求写成规格（核心推荐） | [说明](docs/wr-ask-first/README.md) | [复制用](docs/wr-ask-first/提示词清单.md) |
| 开工前准备 | [wr-10x-goal](docs/wr-10x-goal/README.md) | 按十倍定性能与体积目标，同时堵死作弊与假通过（核心推荐） | [说明](docs/wr-10x-goal/README.md) | [复制用](docs/wr-10x-goal/提示词清单.md) |
| 开工前准备 | [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | 画依赖矩阵消掉反向耦合，再决定能不能并行（核心推荐） | [说明](docs/wr-axiomatic-design/README.md) | [复制用](docs/wr-axiomatic-design/提示词清单.md) |
| 开工与多路并行 | [wr-split-work](docs/wr-split-work/README.md) | 多工作区无重叠并行派活。总协调人只拆活审回执不写代码，每条子线独占一棵 `git worktree` 与文件白名单，先砍废包瘦身再按模型档位多路并行 | [说明](docs/wr-split-work/README.md) | [复制用](docs/wr-split-work/提示词清单.md) |
| 开工与多路并行 | [wr-hook-forge](docs/wr-hook-forge/README.md) | 高频踩坑写成确定性拦截钩子。把零例外客观硬规矩写成零依赖 Node.js 脚本，先挂 `observe` 观察档确认零误报再切 `enforce` 硬拦 | [说明](docs/wr-hook-forge/README.md) | [复制用](docs/wr-hook-forge/提示词清单.md) |
| 跑通功能与排错验收 | [wr-real-qa](docs/wr-real-qa/README.md) | 改动全覆盖真路径验收。做改动文件到行为测试映射并硬禁未覆盖与零用例，用突变探针抓假绿水测试，扫浏览器裁切遮挡并在连败两次时停手查根因 | [说明](docs/wr-real-qa/README.md) | [复制用](docs/wr-real-qa/提示词清单.md) |
| 跑通功能与排错验收 | [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | 合并后三个隔离的只读会话分别审交互、文案和 diff（核心推荐） | [说明](docs/wr-skeptic-audit/README.md) | [复制用](docs/wr-skeptic-audit/提示词清单.md) |
| 功能稳后界面打磨 | [wr-ux-craft](docs/wr-ux-craft/README.md) | 界面省心规矩与跟手动效设计。按只点默认按钮的新手视角过八条省心规矩和十二种状态动效，加上斜向防误触走廊、点击锁定、任意条数扩容与二三阶影响检查 | [说明](docs/wr-ux-craft/README.md) | [复制用](docs/wr-ux-craft/提示词清单.md) |

### 写作 Skill

| Skill | 一句话说清干什么 | 文档 | 提示词清单 |
| --- | --- | --- | --- |
| [wr-plain-cn](docs/wr-plain-cn/README.md) | 平实中文写作与去机器味检查：真实小事起手、连贯口语长句、四条硬封底线与顿号连串、分号拆句、相邻句同构三项句法检查，附默认关闭的可选检查脚本 | [说明](docs/wr-plain-cn/README.md) | [复制用](docs/wr-plain-cn/提示词清单.md) |

> 顿号连串、分号拆句、相邻句同构三项检查思路参考 [lieflat-less-ai-tone](https://github.com/larashero3-dotcom/lieflat-less-ai-tone)，规则文案与检查脚本均为独立编写。

### 日常与增长 Skill

| Skill | 一句话说清干什么 | 文档 | 提示词清单 |
| --- | --- | --- | --- |
| [wr-geo](docs/wr-geo/README.md) | 官网上线前后的搜索引擎与 AI 收录体检，先实测线上内容与爬虫状态，再写逐字契约并由独立检查脚本验收 | [说明](docs/wr-geo/README.md) | [复制用](docs/wr-geo/提示词清单.md) |
| [wr-sunkit](docs/wr-sunkit/README.md) | 拍照算饮食热量、三家 AI 出方案对比、让 AI 专门挑刺反对你 | [说明](docs/wr-sunkit/README.md) | [复制用](docs/wr-sunkit/提示词清单.md) |

新的 Skill 会陆续加进来，Star 或 Watch 这个仓库就能收到更新。

---

## 首次对齐

每个技能开头都有「第 0 步」：先找 `wr.config.json`（当前目录逐级往上，再看用户目录 `~/wr.config.json`），没找到或里面没有 `"onboarded": true`，就一次问你 8 道题，每题带默认值，回一个「好」就全按默认。答案写回项目根目录的 `wr.config.json`，以后技能和钩子都读这一份。

| 题 | 问什么 | 默认 |
| --- | --- | --- |
| 1 机器与测试环境 | 只有一台电脑还是另有测试机、容器或 CI；跑测试能不能占用键鼠和浏览器 | 只有一台；耗时长的测试先说预计多久，同意后在本机跑；可以占用 |
| 2 系统与工具 | 系统、终端、AI 工具，有没有装 Orca | 自动探测 |
| 3 模型与额度 | 有几档模型、有没有第二家厂商交叉复核、额度松紧 | 只用当前模型；没有第二家；一般 |
| 4 协作与发布 | 一个人还是团队、要不要并行、默认分支、推送和发版谁确认 | 一个人；并行先问；自动探测；推送和发版要你确认 |
| 5 回复语言 | 回复用什么语言 | 跟随你的语言 |
| 6 做事强度 | 要不要先写规格、搜几个开源方案、要不要定十倍目标 | 大活才写规格；搜 5 个；你提性能或体积时才提十倍 |
| 7 安全尺度 | 安全红线用哪一档、有没有额外禁读目录 | 标准档；没有 |
| 8 项目类型 | 界面、命令行或库、后端还是官网；有没有线上用户；官网拦不拦训练爬虫 | 自动探测；没有线上用户；训练爬虫你来定 |

每个字段的含义、取值和默认值见 [examples/README.md](examples/README.md)，完整模板是 [examples/wr.config.example.json](examples/wr.config.example.json)。

---

## 通用钩子脚本

文档里写十遍感叹号，上下文一长 AI 照样漏看。`hooks/` 目录提供 4 个纯 Node.js 标准库编写、零第三方依赖的确定性脚本，按 Claude Code 与 Antigravity 钩子输入输出格式编写并支持 Git `pre-commit`。技能本身在 Claude Code、Codex、Cursor、Antigravity、claude.ai 都能用；钩子目前只能挂在 Claude Code 和 Antigravity 上。

**装上就守两条红线，其余先只记录。** 没有配置文件、或配置里还没有 `"onboarded": true` 时，安全守卫对「碰凭据文件」和「递归强删」（临时目录和项目内构建产物除外）的常见写法直接拦；其余规则只把命中写进 `.wr-hook-observe.jsonl`（记得加进 `.gitignore`）。做完首次对齐后，安全守卫按标准档执行：凭据和递归强删照样拦，git 硬重置只记录，其余跟随 `hookMode`（默认 `observe`）。想全部硬拦就把 `hookMode` 改成 `"enforce"`。

**谁能放宽这两条红线**：只有用户目录的 `~/wr.config.json`（`safetyGuard.rules`、`profile`、`allowPatterns`、`allowedDeleteDirs`、`hookMode`），以及你写在钩子设置里的 `--mode`、`--user-config <配置文件路径>`。「用户目录」按系统账户的真实用户目录找，不看 `HOME`、`USERPROFILE` 环境变量；哪里算临时目录也按固定的系统位置判断，不看 `TEMP`、`TMP`、`TMPDIR`。项目里的 `wr.config.json` 和所有环境变量都只能收紧不能放宽，所以克隆来的陌生仓库关不掉它们。AI 用写文件工具改 `~/wr.config.json` 会被拦；Bash 命令里只要同时出现用户目录写法（`~`、`$HOME`、`%USERPROFILE%`、`$env:USERPROFILE`、`homedir()`、`expanduser` 或用户目录的绝对路径）和 `wr.config.json`，又不是 `cat`、`type` 这类只读查看，也一律拦（宁可错拦，例如从用户目录往项目里复制这份配置也会被拦，请用户自己动手）。红线被放宽时，每次放行都会提醒一句。

**它拦得住什么、拦不住什么**：守卫检查工具参数里的路径（包括 Grep、Glob 的通配参数）和命令里出现的词。能拦：读写 `.env`、`~/.ssh`、`~/.aws`、`~/.gnupg`、`.netrc`、`.npmrc`、`.git-credentials`、私钥和证书文件（含 `.bak` 备份）这类写法，以及 `rm -rf`、`/bin/rm`、`Remove-Item -Recurse`、`del /s`、`rd /s`、`find … -delete`、脚本里写死路径的 `fs.rm` / `rmSync` / `shutil.rmtree` / `rimraf`。拦不住：命令里靠通配符展开才出现的路径（`cat .e*`、`.en?`）、拆开或拼出来的文件名（`.e""nv`、`$(echo .env)`、变量拼出来的路径）、递归搜索文件内容（`grep -r API_KEY .`）、脚本里没写死路径的删除、改了名或套了别名的命令、路径拼得看不出是守卫配置的写入（变量或通配拼文件名、从家目录的子目录用 `../` 写过去、先写脚本文件再执行）、先建目录联接或符号链接再通过链接写入、对钩子挂载文件（`.claude/settings*.json`）和 `hooks/` 里钩子脚本本身的修改（这几处不在守卫保护范围内）、宿主自带的权限放行。另外，命令里先 `cd` 再删相对路径时，放行名单（`dist`、`build` 等）不再生效，会按不放行处理。**它是对常见写法的尽力拦截，不是安全边界**；真要保护，同时配下面的权限拒绝表和操作系统权限（文件权限、单独账户或容器）。

| 脚本 | 触发时机 | 干什么用 |
| --- | --- | --- |
| [hooks/safety-redline-guard.mjs](hooks/safety-redline-guard.mjs) | `PreToolUse` | 凭据零触碰；递归强删只放行临时目录和项目内的构建产物目录（按路径段整段匹配，提示移入回收站）；主检出 git 硬重置提醒。另有三条按环境启用、默认关的规则：本机静音、Orca 长参数改 `-file`、远端临时目录防碰撞。支持展开批量工具参数统一过筛，每条规则可单独开关 |
| [hooks/evidence-before-pass-gate.mjs](hooks/evidence-before-pass-gate.mjs) | `PostToolUse` + `PreToolUse` | 记录当前会话真正读过的证据文件；向 `acceptance.json` 验收单写入 `passes: true` 前，核验无未覆盖改动、无零条测试且证据已亲眼读过。项目不用验收单就不用挂 |
| [hooks/speak-before-act-hook.mjs](hooks/speak-before-act-hook.mjs) | `PreToolUse` + `Stop` | 收到用户消息后一句话没说就调工具，提醒一次：默认只把提醒塞进 AI 的上下文、不拒绝这次调用，`speakBeforeAct.preAction` 写 `block` 才拒绝（兼容 Claude Code 的会话记录格式）；收尾检查只查你在 `speakBeforeAct.stopPatterns` 里写的规则，默认什么都不查，并带防死循环保护 |
| [hooks/copy-and-privacy-lint.mjs](hooks/copy-and-privacy-lint.mjs) | `pre-commit` / CI | 运行时读取本机用户名与家目录，扫描私密路径外泄和常见密钥；另可配置你自己的禁用词和旧名替换，不带任何内置文风词表 |

常用开关如下，全部字段见 [examples/README.md](examples/README.md)。

| 字段或变量 | 默认 | 作用 |
| --- | --- | --- |
| `onboarded` | `false` | 不是 `true` 时只有凭据和递归强删两条硬拦，其余只记录 |
| `hookMode` | `observe` | `observe` 只记录，`enforce` 硬拦，`off` 全关 |
| `safetyGuard.profile` | `standard` | `relaxed` / `standard` / `strict` 三档 |
| `safetyGuard.rules.<规则名>` | 跟档位 | 单条规则写 `off` / `observe` / `enforce` |
| `environment.quietMainMachine` | `false` | 本机静音：打开后不许模拟全局键鼠、不许直接跑弹浏览器的端到端测试 |
| `environment.remoteHost` | 空 | 测试机主机名，填了才检查发往它的 `ssh` / `scp` 是否用了没有唯一后缀的共享临时目录 |
| `tools.orca` | 自动探测 | 探测到 Orca 且终端是 PowerShell 时，才检查 orca 命令的长内联参数 |
| `language.output` | `auto` | 写 `en` 时钩子提示改用英文，其余用中文 |
| `observeLogDetail` | `redacted` | 观察日志默认只记规则名、路径最后一段和命令名；写 `full` 才记完整命令和路径 |
| `WR_HOOK_MODE` | 空 | 环境变量，临时指定钩子的模式；只能收紧两条红线，不能放宽 |
| `WR_QUIET_HOST=1` / `WR_TEST_RUNNER=1` | 空 | 临时打开本机静音；静音时放行某一条你同意在本机跑的重型测试 |

**挂到 Claude Code**：把 [examples/hooks.claude.json](examples/hooks.claude.json) 里的 `hooks` 段并进 Claude Code 的设置文件。想挡住克隆来的陌生仓库，**装在用户级的 `~/.claude/settings.json`**，不要只挂在项目级的 `.claude/settings.json`：项目级挂载本身就是仓库里的文件，仓库可以改它、删它。需要把用户级守卫配置放到别处时，在钩子命令后面加 `--user-config <配置文件路径>`，路径必须是**项目目录之外的绝对路径**；写相对路径或指向项目里的文件，钩子会报错并不加载它，改用用户目录的 `wr.config.json`。示例用的是 Claude Code 官方文档给的 `node "${CLAUDE_PROJECT_DIR}/hooks/<脚本>.mjs"` 写法，AI 切到子目录或 worktree 时也能找到脚本。我们只在 Windows 上用 Git Bash 的环境核对过；如果你那边钩子报「找不到脚本」，直接把 `${CLAUDE_PROJECT_DIR}` 换成项目的绝对路径。想装成对所有项目生效的全局钩子，把 `hooks/` 放到固定目录，命令里写它的绝对路径，例如 `node "/Users/<你>/wr-hooks/safety-redline-guard.mjs"`（Windows 写 `node "C:/Users/<你>/wr-hooks/safety-redline-guard.mjs"`）。Antigravity 的示例在 [examples/hooks.agy.json](examples/hooks.agy.json)，用的是相对项目根目录的路径。

**权限拒绝表**：钩子之外，建议同时把最危险的禁读路径写进 Claude Code 的权限拒绝表，两道防线互不依赖。可直接参考 [examples/claude-permissions.example.json](examples/claude-permissions.example.json)，首次对齐第 7 题答的额外禁读目录也照这个格式加进去。

运行下面这行跑完全部离线单测，验证 4 个钩子的放行、拦截、双协议与模式切换。目前只在 Windows 11 上跑过，macOS 和 Linux 没有实测。钩子输出中文时需要终端用 UTF-8（Windows 旧控制台可先执行 `chcp 65001`），也可以把 `language.output` 设成 `en`。

```bash
node hooks/test-hooks.mjs
```

---

## 安装

### 推荐方式一 一行命令（Claude Code、Codex、Cursor、Antigravity 等）

一键安装仓库全部推荐 Skill，运行下面这行命令。

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

只装某一个独立 Skill，把最后的技能名换成任意包名即可（按开工前到验收顺序排列）。

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first
npx -y skills add WindriseAI/wr-skills -g --skill wr-10x-goal
npx -y skills add WindriseAI/wr-skills -g --skill wr-axiomatic-design
npx -y skills add WindriseAI/wr-skills -g --skill wr-split-work
npx -y skills add WindriseAI/wr-skills -g --skill wr-hook-forge
npx -y skills add WindriseAI/wr-skills -g --skill wr-real-qa
npx -y skills add WindriseAI/wr-skills -g --skill wr-skeptic-audit
npx -y skills add WindriseAI/wr-skills -g --skill wr-ux-craft
```

### 方式二 Claude Code 插件市场

```bash
claude plugin marketplace add WindriseAI/wr-skills
# 装整套风起工程 8 个成熟技能
claude plugin install wr-engineering@wr-skills
# 或者单装任意一个
claude plugin install wr-ask-first@wr-skills
claude plugin install wr-10x-goal@wr-skills
claude plugin install wr-geo@wr-skills
```

通过插件安装的 Skill 带命名空间，点名调用时输入 `/wr-ask-first:wr-ask-first` 或 `/wr-engineering:wr-ask-first`。

### 方式三 直接跟你的 Agent 说一句话

把下面任意一句发给 Claude Code、Codex、Cursor 或 Antigravity，让它自己装好。

> 请帮我运行 `npx -y skills add WindriseAI/wr-skills -g --all`，把 WindriseAI/wr-skills 里的推荐 Skill 装到我的全局技能目录。

只想装单个时可以这样说。

> 请帮我安装 github.com/WindriseAI/wr-skills 里的 wr-ask-first 和 wr-10x-goal。

### 方式四 claude.ai 网页版和 App

下载本仓库 ZIP 压缩包后解压，将 `skills/<技能名>` 文件夹单独打包成 `.zip` 上传到 claude.ai 设置里的 Skills 页面（或直接复制 `docs/<技能名>/提示词清单.md` 贴进对话使用）。

### 方式五 手动安装

把 `skills/` 下需要的文件夹整个复制到你的全局或项目技能目录（如 Claude Code 的全局技能目录或 Codex 的 `.agents/skills/`）。如果要启用确定性钩子，把 `hooks/` 复制到项目根目录，按上面「挂到 Claude Code」的说明接入，或参照 `examples/hooks.agy.json`、Git `pre-commit` 接入（启用前建议先跑通 `node hooks/test-hooks.mjs`）。配置文件可以让技能在首次对齐时写，也可以把 `examples/wr.config.example.json` 复制成项目根目录的 `wr.config.json` 手改，改完记得把 `onboarded` 写成 `true`。

### 网络受限时

方式一和方式二要能访问 GitHub 和 npm。访问不了时，找一台能上网的电脑下载仓库 ZIP（或从你常用的代码托管镜像克隆一份），拷过来后按方式五手动复制。整套文件都是纯文本和零依赖脚本，复制过去就能用，不需要再联网装任何依赖。

## 仓库结构

```text
wr-skills/
├── skills/                  # 11 个推荐独立 Skill（按开工前到验收顺序排列）
│   ├── wr-ask-first/SKILL.md
│   ├── wr-10x-goal/SKILL.md
│   ├── wr-axiomatic-design/SKILL.md
│   ├── wr-split-work/SKILL.md
│   ├── wr-hook-forge/SKILL.md
│   ├── wr-real-qa/SKILL.md
│   ├── wr-skeptic-audit/SKILL.md
│   ├── wr-ux-craft/SKILL.md
│   ├── wr-plain-cn/
│   ├── wr-geo/
│   └── wr-sunkit/
├── docs/                    # 每个 Skill 的详细说明、提示词清单与配图
├── hooks/                   # 4 个零依赖通用 Node.js 钩子脚本与自测脚本
├── examples/                # 配置模板与字段说明、首次对齐原文、AGENTS 模板、钩子挂载与权限拒绝表示例
├── .claude-plugin/          # Claude Code 插件市场配置
├── LICENSE                  # 文档与技能内容：CC BY-NC 4.0
├── LICENSING.md             # 每类文件归哪种授权的对照表
└── LICENSE-MIT              # 代码：MIT
```

## 授权

仓库里分两种东西，授权不一样。

**代码是 MIT，可以随便用，包括商用。** 指所有可执行脚本：`hooks/` 下的钩子和自测、`skills/*/scripts/` 下的检查脚本、`docs/*/src/` 下的出图脚本，每个文件开头都标了 `SPDX-License-Identifier: MIT`；`examples/` 下叫你复制进项目的配置模板（`*.json`）也按 MIT 算。全文见 [LICENSE-MIT](LICENSE-MIT)，每个文件归哪种授权见 [LICENSING.md](LICENSING.md)。拿去改、合进自己的项目、放进收费产品都行，保留版权声明即可。

**文档和技能内容是 CC BY-NC 4.0 加作者额外授权。** 指 Skill（`SKILL.md`）、提示词清单、README 等说明文档和配图，按 [CC BY-NC 4.0](LICENSE)（署名-非商业性使用 4.0 国际）授权，转载、修改、分享时注明作者 Windrise AI 和本仓库链接。

- **作者额外授权**（版权人在 CC BY-NC 4.0 之外另行给出的许可，与 LICENSE 一起生效）：个人和团队在自己的工作中使用这些技能和提示词（包括在公司里用来开发自己的软件），不算商业用途，可以免费用。
- **仍然不可以**：把这些内容本身拿去卖或换钱，例如转售、放进付费课程、训练营、付费社群、付费资料包、付费咨询交付物，或者打包进收费产品当卖点或会员赠品。

拿不准算不算商用，或者需要商业授权，请通过 [Issue](https://github.com/WindriseAI/wr-skills/issues) 联系。

## 贡献

哪里用着不顺手、哪种场景没照顾到、还想要什么新技能，直接提 Issue 或 PR 就行。改动请提到本仓库，飞书等其他地方的副本会跟着这里同步。
