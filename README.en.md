# wr-skills

[简体中文](README.md) | English

> A collection of Chinese-language AI Skills and deterministic engineering hooks by Windrise AI. Battle-tested habits for daily thinking and shipping software with AI, packaged to install individually or as a full suite.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC%20BY--NC%204.0-16A34A.svg?style=flat-square)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-10-2563EB.svg?style=flat-square)](#skills)
[![Hooks](https://img.shields.io/badge/hooks-4-0F766E.svg?style=flat-square)](#universal-hooks)

Works with Claude Code, Codex, Cursor, Antigravity, claude.ai, and other agents that support Skills. Every Skill also includes a standalone prompt checklist in Chinese for web chats that do not support Skills.

## Four Core Recommended Skills

Start with these four core engineering skills, ordered from pre-build planning to independent review.

| Skill | Plain-language summary |
| --- | --- |
| [wr-ask-first](docs/wr-ask-first/README.md) | Challenge requirement flaws and compare existing open-source options (5 by default) before coding, surface leaks/contradictions/second-order risks, and resolve unknowns via a decision tree into `docs/SPEC.md` |
| [wr-10x-goal](docs/wr-10x-goal/README.md) | Set 10x speed (0.1x parallel wall-clock time) and 10x size-reduction targets after clarifying context, compare 10 existing solutions before building, and strictly block reward hacking (dropped features, hardcoded fakes, skipped slow paths, or weakened assertions) |
| [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | Extract independent FRs and DPs into a design matrix, eliminate reverse coupling via reordering and a single source of truth until lower-triangular before parallel splits |
| [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | Three physically isolated read-only reviews after merge: a no-source user audits click steps, a no-source reader audits plain copy, and a fresh engineer audits the diff against 8 checks |

Install all four core skills at once:

```bash
npx -y skills add WindriseAI/wr-skills -g --skill wr-ask-first wr-10x-goal wr-axiomatic-design wr-skeptic-audit
```

## Skills

### Windrise Software Engineering Suite (8 Battle-Tested Skills Ordered Pre-Build to UI Polish)

Ordered strictly by workflow stage: Pre-build (`wr-ask-first`, `wr-10x-goal`, `wr-axiomatic-design`) → Parallel Build & Guards (`wr-split-work`, `wr-hook-forge`) → QA & Blind Audit (`wr-real-qa`, `wr-skeptic-audit`) → UI Polish (`wr-ux-craft`).

| Stage | Skill | What it does |
| --- | --- | --- |
| Pre-build | [wr-ask-first](docs/wr-ask-first/README.md) | Challenge requirement flaws and compare existing open-source options (5 by default) before coding, expose leak/context/contradiction/second-order risks, and lock answers in `docs/SPEC.md` |
| Pre-build | [wr-10x-goal](docs/wr-10x-goal/README.md) | Set 10x speed and 10x size-reduction targets after clarifying context, compare 10 existing solutions before building, and lock down anti-cheat bans against dropped features, fake returns, skipped slow paths, or weakened test assertions |
| Pre-build | [wr-axiomatic-design](docs/wr-axiomatic-design/README.md) | Extract independent FRs and DPs into a design matrix, eliminate reverse coupling via reordering and a single source of truth until lower-triangular before parallel splits |
| Parallel Build & Guards | [wr-split-work](docs/wr-split-work/README.md) | Split parallel work across isolated `git worktree` workspaces with exclusive file lists, coordinator-only planning and verification, model routing by subscription and reasoning tier, and upfront bundle slimming |
| Parallel Build & Guards | [wr-hook-forge](docs/wr-hook-forge/README.md) | Turn repeated mistakes into zero-dependency Node.js guard hooks with Claude Code and Antigravity protocol support, starting in `observe` mode before switching to `enforce` |
| QA & Blind Audit | [wr-real-qa](docs/wr-real-qa/README.md) | Verify real execution paths with changed-file-to-test mapping (blocking `UNMAPPED` and `ZERO_RUN`), mutation probes for weak tests, `getBoundingClientRect` clipping/occlusion scans, and two-strike stops |
| QA & Blind Audit | [wr-skeptic-audit](docs/wr-skeptic-audit/README.md) | Run three physically isolated read-only reviews after merge: no-source interaction click-step audit, no-source plain-copy audit, and fresh veteran engineer diff audit |
| UI Polish | [wr-ux-craft](docs/wr-ux-craft/README.md) | Polish UI with 8 zero-effort UX rules, 7 state-driven motion checks, diagonal hover safe corridors with click-lock, elastic data scaling, and 2nd/3rd-order impact checks |

### Everyday & Growth Skills

| Skill | What it does |
| --- | --- |
| [wr-sunkit](docs/wr-sunkit/README.md) | Calorie counting from meal photos, side-by-side plans from three different AIs, and an AI that argues against your assumptions |
| [wr-geo](docs/wr-geo/README.md) | SEO and GEO audit for product sites: measure live crawler and no-JS content first, write a byte-fixed contract, and verify with an independent check script |

## First-Run Setup

Every Skill starts with a "step 0": it looks for `wr.config.json` (current directory upward, then `~/wr.config.json`). If there is no `"onboarded": true`, it asks eight questions in one message (machine and test environment, OS and tools, models and budget, collaboration and publishing, reply language, rigor, safety level, project type), each with a default. Reply "OK" to accept all defaults. Answers are written back to `wr.config.json` and read by both Skills and hooks. Field reference (Chinese): [examples/README.md](examples/README.md).

## Universal Hooks

Four zero-dependency Node.js standard-library scripts in `hooks/`, written to the Claude Code and Antigravity hook input/output specifications plus Git `pre-commit` support. The Skills work in Claude Code, Codex, Cursor, Antigravity and claude.ai; the hooks currently only attach to Claude Code and Antigravity.

**Hooks only log by default.** Without a config file, or before `"onboarded": true` is set, all four hooks just append hits to `.wr-hook-observe.jsonl` (add it to `.gitignore`), credentials included. After setup, the safety guard uses the `standard` profile: credential access and recursive force-deletes are always blocked, `git reset --hard` is only logged, and everything else follows `hookMode` (default `observe`).

- `hooks/safety-redline-guard.mjs`: blocks credential access; allows recursive force-deletes only inside temp directories or build-output directories inside the project (matched by whole path segment); flags destructive git resets on main checkouts. Three environment-specific rules are off by default: quiet host (`environment.quietMainMachine`), Orca long inline arguments (only when Orca is detected and the shell is PowerShell), and bare shared temp dirs on remote hosts (only when `environment.remoteHost` is set). Each rule can be set to `off` / `observe` / `enforce` under `safetyGuard.rules`.
- `hooks/evidence-before-pass-gate.mjs`: tracks files actually read during a session and blocks marking `passes: true` in `acceptance.json` when coverage is unmapped, zero tests ran, or cited evidence was never read.
- `hooks/speak-before-act-hook.mjs`: prompts the agent to state its plan before calling tools on a new user turn (supports the Claude Code transcript format). The Stop check only runs patterns you list in `speakBeforeAct.stopPatterns` (none by default) and respects `stop_hook_active` to avoid loops.
- `hooks/copy-and-privacy-lint.mjs`: pre-commit / CI scanner for local username/path leaks and common secret formats, plus your own banned words and term replacements. No built-in style word lists.

Configuration examples live in `examples/` (`wr.config.example.json`, `AGENTS.template.md`, `hooks.claude.json`, `hooks.agy.json`, `acceptance.example.json`). Run the offline unit tests with `node hooks/test-hooks.mjs`. They have only been run on Windows 11; macOS and Linux are untested.

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
claude plugin install wr-ask-first@wr-skills
claude plugin install wr-10x-goal@wr-skills
claude plugin install wr-sunkit@wr-skills
```

Or simply tell your Agent:

> Please install all Skills from `github.com/WindriseAI/wr-skills` using `npx -y skills add WindriseAI/wr-skills -g --all`.

claude.ai: download the repository ZIP archive, extract it, zip the target `skills/<skill-name>` subfolder, and upload it on the Skills settings page (or paste `docs/<skill-name>/提示词清单.md` directly into chat).

## License

[CC BY-NC 4.0](LICENSE). Free to use, share and adapt with attribution to Windrise AI and a link to this repo. **No commercial use**, including bundling into paid courses, bootcamps, paid communities or paid resource packs. For a commercial license, open an [issue](https://github.com/WindriseAI/wr-skills/issues).
