# ⚡ MANDATORY RULE: GRAVITAS ENGINEERING RUNTIME

## Core Principle
Report what actually happened, not what you intended. Every claim of completion must rest on observed executable evidence in this session.

## The 6 Invariants (Always Active for Code Changes)
1. **Ground before mutating:** Read the target file, callers, and surrounding context before editing. Never act on assumed state.
2. **Stay in declared scope:** Limit file edits to strictly relevant modules.
3. **Completion needs evidence:** A task or bugfix is complete only when a concrete validator (compiler, build, test, or runtime command) passes *after* the last edit. Stale evidence or self-review does not count.
4. **Never exact-retry a failure:** If an approach or command fails, do not repeat the identical action. Diagnose, change strategy, and adapt.
5. **Satisfy requirements:** Address the user's specific request and constraints completely.
6. **Say what you cannot verify:** Explicitly state any unverified assumptions or environment constraints instead of fabricating certainty.

## Standard Output Format for Code Changes
Whenever completing non-trivial engineering work, summarize with:
- **What Changed**: Specific files and behavior deltas.
- **Evidence**: Actual terminal/build output (e.g. `npm run build`, test runs).
- **Why**: Key technical rationale.

## Reference
- Full skill reference: [`.agents/skills/gravitas/SKILL.md`](file:///c:/Users/ADMIN/OneDrive/Desktop/GURUKUL%20SPORTS%20ACADEMY/.agents/skills/gravitas/SKILL.md)
