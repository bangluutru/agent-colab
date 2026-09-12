# Agent Collaboration MVP v0.1 (Autonomous Engine)

Autonomous, Zero-API-Key Multi-Agent Collaboration Framework connecting:
- **OpenAI Codex CLI**: Strategic Architecture Planner & Final Conformance Auditor.
- **Antigravity / Gemini 3.8**: Headless Code Construction, Scaffold Bootstrapper & Surgical Repair Executor.
- **Anthropic Claude Code CLI**: Independent Adversarial Code Reviewer.

---

## Autonomous Architecture

```
USER
  │
  ▼
WEB UI (Studio Dashboard)
  │
  │ [1] Submit User Requirement
  ▼
ORCHESTRATOR (WorkflowController)
  │
  ├──► [2] CODEX CLI: Generate Architecture Plan (plan.json)
  │
  ▼
[3] ANTIGRAVITY / GEMINI (agy CLI)
  │ Headless Workspace Code & Test Construction
  │
  ▼
[4] AUTOMATED MACHINE VERIFICATION
  │ npm test (Vitest) + npm run build (Vite)
  │
  ▼
[5] CLAUDE CODE CLI: Adversarial Code Review (review-01.json)
  │
  ├── CHANGES_REQUESTED
  │         │
  │         ▼
  │    GEMINI CODE REPAIR (Surgical fix)
  │         │
  │         ▼
  │    RE-TEST & BUILD VERIFICATION
  │         │
  │         ▼
  │    CLAUDE RE-REVIEW
  │
  └── APPROVED
            │
            ▼
[6] CODEX CLI: Plan-Conformance Audit (final-check.json)
  │
  ▼
[7] FINAL OBJECTIVE VERIFICATION (Tests + Build)
  │
  ▼
[8] COMPLETED (Artifacts Persisted)
```

---

## Key Principles & Guardrails

1. **Zero Human In-The-Loop**:
   The user types the requirement once in the UI and clicks **Start Collaboration**. The system autonomously executes planning, construction, test verification, review, repairs, and conformance audit without human message shuttling.
2. **Zero API Keys**:
   Operates 100% on locally authenticated subscriptions:
   - Codex CLI via ChatGPT Plus/Pro
   - Claude Code CLI via Claude Pro OAuth
   - Gemini Executor via Antigravity CLI (`agy`)
   All `*_API_KEY` variables are scrubbed from execution environments.
3. **Deterministic State Machine**:
   Guards against premature completion. `completeRun()` enforces that a valid plan, passing tests, approved review, conformant audit, and clean production build all physically exist before declaring `COMPLETED`.
4. **Isolated Workspaces**:
   Every run executes in a dedicated sandbox: `workspaces/<run-id>/project/`.

---

## User Workflow (Step-by-Step)

### 1. Preflight Environment Audit
Verify Node, npm, git, Codex CLI, Claude Code CLI, and Antigravity CLI:
```bash
npm run gate-0
```

### 2. Launch Studio Web UI
```bash
npm run dev
# Or: npm run ui
```
Open [http://127.0.0.1:3000/](http://127.0.0.1:3000/) in your browser.

### 3. Start Autonomous Collaboration
1. Select preferred models for Codex, Claude, and Gemini (or keep defaults).
2. Enter your software requirement (e.g. click the **React Todo App** preset).
3. Click **Start Collaboration**.
4. Watch the live pipeline stepper, SSE activity feed, and agent decision cards update in real time.
5. Upon reaching **COMPLETED**, inspect the generated code in `workspaces/<run-id>/project/`.

---

## Verification Test Suites

```bash
# Preflight environment check (Codex, Claude, Gemini CLI readiness)
npm run gate-0

# Unit tests (State Machine & Schemas)
npm test

# Autonomous End-to-End Test (React Todo App build & repair loop)
npm run e2e

# Controlled Defect Test (Verifies Claude rejects defects)
npm run test:defect

# Process Interruption & State Recovery Test
npm run test:interruption
```

---

## Reports & Artifacts

- [Autonomous E2E Execution Report](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/docs/AUTONOMOUS_E2E_REPORT.md)
- [Gate 0 Environment Audit Report](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/docs/GATE_0_REPORT.md)
- [Model Selection Guide](file:///Users/tranhaibang/.gemini/antigravity-ide/scratch/agent-collaboration-mvp/docs/MODEL_SELECTION_GUIDE.md)

