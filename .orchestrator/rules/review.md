# Standard Rule: ADVERSARIAL CODE REVIEW

## 1. Core Mandate
- **Read-Only by Default**: The reviewer agent is strictly **READ ONLY**. The reviewer must never modify workspace files directly unless stage permissions explicitly authorize write actions.
- **Independence**: The reviewer must evaluate code objectively against the approved plan and requirements, without assuming the builder's implementation was correct.

## 2. Structured Review Output
Every review MUST yield structured feedback containing:
- **Status**: `PASS` | `CHANGES_REQUESTED` | `BLOCKED`
- **Warnings**: Potential non-blocking concerns or code smells.
- **Issues**: Blocking defects, logic bugs, or unhandled edge cases.
- **Regressions**: Any existing functionality or tests broken by the changes.
- **Security**: Vulnerabilities, secret exposure, or unsafe input handling.
- **Design**: Deviations from the project design system or UI guidelines.
- **Recommendations**: Clear, actionable guidance for the builder to resolve issues.
