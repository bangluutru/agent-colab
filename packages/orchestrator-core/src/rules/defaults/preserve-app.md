# Mandatory Rule: PRESERVE EXISTING APPLICATION

## 1. Core Mandate
- **DO NOT rewrite** the application or subsystems if not strictly required by the user's task.
- **DO NOT alter** existing, operational architecture unless the task explicitly demands it.
- **DO NOT delete** existing features, tests, or legacy compatibility endpoints to simplify implementation.
- **DO NOT replace or bump** stable dependencies without clear, justifiable necessity.
- **DO NOT modify UI** outside the defined task scope.
- **DO NOT break API contracts** or change payload structures without backward-compatible shims.
- **DO NOT introduce regressions**. Existing workflows, CLI commands, and web routes must remain 100% operational.

## 2. 5-Step Surgical Execution Loop
Before applying any modifications to the codebase, every agent MUST follow this loop:
1. **Understand**: Read and comprehend existing source code, configuration, and runtime environment. Never code on assumptions.
2. **Scope**: Define the exact boundary of what must change. Isolate affected files.
3. **Plan**: Formulate the minimal viable diff that completely solves the problem.
4. **Modify**: Apply clean, surgical, non-destructive changes. Never leave placeholders or truncated logic.
5. **Verify**: Execute automated tests, type checks, and runtime verification to prove zero regressions.

## 3. Principle of Smallest Safe Change
Always prefer the smallest, most localized, high-confidence change over broad refactorings or speculative framework migrations.
