---
name: wr-real-qa
description: 改动全覆盖真路径验收。要求所有验收基于本轮刚跑出的新鲜命令证据；建立改动文件到测试的映射，硬禁 UNMAPPED 与 ZERO_RUN；用破测试突变探针抓出假绿水测试；在浏览器执行 getBoundingClientRect 像素裁切与遮挡扫描；同一失败连改两次未过立即熔断停手查根因。用于发版验收、修红测试、排查假绿测试与故障定位。
---

# wr-real-qa 改动全覆盖真路径验收

跑了一堆秒过的水测试，比没有测试更危险。本 Skill 用可验证的物理与逻辑探针，确保「绿灯」真的代表软件跑通了。

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

本技能主要用到第 1 题（门禁 5 按单机和有测试机两种写法执行）、第 7 题和第 8 题（`project.kind` 不是界面类时跳过第三步像素扫描）。

## 五条硬门禁

1. **没有本轮刚跑出的新鲜输出，绝不报完成。** 改完最后一行后必须重跑对应检查并完整读完退出码和日志；没测到的范围直写「未测」，不许说「应该没问题」。
2. **硬禁 `UNMAPPED`（改了没测）与 `ZERO_RUN`（跑了 0 条用例）。** 任何核心改动文件若没有映射到真实行为测试，或测试筛选条件写错导致实际执行用例数为 0，一律判不通过。
3. **默认 `passes: false`，逐项填实证据后才许改 `true`。** 配合 `hooks/evidence-before-pass-gate.mjs` 在磁盘级拦截空口报绿。
4. **连败两次立即熔断停手。** 同一道验证连改两版仍失败，立刻停止继续修补，把两次修改共同依赖的隐藏假设写出来，写最小复现脚本验证相反方向。
5. **耗时长的重型测试先讲清占用再跑。** 按配置 `environment.machine` 分两种写法执行。
   - **只有一台电脑（`single`，默认）**：秒级静态检查和单测直接跑；全量端到端浏览器或真机测试，先告诉用户预计耗时、会不会弹浏览器占用键鼠，`environment.heavyTestsOnMainMachine` 为 `allow` 时直接跑，为 `ask`（默认）时等用户点头再跑，为 `deny` 时只列出要跑的命令交给用户。能无头就无头跑。
   - **另有测试机、容器或 CI（`has-runner`）**：本机只跑秒级静态与单测，耗时长的全量端到端测试投递到那边执行，取回日志和退出码作为证据。

## 第一步 建立「改动文件 → 测试用例」覆盖映射

执行测试前，先由 `git diff --name-only` 列出本次改动的所有业务与配置源码，逐行填写映射表。

| 改动文件 | 对应行为测试路径与用例名 | 实际执行条数 | 状态 |
| --- | --- | --- | --- |

判定规则如下。
- 找不到行为测试的核心文件标记为 `UNMAPPED`，必须补齐测试，或经用户本人确认后填写豁免原因（AI 不得自己替用户填）。
- 跑完后核对测试汇总里的通过与执行总数；凡执行数为 0 标记为 `ZERO_RUN`，严禁放行。

## 第二步 水测试清查与破测试突变探针

逐条排查现有测试文件，凡命中以下五类直接判不合格并重写。
1. **读源码搜词冒充测试**（用文件读取函数检查源码里有没有某个字符串，完全没跑程序）。
2. **吞掉断言异常或漏写 `await`**（异步断言没等待就结束了，永远报绿）。
3. **硬睡固定秒数**（靠盲等代替明确状态等待，在慢机器上频繁随机失败）。
4. **用强行点击绕过遮挡**（掩盖了真实按钮被别的层挡住点不到的界面事故）。
5. **全换假替身测自己**（把核心逻辑全替成假返回值，测的是替身剧本）。

**执行破测试突变探针。** 默认只对用户点名的关键模块（例如权限、计费、加密、数据迁移）做；用户要求全量或额度宽松（`budget.mode` 为 `generous`）时再扩大到全部核心测试。
1. 先确认工作区干净（`git status` 没有未提交改动），有未提交改动时先在临时分支或独立 `git worktree` 里做探针，免得还原时冲掉用户的改动。然后临时把被测业务的一个关键条件改反（例如把权限校验的 `>=` 改成 `<`，或注释掉写盘那一行）。
2. 重跑对应测试套件。
3. 如果测试依然绿灯，说明这条测试抓不住真实缺陷，立即重写断言。
4. 探针结束后立刻将业务源码原样还原，并用 `git diff` 核实源码零残留。
5. 清理水测试时保留对外契约、权限白名单、加密握手与旧数据迁移测试，绝不误删。

## 第三步 `getBoundingClientRect` 像素裁切与遮挡扫描

只适用于有界面的项目（`project.kind` 为 `web-ui`，或用户点名要查界面）；命令行工具、库和后端服务跳过这一步。

端到端验收时，在真实浏览器（覆盖桌面宽屏、手机窄屏、浅色、深色）里把每个主要按钮、开关、抽屉、链接点一遍，并注入几何扫描脚本抓肉眼容易漏掉的排版事故。只有一台电脑时按门禁 5 先讲清耗时，优先用无头浏览器，四种组合里先跑用户最常用的那一种，其余组合征得同意再补。

```javascript
(() => {
  const issues = [];
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    issues.push({ type: 'horizontal-overflow', diff: document.documentElement.scrollWidth - window.innerWidth });
  }
  for (const el of document.querySelectorAll('a, button, h1, h2, h3, p, span, label, input')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    // 1. 检查内容被 overflow:hidden 裁切
    if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 2) {
      issues.push({ type: 'clip-x', tag: el.tagName, text: (el.textContent || '').trim().slice(0, 24), overflow: el.scrollWidth - el.clientWidth });
    }
    if ((style.overflowY === 'hidden' || style.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 2) {
      issues.push({ type: 'clip-y', tag: el.tagName, text: (el.textContent || '').trim().slice(0, 24), overflow: el.scrollHeight - el.clientHeight });
    }
    // 2. 检查可点击元素中心点是否被别的层遮挡
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && rect.top >= 0 && rect.bottom <= window.innerHeight) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
        issues.push({ type: 'occluded', tag: el.tagName, text: (el.textContent || '').trim().slice(0, 24), blocker: topEl.className || topEl.tagName });
      }
    }
  }
  return issues;
})();
```

任何非空 `issues` 必须定位根因修复（如字号自引用缩水、叠层越界、缺自适应换行）后再复测归零。

## 第四步 先核实真根因且连败两次立即熔断

修 Bug 或处理线上反馈时，按下面四步办。
1. **先独立复现再决定是否采纳用户对原因的判断。** 改代码前先独立复现，顺着调用链回溯到错误状态第一次产生的位置再修；严禁在下游随手加空值吞掉脏数据。
2. **连败两次停手反证。** 同一道检查连续修改两次仍未通过，立刻停手，写出前两次共同默认的前提，写一个 20 行以内的最小复现脚本验证相反前提。
3. **`project.hasOnlineUsers` 为 `true`（有线上用户）时，群反馈先只读查日志归批。** 没有线上用户的项目跳过这一条。 收集对应时间段日志与版本号，按真实根因归并成批次（故障、操作卡点、环境差异、新需求），附证据和最小修法统一拍板后再改。
4. **修完同查上下游，复现脚本转回归测试。** 临时加的调试打印全部删净。
