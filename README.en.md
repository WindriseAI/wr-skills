# wr-skills

[简体中文](README.md) | English

> A collection of Chinese-language AI Skills by Windrise AI. Everyday AI habits, packaged as Skills you can install and use right away.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)

Works with Claude Code, Codex, claude.ai and other agents that support Skills. The Skills and prompts are written in Chinese.

## Skills

| Skill | What it does |
| --- | --- |
| [wr-sunkit](docs/wr-sunkit/README.md) | Calorie counting from meal photos, best / middle / fallback plans from three different AIs, and an AI that argues against you |
| [wr-geo](docs/wr-geo/README.md) | SEO / GEO audit for a product site: measure the live site, write a byte-fixed contract, then verify with an independent checklist |

### wr-sunkit

![wr-sunkit](docs/wr-sunkit/images/hero.png)

Inspired by the everyday AI habits Justin Sun described in a long-form interview (photo-based calorie tracking, asking three AIs and taking the middle plan, keeping every record in Markdown). The prompts in this repo are our own; this project is not affiliated with him.

| Mode | Trigger | What you get |
| --- | --- | --- |
| 📷 Calorie photo | Send a meal photo | Per-item portion, calorie range and macros; a daily summary at night |
| ⚖️ Three AIs, three plans | Describe a decision | A copy-ready prompt for three different AIs, then a judge that compares their answers and builds a 30-day middle plan |
| 🛡️ AI as your opponent | "Argue against me" | Five strongest objections, three hard questions, and no backing down unless you bring new facts |

Calorie numbers are estimates (often off by 20–30%). Not medical advice.

## Install

```bash
npx -y skills add Hestamen/wr-skills -g --all
```

Claude Code plugin marketplace:

```bash
claude plugin marketplace add Hestamen/wr-skills
claude plugin install wr-sunkit@wr-skills
```

claude.ai: download the Skill's zip from [Releases](https://github.com/Hestamen/wr-skills/releases) and upload it on the Skills settings page.

## License

[CC BY-NC 4.0](LICENSE). Free to use, share and adapt with attribution to Windrise AI and a link to this repo. **No commercial use**, including bundling into paid courses, bootcamps, paid communities or paid resource packs. For a commercial license, open an [issue](https://github.com/Hestamen/wr-skills/issues).
