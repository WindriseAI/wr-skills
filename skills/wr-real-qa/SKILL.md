---
name: wr-real-qa
description: 真路径验收与破测试排雷。要求所有验收基于本轮刚跑出的新鲜命令证据；建立改动文件到测试的映射，硬禁 UNMAPPED 与 ZERO_RUN；用破测试突变探针抓出假绿水测试；在浏览器执行 getBoundingClientRect 像素裁切与遮挡扫描；同一失败连改两次未过立即熔断停手查根因。用于发版验收、修红测试、排查假绿测试与故障定位。
---

# wr-real-qa 真路径验收与破测试排雷

跑了一堆秒过的水测试，比没有测试更危险。本 Skill 用可验证的物理与逻辑探针，确保「绿灯」真的代表软件跑通了。

## 五条硬门禁

1. **没有本轮刚跑出的新鲜输出，绝不报完成。** 改完最后一行后必须重跑对应检查并完整读完退出码和日志；没测到的范围直写「未测」，不许说「应该没问题」。
2. **硬禁 `UNMAPPED`（改了没测）与 `ZERO_RUN`（跑了 0 条用例）。** 任何核心改动文件若没有映射到真实行为测试，或测试筛选条件写错导致实际执行用例数为 0，一律判不通过。
3. **默认 `passes: false`，逐项填实证据后才许改 `true`。** 配合 `hooks/evidence-before-pass-gate.mjs` 在磁盘级拦截空口报绿。
4. **连败两次立即熔断停手。** 同一道验证连改两版仍失败，立刻停止继续修补，把两次修改共同依赖的隐藏假设写出来，写最小复现脚本验证相反方向。
5. **重型测试与日常主力机分离。** 主机只跑秒级静态与单测；耗时长的全量端到端浏览器或真机测试，投递到独立测试机、容器或 CI 执行。

## 第一步 建立「改动文件 → 测试用例」覆盖映射

执行测试前，先由 `git diff --name-only` 列出本次改动的所有业务与配置源码，逐行填写映射表。

| 改动文件 | 对应行为测试路径与用例名 | 实际执行条数 | 状态 |
| --- | --- | --- | --- |

判定规则如下。
- 找不到行为测试的核心文件标记为 `UNMAPPED`，必须补齐测试，或由项目负责人明确填写豁免原因。
- 跑完后核对测试汇总里的通过与执行总数；凡执行数为 0 标记为 `ZERO_RUN`，严禁放行。

## 第二步 水测试清查与破测试突变探针

逐条排查现有测试文件，凡命中以下五类直接判不合格并重写。
1. **读源码搜词冒充测试**（用文件读取函数检查源码里有没有某个字符串，完全没跑程序）。
2. **吞掉断言异常或漏写 `await`**（异步断言没等待就结束了，永远报绿）。
3. **硬睡固定秒数**（靠盲等代替明确状态等待，在慢机器上频繁随机失败）。
4. **用强行点击绕过遮挡**（掩盖了真实按钮被别的层挡住点不到的界面事故）。
5. **全换假替身测自己**（把核心逻辑全替成假返回值，测的是替身剧本）。

**执行破测试突变探针（对核心业务测试必做）。**
1. 临时把被测业务的一个关键条件改反（例如把权限校验的 `>=` 改成 `<`，或注释掉写盘那一行）。
2. 重跑对应测试套件。
3. 如果测试依然绿灯，说明这条测试抓不住真实缺陷，立即重写断言。
4. 探针结束后立刻将业务源码原样还原，并用 `git diff` 核实源码零残留。
5. 清理水测试时保留对外契约、权限白名单、加密握手与旧数据迁移测试，绝不误删。

## 第三步 `getBoundingClientRect` 像素裁切与遮挡扫描

端到端验收时，在真实浏览器（覆盖桌面宽屏、手机窄屏、浅色、深色）里把每个主要按钮、开关、抽屉、链接点一遍，并注入几何扫描脚本抓肉眼容易漏掉的排版事故。

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

## 第四步 先核实真根因，连败两次立即熔断

修 Bug 或处理线上反馈时，按下面四步办。
1. **用户的猜测可能是错的。** 改代码前先独立复现，顺着调用链回溯到错误状态第一次产生的位置再修；严禁在下游随手加空值吞掉脏数据。
2. **连败两次停手反证。** 同一道检查连续修改两次仍未通过，立刻停手，写出前两次共同默认的前提，写一个 20 行以内的最小复现脚本验证相反前提。
3. **群反馈先只读查日志归批。** 收集对应时间段日志与版本号，按真实根因归并成批次（故障、操作卡点、环境差异、新需求），附证据和最小修法统一拍板后再改。
4. **修完同查上下游，复现脚本转回归测试。** 临时加的调试打印全部删净。
