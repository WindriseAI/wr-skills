# wr-skills

[简体中文](README.md) | English

> A collection of Chinese-language AI Skills and deterministic engineering hooks by Windrise AI. Battle-tested habits for daily thinking and shipping software with AI, packaged to install individually or as a full suite.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-10-2563EB.svg?style=flat-square)](#skills)
[![Hooks](https://img.shields.io/badge/hooks-4-0F766E.svg?style=flat-square)](#universal-hooks)

Works with Claude Code, Codex, Cursor, Antigravity, claude.ai, and other agents that support Skills. Every Skill also includes a standalone prompt checklist in Chinese for web chats that do not support Skills.

## Skills

### Windrise Software Engineering Suite (8 Standalone Skills)

| Skill | What it does |
| --- | --- |
| [wr-ask-first](docs/wr-ask-first/README.md) | Challenge flaws first, then drill down into `docs/SPEC.md`: compare 10 existing open-source options, surface leaks/contradictions/second-order risks, and resolve unknowns via a decision tree |
| [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | Eliminate reverse coupling with MIT Axiomatic Design: extract independent FRs and DPs, check the FR x DP matrix for diagonal or lower-triangular structure, extract a single source of truth and reorder before parallel splits |
| [wr-split-work](docs/wr-split-work/README.md) | Multi-agent parallel workflow: coordinator plans and verifies without coding, isolated `git worktree` per task with exclusive file lists, four-tier model routing, bundle slimming, and Orca + Git guides |
| [wr-ux-craft](docs/wr-ux-craft/README.md) | Keep complexity in code and make motion legible: 8 UX principles, 7 state-based motion checks, diagonal hover safe corridors with click-lock, elastic data scaling, and 2nd/3rd-order impact checks |
| [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | Three physically isolated review seats: no-source UX click-step audit, no-source plain-copy audit, and a fresh read-only veteran engineer diff audit |
| [wr-real-qa](docs/wr-real-qa/README.md) | Real-path QA and fake-test removal: changed-file-to-test mapping blocking `UNMAPPED` and `ZERO_RUN`, mutation probes for weak tests, `getBoundingClientRect` clipping/occlusion scans, and two-strike root-cause stop |
| [wr-plain-cn](docs/wr-plain-cn/README.md) | Plain, human-sounding Chinese writing: verify 5 physical details first, zero invented inner monologue, strict banned patterns, and a 22-item AI-fingerprint checklist |
| [wr-hook-forge](docs/wr-hook-forge/README.md) | Turn repeated mistakes into deterministic scripts: graduate zero-exception rules from docs to fast hooks, starting in `observe` mode before switching to `enforce` |

### Everyday & Growth Skills

| Skill | What it does |
| --- | --- |
| [wr-sunkit](docs/wr-sunkit/README.md) | Calorie counting from meal photos, best / middle / fallback plans from three different AIs, and an AI that argues against you |
| [wr-geo](docs/wr-geo/README.md) | SEO / GEO audit for a product site: measure the live site, write a byte-fixed contract, then verify with an independent checklist |

## Universal Hooks

Four zero-dependency Node.js standard-library scripts in `hooks/`, written to the Claude Code and Antigravity hook input/output specifications plus Git `pre-commit` support, with `observe` and `enforce` modes:

- `hooks/safety-redline-guard.mjs`: blocks credential access, unsafe deletions outside scratch/worktree paths, destructive git resets on main checkouts, and noisy desktop actions on quiet hosts (including unpacked batch tool arguments).
- `hooks/evidence-before-pass-gate.mjs`: tracks files actually read during a session and blocks marking `passes: true` in acceptance reports when coverage is unmapped, zero tests ran, or cited evidence was never read.
- `hooks/speak-before-act-hook.mjs`: prompts the agent to state its plan before calling tools on a new user turn, and optionally checks outgoing responses for raw hashes or boilerplate headers.
- `hooks/copy-and-privacy-lint.mjs`: pre-commit / CI scanner that dynamically checks for local username/path leaks plus banned copywriting patterns.

Configuration examples live in `examples/` (`wr.config.example.json`, `AGENTS.template.md`, `hooks.claude.json`, `hooks.agy.json`, `acceptance.example.json`). Verify all four hooks locally with the 17 offline dual-protocol unit tests via `node hooks/test-hooks.mjs`.

## Install

Install all Skills globally with one command:

```bash
npx -y skills add WindriseAI/wr-skills -g --all
```

Install a single Skill:

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first
```

Claude Code plugin marketplace:

```bash
claude plugin marketplace add WindriseAI/wr-skills
claude plugin install wr-engineering@wr-skills
claude plugin install wr-sunkit@wr-skills
```

Or simply tell your Agent:

> Please install all Skills from `github.com/WindriseAI/wr-skills` using `npx -y skills add WindriseAI/wr-skills -g --all`.

claude.ai: download the repository ZIP archive, extract it, zip the target `skills/<skill-name>` subfolder, and upload it on the Skills settings page (or paste `docs/<skill-name>/提示词清单.md` directly into chat).

## License

[CC BY-NC 4.0](LICENSE). Free to use, share and adapt with attribution to Windrise AI and a link to this repo. **No commercial use**, including bundling into paid courses, bootcamps, paid communities or paid resource packs. For a commercial license, open an [issue](https://github.com/WindriseAI/wr-skills/issues).
