---
name: wr-split-work
description: 多工作树无重叠并行派活。总协调人只拆活、查证、审回执与合并，不亲自写业务代码；一活一棵独立 git worktree 并划清独占文件白名单；按四档通用难度从本地配置路由模型；先砍废包做减法压小体积，再靠数据版式分离与多路并发提速；附通用 git worktree 与 Orca 双路实操。用户要并行拆任务、派多个代理同时开发、防止多会话改同一文件冲突，或要压小产物与加速构建时使用。
---

# wr-split-work 多工作树无重叠并行派活

把大活拆成互不踩脚的多条支线，每路配独立工作树和独占文件清单，协调人稳住全局，帮手各自快速交付。

## 第 0 步 首次对齐（每次启用本技能先做）

<!-- wr-onboarding:start -->
先找配置文件 `wr.config.json`：从当前目录逐级往上找，再看用户目录（`~/wr.config.json`）；两份都有时，项目里的字段覆盖用户目录的。

- 读到 `"onboarded": true`，就按里面的字段办事，不再提问，直接往下走。配置里没写的字段按下面各题的默认值理解。
- 没有这个文件，或者没有 `"onboarded": true`，先把下面 8 题一次发给用户，每题括号里是默认值，并说明「回『好』就全按默认」。用户回「好」或只改了其中几题，其余一律按默认。
- 收到答复后，把答案连同 `"onboarded": true` 写进项目根目录的 `wr.config.json`，已有字段保留不动，写完告诉用户写在哪、怎么改；再看项目的 `.gitignore` 里有没有 `.wr-hook-observe.jsonl`，没有就加上并告诉用户。用户要求全局生效时，把要写的内容给用户，请用户自己存成 `~/wr.config.json`（安全守卫不让 AI 改这个文件，因为只有它能放宽安全红线）。字段全集和说明见 github.com/WindriseAI/wr-skills 的 `examples/README.md`。
- 用户说「这次先不对齐」，就按默认值办事，不写文件，下次启用时再问。
- 钩子在 `onboarded` 变成 `true` 之前，除了碰凭据和递归强删照样直接拦，其余规则只记录不拦截。这两条红线只有用户目录的 `~/wr.config.json` 能放宽，项目里的配置写了也不算。

1. 机器与测试环境：只有这一台电脑，还是另有测试机、容器或 CI？跑测试时能不能占用这台电脑的键盘、鼠标和浏览器？（只有一台；耗时长的测试先说预计多久，同意后在本机跑；可以占用）写入 `environment.machine`（`single` / `has-runner`）、`environment.heavyTestsOnMainMachine`（`allow` / `ask` / `deny`）、`environment.quietMainMachine`（`false`）、`environment.remoteHost`（测试机的 ssh 主机名，没有就留空）。
2. 系统与工具：用什么系统和终端（决定命令和回收站写法）？在哪个 AI 工具里用（决定钩子能不能挂、挂哪份示例）？有没有装 Orca 多代理工作台？（系统、终端和宿主自动探测；Orca 自动探测）写入 `environment.os`、`environment.shell`、`environment.host`、`tools.orca`。
3. 模型与额度：手上有哪几档模型？有没有第二家厂商的模型可以交叉复核？额度紧、一般还是宽松？（只用当前这一个模型；没有第二家；一般）写入 `modelTiers` 四档（全部留空就是单模型模式）、`review.crossVendor`（`false`）、`budget.mode`（`tight` / `normal` / `generous`）。
4. 协作与发布：一个人做还是团队（团队时合并走合并请求评审）？要不要让 AI 开多个帮手并行？默认分支叫什么？推送、发版和对外提交由谁确认？（一个人；要并行时先问；分支自动探测；推送和发版必须用户确认）写入 `workflow.team`（`solo` / `team`）、`workflow.parallel`（`off` / `ask` / `on`）、`workflow.defaultBranch`、`workflow.branchPrefix`、`workflow.publishConfirm`（`always` / `push-and-release` / `never`）。
5. 回复语言：回复用什么语言？（跟随用户提问的语言）写入 `language.output`（`auto` / `zh-CN` / `en`）。
6. 做事强度：新功能要不要先问清并写规格？动手前搜不搜现成开源方案，搜几个？要不要定十倍目标？（大活才先问并写 `docs/SPEC.md`；搜 5 个；十倍目标只在用户提到性能或体积时提议）写入 `rigor.askFirst`（`off` / `big-only` / `always`）、`rigor.specPath`、`rigor.openSourceSurveyCount`、`rigor.tenX`（`off` / `ask`）。
7. 安全尺度：安全红线用哪一档？有没有额外不许读的目录？（标准档：碰凭据和递归强删直接拦，git 硬重置只提醒；没有额外目录；删除走回收站）写入 `hookMode`（`observe` 起步）、`safetyGuard.profile`（`relaxed` / `standard` / `strict`）、`safetyGuard.extraProtectedPatterns`、`safetyGuard.trashCommand`。
8. 项目类型：这个项目是网页或桌面界面、命令行或库、后端服务，还是官网营销站？有没有线上用户（有的话排错时会先只读查日志、把反馈归批）？官网是否允许 AI 训练爬虫？（自动探测类型；没有线上用户；允许搜索爬虫，训练爬虫由用户定）写入 `project.kind`（`web-ui` / `cli-lib` / `backend` / `marketing-site` / `other`）、`project.hasOnlineUsers`、`geo.languages`、`geo.region`、`geo.crawlerPolicy`（`allow-all` / `block-training` / `custom`）。
<!-- wr-onboarding:end -->

本技能主要用到第 2 题（`tools.orca` 决定走路线 A 还是 B）、第 3 题（`modelTiers` 全部留空就是单模型模式）和第 4 题（`workflow.team`、`workflow.parallel`、`workflow.defaultBranch`、`workflow.branchPrefix`）。

## 五条核心纪律

1. **总协调人只管拆活、查证、审回执、做合并，不写业务代码。** 协调会话一旦下场写业务细节，上下文立刻被源码塞满，迅速丢失全局视野。`workflow.parallel` 为 `off` 或活本身只改一两个文件时，不拆活，直接在当前会话做完。
2. **一活一棵独立 `git worktree`，划清独占文件白名单。** 每份派活任务书必须明写允许改动的精确文件路径；如果两份活会碰到同一个文件，先改拆分边界，严禁两路同时改同一文件靠合并碰运气。
3. **大文件先看结构大纲，再分段读取**（经验值是超过三百行左右就先看大纲，每段一两百行，按模型上下文大小调整）。 禁止盲目把整仓库或上千行文件塞进单轮对话；约定写进只读的 `docs/SPEC.md`，工具按需挂载。
4. **按四档通用难度派活，模型映射外置到 `wr.config.json`。** 不同难度的活交给对应档位模型，省额度但不降低成品质量，最终验收始终由高档位把关。
5. **多帮手并行时，交活用固定三句话回执加真命令输出。** 交活只报做了什么、发现了什么、还剩什么，附修改文件列表和本轮刚跑出来的检查输出。单人单会话做完时不必套这个格式，照常说清结果和证据即可。

## 第一步 先用公理设计验明下三角矩阵并做减法瘦身

动手拆活前，先用 `wr-axiomatic-design` 提取独立的功能需求 FR 与设计参数 DP 画出设计矩阵，验明右上角全为零（已收敛为无耦合对角阵或准耦合下三角阵）再放行多路并行；存在反向耦合时先抽唯一真源并重排定稿顺序，处于下三角阵上游的公共真源先行锁定。随后对目标模块执行架构瘦身。

1. **砍废包与做减法（朝数量级压小体积与代码量）。**
   - 先删死代码、没人读的配置项、只转一手的包装函数和过重无用依赖。
   - 内部接口重构时全仓搜出调用方一次迁完，直接删旧接口，不留兼容壳（对外已发布接口、旧存档格式和线上协议除外）。
   - 做完汇报改动后代码和产物比动手前净增还是净减。
2. **先定数据结构，内容与版式分离，为多路并发铺路。**
   - 业务文案和配置抽成纯数据文件，样式放进根级样式变量，渲染代码只读数据。这样写文案、调样式、写逻辑三路完全零文件重叠。
   - 用互斥状态类型代替多个布尔开关组合，外部输入在入口一次性解析并带字段名报错。
3. **数量级提速与防作弊双底线。**
   - 性能瓶颈按数量级设定目标（如 10 秒操作朝 0.1 秒改结构），优先改架构（批量化、零拷贝、多路并发）并先算出硬盘、内存、网络物理下限。
   - 严禁为了速度或体积砍掉加密、验签、校验和权限判断；物理极限够不到的如实交实测数据。

## 第二步 四档通用难度派活表

按第 0 步读到的配置（当前目录往上找，再看用户目录）取 `modelTiers` 映射，按任务性质派单。

- 四档全部留空或没有这个字段，就是**单模型模式**：不分档，所有子任务都用当前模型，只按下表区分任务性质和验收标准。
- 只填了部分档位，空着的档位用相邻更高一档的模型代替；填的值看着像占位符（例如还写着 `your-` 开头的示例文字）时，先问用户实际用哪个模型，不要照字面去调用。
- `review.crossVendor` 为 `false` 时，`tier3_reviewer` 用同一模型开新会话，换一份审查清单即可。

| 通用难度档位 | 适用任务范围 | 典型产出与验收标准 |
| --- | --- | --- |
| `tier1_architect`（架构与审美） | 顶层架构定盘、视觉与交互精修、安全与加密逻辑、大波合并后最终总审 | 规格文档、最终界面成品、带行号的终审放行结论 |
| `tier2_builder`（逻辑攻坚） | 核心业务功能编码、模块重构、跨端接口联调、复杂缺陷根因修复 | 通过单测与静态检查的独立分支改动 |
| `tier3_reviewer`（独立核查） | 跨模型盲审、只读代码审查、测试覆盖缺口与假绿排查 | 纯只读问题清单，每条附带 `file:line` 或命令输出 |
| `tier4_runner`（机械跑腿） | 批量改名、数据清洗、模板填充、格式化、批量检索汇总 | 精确按脚本或规格完成的机械产物 |

## 第三步 标准派活任务书模板

发给每一个并行帮手的任务书，固定写清五项内容。

```markdown
- 目标，一句话说清要交付什么。
- 工作树与分支，写清工作目录路径和独立分支名。
- 独占文件白名单，只允许修改的文件路径（范围外文件一律禁碰）。
- 参考准数，写明 `docs/SPEC.md` 对应章节和需要先查证的现成文件。
- 完工门槛，写清必须跑通的验证命令，以及三句话回执（做了什么、发现了什么、还剩什么）。
```

## 第四步 双路实操指引

### 路线 A 通用 `git worktree` 并行（适用所有命令行与编辑器）

**先看 `workflow.team`。** 为 `team` 时不要照下面第 3 步在本地建集成分支直接合并：各分支推到远端后分别发合并请求，走完评审再合；第 3 步只适用于 `solo`（默认）。

```bash
# 0. 默认分支取 workflow.defaultBranch，没写就自动探测（下面用 BASE 代替）
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
BASE=${BASE:-$(git branch --show-current)}

# 1. 为每条互不冲突的子线创建独立工作树与分支（前缀取 workflow.branchPrefix，默认 feat/）
git worktree add ../wt-data -b feat/data-layer "$BASE"
git worktree add ../wt-ui   -b feat/ui-layout  "$BASE"
git worktree add ../wt-test -b feat/real-tests "$BASE"

# 2. 在各自工作树分别启动独立的 Agent 会话并喂入任务书

# 3. 全部收齐回执后在主仓新建集成分支按顺序合入
git checkout -b integrate/wave-1 "$BASE"
git merge --no-ff feat/data-layer
git merge --no-ff feat/ui-layout
git merge --no-ff feat/real-tests

# 4. 合并后统一交由 wr-skeptic-audit 只读总审与 wr-real-qa 验收
# 5. 确认无误后清理临时工作树
git worktree remove ../wt-data
git worktree remove ../wt-ui
git worktree remove ../wt-test
```

### 路线 B Orca 多代理工作台并行

只在装了 Orca（`tools.orca` 为 `true` 或自动探测到）时走这条路线；没装就用路线 A，帮手遇到问题时停下来在回执里写明问题，由你转给协调会话裁决。

1. 在协调会话中先完成拆活和文件白名单切分，确保各帮手之间零文件重叠。
2. 通过 `orca` 为每项子任务分配独立子工作树并启动对应档位模型的帮手（每个帮手自带独立上下文，避免互相污染）。
3. 帮手遇阻塞时通过协调通道发问，由协调人统一裁决，帮手不擅自越界改白名单外的文件。
4. 帮手完成后发送固定三句话回执（做了什么、发现了什么、还剩什么 + 修改文件清单 + 真实验证输出）。
5. 等一整波帮手全部交付完毕，协调人一次性合入集成头，再统一触发一次只读总审与真路径全量验收，不搞每改十行来回拉扯审核。
