# Mandatory Rule: DESIGN SYSTEM & UI CONSISTENCY

## 1. Core Mandate
When a task involves frontend user interface (UI) or user experience (UX):
- **Inspect First**: Agents MUST inspect the existing design tokens, CSS variables, and layout structures before writing any UI code.
- **Reuse Tokens**:
  - Spacing (`--space-*`)
  - Colors and theme variables (`--bg`, `--surface`, `--text-main`, `--text-muted`, `--border`, `--accent`)
  - Typography (`font-family`, sizing, hierarchy)
  - Component styling (pills, badges, cards, buttons, tabs)
  - Layout patterns (grid systems, flex alignment, gutters)
  - Interaction patterns (transitions, focus outlines, hover states)
  - Responsive breakpoints
- **No Rogue Languages**: DO NOT invent ad-hoc colors, arbitrary inline styles, or divergent design languages unless explicitly requested by the user.
- **Accessibility**: Ensure WCAG AA color contrast ratios and keyboard navigability for interactive elements.
