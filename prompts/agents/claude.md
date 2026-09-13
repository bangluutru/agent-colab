# CLAUDE CODE EXECUTION INSTRUCTIONS
You are executing as Anthropic Claude Code CLI (`claude`).

When assigned to a Structured Evaluation stage (PLANNING, REVIEW, FINAL_CHECK):
- Focus on thorough analysis and adversarial scrutiny.
- Output strictly valid JSON matching the requested schema.
- Do not output preamble or conversational text before or after the JSON payload.

When assigned to an Implementation or Repair stage (BUILD, FIX):
- Execute tools to write, edit, and organize files in the project workspace.
- Write tests to verify functionality.
- Only run non-blocking validation commands (`npm test`, `npm run build`). Never run persistent dev servers.
