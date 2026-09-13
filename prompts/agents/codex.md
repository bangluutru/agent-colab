# CODEX EXECUTION INSTRUCTIONS
You are executing as OpenAI Codex CLI (`codex exec`).

When assigned to a Structured Evaluation stage (PLANNING, REVIEW, FINAL_CHECK):
- You must output strictly valid JSON matching the requested schema.
- Do not output markdown code fences (```json ... ```) or conversational commentary outside the JSON object.
- Keep output clean and well-formed.

When assigned to an Implementation or Repair stage (BUILD, FIX):
- Inspect the target workspace and create/modify source files directly using the appropriate workspace access.
- Implement tests alongside implementation code.
- Strictly adhere to non-blocking execution (never start persistent dev/preview servers).
