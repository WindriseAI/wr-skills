<!-- wr-onboarding:start -->
先找配置文件 `wr.config.json`：从当前目录逐级往上找，再看用户目录（`~/wr.config.json`）；两份都有时，项目里的字段覆盖用户目录的。

- 读到 `"onboarded": true`，就按里面的字段办事，不再提问，直接往下走。配置里没写的字段按下面各题的默认值理解。
- 没有这个文件，或者没有 `"onboarded": true`，先把下面 8 题一次发给用户，每题括号里是默认值，并说明「回『好』就全按默认」。用户回「好」或只改了其中几题，其余一律按默认。
- 收到答复后，把答案连同 `"onboarded": true` 写进项目根目录的 `wr.config.json`（用户要求全局生效就写 `~/wr.config.json`），已有字段保留不动，写完告诉用户写在哪、怎么改。字段全集和说明见 github.com/WindriseAI/wr-skills 的 `examples/README.md`。
- 用户说「这次先不对齐」，就按默认值办事，不写文件，下次启用时再问。
- 钩子在 `onboarded` 变成 `true` 之前，除了碰凭据和递归强删照样直接拦，其余规则只记录不拦截。

1. 机器与测试环境：只有这一台电脑，还是另有测试机、容器或 CI？跑测试时能不能占用这台电脑的键盘、鼠标和浏览器？（只有一台；耗时长的测试先说预计多久，同意后在本机跑；可以占用）写入 `environment.machine`（`single` / `has-runner`）、`environment.heavyTestsOnMainMachine`（`allow` / `ask` / `deny`）、`environment.quietMainMachine`（`false`）、`environment.remoteHost`（测试机的 ssh 主机名，没有就留空）。
2. 系统与工具：用什么系统和终端？在哪个 AI 工具里用？有没有装 Orca 多代理工作台？（系统、终端和宿主自动探测；Orca 自动探测）写入 `environment.os`、`environment.shell`、`environment.host`、`tools.orca`。
3. 模型与额度：手上有哪几档模型？有没有第二家厂商的模型可以交叉复核？额度紧、一般还是宽松？（只用当前这一个模型；没有第二家；一般）写入 `modelTiers` 四档（全部留空就是单模型模式）、`review.crossVendor`（`false`）、`budget.mode`（`tight` / `normal` / `generous`）。
4. 协作与发布：一个人做还是团队？要不要让 AI 开多个帮手并行？默认分支叫什么？推送、发版和对外提交由谁确认？（一个人；要并行时先问；分支自动探测；推送和发版必须用户确认）写入 `workflow.team`（`solo` / `team`）、`workflow.parallel`（`off` / `ask` / `on`）、`workflow.defaultBranch`、`workflow.branchPrefix`、`workflow.publishConfirm`（`always` / `push-and-release` / `never`）。
5. 回复语言：回复用什么语言？（跟随用户提问的语言）写入 `language.output`（`auto` / `zh-CN` / `en`）。
6. 做事强度：新功能要不要先问清并写规格？动手前搜不搜现成开源方案，搜几个？要不要定十倍目标？（大活才先问并写 `docs/SPEC.md`；搜 5 个；十倍目标只在用户提到性能或体积时提议）写入 `rigor.askFirst`（`off` / `big-only` / `always`）、`rigor.specPath`、`rigor.openSourceSurveyCount`、`rigor.tenX`（`off` / `ask`）。
7. 安全尺度：安全红线用哪一档？有没有额外不许读的目录？（标准档：碰凭据和递归强删直接拦，git 硬重置只提醒；没有额外目录；删除走回收站）写入 `hookMode`（`observe` 起步）、`safetyGuard.profile`（`relaxed` / `standard` / `strict`）、`safetyGuard.extraProtectedPatterns`、`safetyGuard.trashCommand`。
8. 项目类型：这个项目是网页或桌面界面、命令行或库、后端服务，还是官网营销站？有没有线上用户？官网是否允许 AI 训练爬虫？（自动探测类型；没有线上用户；允许搜索爬虫，训练爬虫由用户定）写入 `project.kind`（`web-ui` / `cli-lib` / `backend` / `marketing-site` / `other`）、`project.hasOnlineUsers`、`geo.languages`、`geo.region`、`geo.crawlerPolicy`（`allow-all` / `block-training` / `custom`）。
<!-- wr-onboarding:end -->
