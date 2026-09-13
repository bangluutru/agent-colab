# Standard Rule: VERIFICATION GATES

## 1. Core Mandate
A stage is NEVER deemed complete merely because an agent reports "done" or outputs conversational success messages.
Completion requires passing explicit, objective verification criteria:
- **Build Gate**: Code compiles without errors (`tsc`, `npm run build`, or equivalent compiler check).
- **Lint Gate**: Code adheres to project formatting and lint standards without unhandled violations.
- **Unit & Integration Tests**: All automated test suites execute and pass 100% without test deletion or silencing.
- **Runtime / Browser Verification**: Where applicable, endpoints respond with HTTP 200 and frontend components render without uncaught console errors.
- **Reviewer Gate**: Explicit approval by the designated Reviewer or Human Operator.
