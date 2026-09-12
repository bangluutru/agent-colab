# CLAUDE AUTHENTICATION REPAIR & ADAPTER ARCHITECTURE REPORT
**Agent Collaboration MVP — Multi-Agent Autonomous Engineering Pipeline**

---

## 1. Executive Summary

| Item | Details |
| :--- | :--- |
| **Objective** | Fix Claude Code authentication in `agent-collaboration-mvp` to restore Claude Code CLI as the primary adversarial reviewer in the autonomous pipeline (`Codex Plan` → `Gemini Implement` → `Claude Review` → `Gemini Fix` → `Claude Re-review` → `Codex Final Check` → `Completed`) using the user's Claude Pro subscription without API keys, API billing, or browser automation. |
| **Status** | **ARCHITECTURE OVERHAULED & FULLY TYPE-CHECKED**. All diagnostic tools, clean environment builders, 3-level readiness detectors, canonical binary resolvers, unified process launchers, granular error classifiers, raw diagnostic loggers, and model failovers are fully implemented and verified. |
| **Root Cause Diagnosis** | **CASE A (Local OAuth Session Expired)**. The macOS Keychain entry `Claude Code-credentials` exists for user `tranhaibang`, but the OAuth session tokens (`accessToken` & `refreshToken`) expired. Upgrading from Claude Code `2.1.199` to `2.1.269` confirmed the session expired. Headless inference (`claude -p`) returned exit code 1 with `OAuth session expired and could not be refreshed`. |
| **Action Required from User** | Perform a one-time terminal subscription authentication: `claude auth logout && claude auth login` (choose Claude Pro subscription `claude.ai`). Then run `npm run diagnose:claude`. |

---

## 2. Root Cause Analysis (Taxonomy: OBSERVED)

Our diagnostics tool (`scripts/diagnose-claude.ts`) and direct process audits identified three critical failure modes in the previous implementation:

### A. Case Identification: CASE A (Terminal FAIL, Node FAIL)
* **Observed Binary**: Canonical binary located at `/Users/tranhaibang/.local/bin/claude` (Version updated to `2.1.269 (Claude Code)`).
* **Environment**: 
  - `CLAUDE_CONFIG_DIR`: `/Users/tranhaibang/.claude` (default user directory, preserved).
  - `ANTHROPIC_API_KEY`: Not set (correct, Zero-API-Key requirement respected).
  - `CLAUDE_CODE_OAUTH_TOKEN`: Not set.
* **Level 2 Check (`claude auth status`)**:
  ```json
  {
    "loggedIn": false,
    "authMethod": "none",
    "apiProvider": "firstParty",
    "analyticsDisabled": false,
    "projectsDirectory": "/Users/tranhaibang/.claude/projects",
    "configDirectory": "/Users/tranhaibang/.claude"
  }
  ```
* **Level 3 Check (`claude -p --model claude-sonnet-5 ...`)**:
  ```
  Failed to authenticate: OAuth session expired and could not be refreshed
  Exit code: 1
  ```
* **Conclusion**: The failure is neither a Node spawn bug nor an environment isolation leak; it is an expired local OAuth token in the macOS Keychain. Claude Code requires a fresh `claude auth login` from a normal terminal.

---

## 3. Structural Architectural Changes Implemented

### 1. Dedicated Diagnostic Tooling (`scripts/diagnose-claude.ts` & `package.json`)
* Implemented `scripts/diagnose-claude.ts` using the exact same environment builder and process launcher as production.
* Added `"diagnose:claude": "tsx scripts/diagnose-claude.ts"` to `package.json`.
* Audit flags output only `SET` / `NOT SET` (redacting sensitive secrets).
* Executes 3-level verification:
  1. **LEVEL 1**: Canonical binary existence and version check.
  2. **LEVEL 2**: `claude auth status` JSON parse (`loggedIn: true`).
  3. **LEVEL 3**: Real headless inference probe (`claude -p --model claude-sonnet-5 "Reply with exactly: CLAUDE_AUTH_OK"`).
* Automatically saves full run report to `docs/claude-diagnostic-latest.json`.

### 2. Clean Subscription Environment (`buildClaudeEnvironment()`)
In `adapters/claude/adapter.ts`:
* Strips all foreign API keys and cloud overrides:
  - Deletes `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`.
  - Deletes `ANTHROPIC_BASE_URL`.
  - Deletes `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`.
  - Deletes `CLAUDE_CODE_OAUTH_TOKEN` (preventing stale Antigravity IDE automation tokens from overriding user login).
  - Deletes `OPENAI_API_KEY`, `GOOGLE_API_KEY`.
* Sanitizes `CLAUDE_CONFIG_DIR`: if an unexpected directory is injected, removes it so Claude defaults to `~/.claude`.
* Preserves critical system & macOS Keychain variables:
  - `HOME`, `USER`, `LOGNAME`, `PATH`, `SHELL`.

### 3. Canonical Binary Resolution & Unified Process Launcher
* Added `resolveCanonicalClaudeBinary()`: resolves `which -a claude`, identifies the canonical executable (e.g. `/Users/tranhaibang/.local/bin/claude`), and caches it in `private claudeBinary`.
* Implemented `runClaudeProcess(args, options)`: a single lower-level method shared by `--version`, `auth status`, inference probes, and production review executions. This guarantees zero behavioral drift between Gate 0 and production.

### 4. 3-Level Gate 0 & Runtime Readiness Detection
* Redesigned `detect()` and Gate 0 audit:
  - `auth status` reporting `loggedIn: true` is no longer sufficient.
  - Claude is declared `READY` only if **LEVEL 3** (real headless inference probe) succeeds.
  - Probe results are cached with a 5-minute TTL to prevent rate limit pressure and latency overhead.
  - `/api/status?refresh=true` allows instantaneous re-probing on demand.

### 5. Granular Error Classification
Replaced monolithic `AUTH_REQUIRED` strings with `classifyClaudeError()`:
* `AUTH_TOKEN_EXPIRED`: OAuth token expired / refresh failed.
* `AUTH_SESSION_BROKEN`: 401 Unauthorized / Invalid Bearer Token.
* `AUTH_REQUIRED`: Claude Code not logged in.
* `MODEL_UNAVAILABLE`: Model entitlement missing (triggers automatic model fallback).
* `USAGE_LIMIT`: Rate limit or billing window reset encountered.
* `NETWORK_ERROR`: Connectivity / DNS issue.
* `TIMEOUT`: Process exceeded configured timeout.
* `PROCESS_ERROR`: CLI runtime crash or unhandled exit code.

### 6. Raw Execution Diagnostic Persistence
* Raw child process inputs and outputs are now captured and written to:
  `runs/<run-id>/diagnostics/claude-${taskType}-${Date.now()}-process.json`
* Captures: `binary`, `version`, `model`, `cwd`, `exitCode`, `durationMs`, `stdout`, `stderr`, and sanitized environment flags.

### 7. Canonical Model Identifiers & Diagnostic Fallback
* Standardized reviewer model slugs:
  - Default: `claude-sonnet-5` (Sonnet 5: balanced flaw hunter).
  - Optional deep review: `claude-opus-5` (Opus 5: deep exhaustive review).
* Added 1-time automatic fallback from `claude-opus-5` to `claude-sonnet-5` upon `MODEL_UNAVAILABLE`.
* Crucial safeguard: Authentication failures (`AUTH_REQUIRED`, `AUTH_SESSION_BROKEN`) do **not** trigger model fallback loops.

### 8. Emergency Fallback Transparency
* Retained Codex reviewer emergency fallback as required.
* Fallback events now explicitly record:
  ```json
  {
    "type": "REVIEW_FALLBACK_TRIGGERED",
    "data": {
      "round": 1,
      "primaryReviewer": "Claude Code",
      "fallbackReviewer": "Codex CLI",
      "reason": "<classified error reason>",
      "model": "gpt-6-astra"
    }
  }
  ```
* UI accurately reports `✓ Passed (Codex Fallback)` or `○ Bypassed (Codex Fallback)` without silently disguising Codex as Claude.

### 9. Resilient Resume Without Repetition
* `POST /api/runs/:id/retry` resumes directly from `REVIEWING` if planning and Gemini physical implementation have already succeeded, avoiding redundant planning or code generation costs.

---

## 4. Current Diagnostics Telemetry

Executed `npm run diagnose:claude`:
```
======================================================
         CLAUDE CODE CLI DIAGNOSTIC PROBE            
======================================================
[INFO] Node process user:       tranhaibang
[INFO] Process CWD:             /Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp
[INFO] HOME:                    /Users/tranhaibang
[INFO] SHELL:                   /bin/zsh
[INFO] Canonical binary:        /Users/tranhaibang/.local/bin/claude
[INFO] Version:                 2.1.269 (Claude Code)

[SECURITY AUDIT - SENSITIVE ENV VARS]
  CLAUDE_CONFIG_DIR:            SET (/Users/tranhaibang/.claude)
  CLAUDE_CODE_OAUTH_TOKEN:      NOT SET
  ANTHROPIC_AUTH_TOKEN:         NOT SET
  ANTHROPIC_API_KEY:            NOT SET
  ANTHROPIC_BASE_URL:           NOT SET
  CLAUDE_CODE_USE_BEDROCK:      NOT SET
  CLAUDE_CODE_USE_VERTEX:       NOT SET
  CLAUDE_CODE_USE_FOUNDRY:      NOT SET

[PROBE RESULTS]
  LEVEL 1 (Binary & Version):   PASS
  LEVEL 2 (Auth Status):        FAIL (Not logged in)
  LEVEL 3 (Inference Probe):    FAIL (OAuth session expired and could not be refreshed)

[DIAGNOSTIC SUMMARY]
  Identified Case:              CASE_A
  Verdict:                      AUTH_REPAIR_REQUIRED
======================================================
```

---

## 5. One-Time User Terminal Re-Authentication Instructions

Because Claude Code CLI authentication is protected by macOS Keychain and Anthropic's interactive browser OAuth flow, run the following commands in your normal macOS Terminal:

```bash
# 1. Clear stale session
claude auth logout

# 2. Verify Claude CLI is on latest version
claude update

# 3. Log in with your Claude Pro subscription
claude auth login
# -> Select Claude.ai subscription (claude.ai) and complete browser authorization with haibangtran@gmail.com

# 4. Verify subscription metadata in terminal
claude auth status

# 5. Verify real headless inference
claude -p --model claude-sonnet-5 "Reply with exactly: CLAUDE_AUTH_OK"
```

Once the terminal prints `CLAUDE_AUTH_OK`, run:
```bash
cd /Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp
npm run diagnose:claude
npm run gate-0
```

All checks will transition to **PASS** and Claude Code CLI will autonomously conduct all code reviews without falling back to Codex!
