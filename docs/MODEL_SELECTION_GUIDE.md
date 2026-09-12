# Guide: Subscription-Based Model Selection for Multi-Agent Collaboration MVP

## 1. Overview & Architectural Rationale

This project integrates three distinct AI developer environments:
1. **Codex CLI**: Executed via the `codex` command-line tool, backed by an OpenAI ChatGPT Plus / Pro subscription.
2. **Claude Code CLI**: Executed via the `claude` command-line tool, backed by an Anthropic Claude Pro subscription.
3. **Antigravity IDE**: Executed locally in the developer's Antigravity IDE workspace, backed by native Google Gemini & IDE-hosted model runtimes.

### Why Generic API Model Names Fail
In raw API integrations (e.g. OpenAI Platform API, Anthropic API), models use identifiers like `gpt-4o`, `o1-preview`, `claude-3-5-sonnet-20241022`, or `gemini-1.5-pro`. 

However, when interacting with **subscription-based CLI tools**:
- **Codex CLI with ChatGPT Account**: Explicitly returns an error (`400 invalid_request_error: The 'gpt-4o' model is not supported when using Codex with a ChatGPT account.`). It only permits the models provisioned in the user's active ChatGPT plan (such as `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, etc., as cached in `~/.codex/models_cache.json`).
- **Claude Code CLI with Claude Pro**: Resolves models using either canonical family aliases (`sonnet`, `opus`, `haiku`, `fable`) or versioned CLI identifiers (`claude-opus-4-8`, `claude-sonnet-4-6`). It rejects unsupported arbitrary slugs.
- **Antigravity IDE**: Provides native Google Gemini 3.x Flash/Pro models and IDE-hosted models configured inside the editor's execution environment.

---

## 2. Complete Model Matrix

### [1] Codex CLI (ChatGPT Subscription)
*Role*: Multi-Agent Planner & Engineering Strategist.

| Model ID (CLI Slug) | Display Name | Category | Characteristics & Use Cases |
|---|---|---|---|
| `gpt-6-astra` | **GPT-6 Astra** *(Default)* | Default (Recommended) | Flagship reasoning, top-tier coding, system architecture & complex refactoring. |
| `gpt-5.6-sol` | **GPT-5.6 Sol** | Default (Recommended) | High speed, deep reasoning, optimal for daily full-stack development. |
| `gpt-5.6-terra` | **GPT-5.6 Terra** | Default (Recommended) | Robust refactoring, large context window & repository maintenance. |
| `gpt-5.6-luna` | **GPT-5.6 Luna** | Default (Recommended) | Ultra-fast response, quick fixes, unit test authoring & scripts. |
| `gpt-5.5` | **GPT-5.5** | Default (Recommended) | Proven reasoning model for code review & stable workflows. |

**Reasoning Effort Settings**:
- `low`: Fastest turnaround, suitable for straightforward tasks.
- `medium`: Balanced thinking depth.
- `high`: Deepest chain of thought for difficult algorithmic problems.

---

### [2] Claude Code CLI (Claude Subscription)
*Role*: Adversarial Code Reviewer & Flaw Hunter.

| Model ID (CLI Slug) | Display Name | Group | Characteristics & Badge |
|---|---|---|---|
| `fable-5.1` *(or `fable`)* | **Fable 5.1** | Primary Models | Mythos-class tier `[Requires usage credits]` for hardest problems. |
| `opus` *(or `claude-opus-5`)* | **Opus 5** *(Default)* | Primary Models | Top-tier deep reasoning & exhaustive adversarial inspection. |
| `sonnet` *(or `claude-sonnet-5`)* | **Sonnet 5** | Primary Models | Balanced adversarial code reviewer & flaw hunter. |
| `haiku` *(or `claude-haiku-4-5`)* | **Haiku 4.5** | Primary Models | High-velocity quick code scanner & sanity checker. |
| `claude-fable-5` | **Fable 5** | More models (Extended) | First-generation Mythos-class engine `[Requires usage credits]`. |
| `claude-opus-4-8` | **Opus 4.8** | More models (Extended) | Advanced deep-inspection reviewer. |
| `claude-opus-4-7` | **Opus 4.7** | More models (Extended) | Robust deep-inspection reviewer. |
| `claude-opus-4-6` | **Opus 4.6** | More models (Extended) | High-precision structural reviewer. |
| `claude-sonnet-4-6` | **Sonnet 4.6** | More models (Extended) | Accurate adversarial code auditor. |

---

### [3] Antigravity IDE (Host / Executor Models)
*Role*: Orchestrator Host & Code Implementation Engine.

| Model ID | Display Name | Group | Characteristics & Attributes |
|---|---|---|---|
| `gemini-3.8-flash` | **Gemini 3.8 Flash** *(Default)* | Gemini Series | `High · Fast · Default` — Antigravity native host, orchestrator, and swift code executor. |
| `gemini-3.7-flash` | **Gemini 3.7 Flash** | Gemini Series | `Medium · Fast` — Balanced speed & reasoning executor. |
| `gemini-3.6-flash` | **Gemini 3.6 Flash** | Gemini Series | `Medium · Fast` — High-velocity implementation engine. |
| `gemini-3.1-pro` | **Gemini 3.1 Pro** | Gemini Series | `Low` — Lightweight execution model. |
| `claude-sonnet-4-6-thinking` | **Claude Sonnet 4.6 (Thinking)** | Antigravity IDE Models | `Thinking` — IDE-hosted Claude reasoning model. |
| `claude-opus-4-6-thinking` | **Claude Opus 4.6 (Thinking)** | Antigravity IDE Models | `Thinking` — IDE-hosted Claude deep reasoning model. |
| `gpt-oss-120b` | **GPT-OSS 120B** | Antigravity IDE Models | `Medium` — Open-weight high-parameter model hosted in IDE. |

---

## 3. How to Use & Select Models

### Method 1: Interactive Web Studio (`http://127.0.0.1:3000/`)
1. Open the **Model Moderation & Routing** panel on the left.
2. Select any model from the grouped dropdowns:
   - **Codex CLI**: `GPT-6 Astra`, `GPT-5.6 Sol`, `GPT-5.6 Terra`, `GPT-5.6 Luna`, `GPT-5.5`.
   - **Claude Code CLI**: Choose between Primary Models or More Models (Extended).
   - **Gemini / Host**: Choose between Gemini Series or IDE-hosted models.
3. The top status bar dynamically reflects the active model for each agent.
4. Click **Dispatch Multi-Agent Cycle** to execute the pipeline with the selected models.

### Method 2: Command Line Interface (CLI)
View the formatted table of all models:
```bash
npx tsx cli.ts --list-models
```

Run with specific verified model slugs:
```bash
# High-speed development team:
npm start -- --codex-model gpt-5.6-sol --claude-model sonnet --gemini-model gemini-3.8-flash

# Deep-inspection team:
npm start -- --codex-model gpt-6-astra --claude-model opus --gemini-model gemini-3.8-flash --reasoning-effort high
```

---

## 4. Verification and Safety
All model slugs have been validated against:
1. `~/.codex/models_cache.json` and `codex exec -m <slug>`
2. `/Users/tranhaibang/.local/share/claude/versions/2.1.199` binary and `claude -p --model <slug>`
3. The local Antigravity IDE model configuration
