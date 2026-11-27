---
name: wr-geo
description: 官网上线前后的搜索引擎与 AI 收录体检。先实测线上（各家爬虫能否访问、不跑 JS 时页面里有没有真内容、robots / sitemap / canonical / 结构化数据），再把要改的东西写成一份逐字固定的契约，改完由另一份独立检查验收。用户说「做一下 SEO」「GEO」「让 AI 搜得到我们」「为什么 ChatGPT 不提我们的产品」「官网上线前检查」时使用。
---

# wr-geo 官网搜索引擎与 AI 收录体检

大部分 SEO / GEO 建议其实是同一打老办法。这个 Skill 只做能核实的那部分，并且按「先查、再定、后改、另验」的顺序做，避免把站改坏。

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

本技能主要用到第 2 题（终端决定命令写法）、第 4 题（`workflow.publishConfirm` 决定上线前停不停）和第 8 题（`geo.languages`、`geo.region`、`geo.crawlerPolicy` 决定契约里的语言、地区和爬虫立场）。

## 四条铁律

1. **数字只来自工具或你抓到的页面，不来自记忆。** 核不了就写「没核」。永远不编搜索量。
2. **先查不改。** 第一步只读线上，逐条给「通过 / 不通过」和证据（那一行、那个状态码）。
3. **碰 robots.txt、canonical、跳转、noindex 的改动，先给人看差异，点头再发。永远不删页面。** 这一条不受 `workflow.publishConfirm` 影响；其余改动的发布按 `workflow.publishConfirm` 办：`always` 和 `push-and-release`（默认）都要等人确认再推送上线，`never` 时可以直接发，但发完要把改了什么列给人看。
4. **没有真实数据就不加评分星级、FAQ 和 HowTo 标记**（没有真实评价就不该有星；页面上没有真实问答和分步教程就不加后两种）。有真实数据的站，在契约里逐项写明加哪些。

## 第一步 实测线上（只读）

对首页和每个主要页面逐项检查。

- **爬虫进得来吗**，用各家标识请求，状态码必须是 200。
  `curl -s -o /dev/null -w "%{http_code}" -A "OAI-SearchBot/1.0" https://你的站/`
  Windows PowerShell 里 `curl` 是别的命令的别名，要写成 `curl.exe -s -o NUL -w "%{http_code}" -A "OAI-SearchBot/1.0" https://你的站/`。
  至少测 `OAI-SearchBot`、`Claude-SearchBot`、`PerplexityBot`、`bingbot`、`Googlebot`，面向中文用户再加 `Baiduspider`。实时回答靠的是这些「搜索类」爬虫；`GPTBot`、`ClaudeBot`、`Google-Extended` 是训练用的，拦不拦按 `geo.crawlerPolicy`（首次对齐第 8 题），别和搜索类混为一谈。
- **不跑 JS 时有没有真内容**，`node scripts/render.mjs` 会同时抓「原始 HTML 的可见文字」和「浏览器跑完 JS 后的可见文字」并对比。原始 HTML 里没有标题和正文，等于给不跑 JS 的爬虫一张白纸；原始 HTML 是另一种语言或另一套价格，比白纸更糟。**每个可收录页都要测，不要只测首页。**
- **重复地址**，`http://` 是否跳 `https://`、裸域名是否跳 `www`（或反过来）、`/page` 与 `/page.html` 与 `/page/` 是否只有一个返回 200。
- **基础标签**，title、description、canonical、Open Graph、sitemap、结构化数据有没有。

这一步只产出一张「检查项 × 通过/不通过 × 证据」的表，先不改任何文件。

## 第二步 写契约

把要落地的东西写成一份文件（模板见 `references/contract-template.md`），**标识符逐字固定**，包括域名、每个可收录页的规范地址、产品名、价格、邮箱、多语言互指关系。文案（title / description）给底稿，只有与页面真实内容不符时才允许改，改了要列「原文 → 改后 → 为什么」。

契约里同时写清**不许做的事**，包括不许改版式、不许删页面、不许出现哪些过期说法。

## 第三步 修

从最小的改起。每条改动写明改哪个文件、怎么改、用什么命令验证。多语言站点的静态产物必须就是目标语言，不能靠浏览器里再翻译；内容只能有一个来源，不许静态一份、脚本里再抄一份。

## 第四步 另一份检查来验收

实现的人自己写的自检只算自检。验收用 `scripts/seo-check.mjs` 加一份**实现者没参与写的**配置去跑构建产物；实现者是 AI 的话，这份配置和判据不要给它看。通过项都要对应到当前提交。

## 第五步 只有人能做的事

列给站长，按顺序完成 Google Search Console、Bing Webmaster Tools（开 IndexNow）、`geo.region` 为 `cn` 或面向中文用户时加百度搜索资源平台；软件目录和发布平台（名字、一句话介绍、logo 全部一致）；有注册流程的可以加一问「从哪知道我们的」（可选）。

## 第六步 等基础打完后补充内容（可选，站长要做增长时才做）

下面的数量是建议值，按站点规模和额度增减。

- 起草一批真实买家会问的问题（建议 20 个左右），**猜的要标出来**，让站长换成真的。每个问题在各家 AI 上至少问两次、不登录，记下谁被点名、引用了哪些网址。
- 提几个「决策页」（建议 3 到 5 个，X 对比 Y、X 的替代品、某类人最适合的 X、X 的价格）。每个先搜一遍，写清现在前十名是什么类型的页面、我们这页多出来的一样东西是什么。**站长选定之前一页都不写。**
- 写一份带日期的事实单（价格、套餐、平台），以后各家 AI 说错了，就顺着它引用的网页去改源头。

## 脚本

- `scripts/seo-check.mjs <配置.json> <产物目录>`，按配置逐页检查 title、description、canonical、Open Graph、hreflang 对称、结构化数据（含禁用项）、robots、sitemap、禁用说法。配置格式见 `references/config-example.json`。退出码非 0 表示有不通过。
- `scripts/render.mjs <输出目录> <名字>=<网址>@<宽>x<高> …`，用本机的 Edge 或 Chrome 无头渲染，输出截图、渲染后的可见文字和横向溢出像素。不需要安装任何依赖。

**前置条件**：两个脚本都要 Node.js；`render.mjs` 要 Node 22 或更新（用到内置 WebSocket），还要本机装有 Edge 或 Chrome。开工前先跑 `node -v` 确认版本；没有浏览器的服务器上跳过渲染对比，改用「不跑 JS 抓原始 HTML」那半项，并在报告里写明「渲染对比未做」。

**站点语言**：示例配置 `references/config-example.json` 是「英文主站」的写法。按 `geo.languages` 和 `geo.region` 改：中文主站把 `language.htmlLang` 改成 `zh-CN`，`titleCjk` 改成 `require`，去掉 `descriptionCjk` 和 `rawHtmlNoCjk`，description 长度区间改成中文字数（例如 `[50, 110]`）；只有一种语言时删掉 `hreflang`。完整的中文主站写法见 `references/config-example-zh.json`。
