---
name: pokesql-engineering
description: Investigate, implement, structurally review and verify scoped PokeSQL features, fixes and refactors. Use during substantive coding work; skip documentation-only and trivial cosmetic edits.
---

# PokeSQL engineering

Read [AGENTS.md](../../../AGENTS.md), inspect the working tree and preserve
its ownership and lifecycle contracts. Apply only the relevant boundaries below;
keep the requested outcome and diff scope concrete.

Check only the invariants touched by the change:

- Query cancellation restores the last completed snapshot and never replays SQL.
- A restored editor draft is text, not permission to execute it on reload.
- Challenge grading uses a separate original, read-only database. Result
  comparison preserves column order, types, NULLs and duplicate rows.
- Export/checkpointing must respect open transactions, temporary objects,
  attachments and supported connection PRAGMAs.
- Broken views and unusual identifiers must not disable remaining schema access.
- Sprites and SQLite/WASM assets stay local. The Electron renderer remains
  sandboxed without Node integration; offline assets come from the build tree.

## Shared workflow

Use `toolkit-engineering` for the reusable investigation, implementation,
review and verification loop. Resolve it through [toolkit setup](../../../docs/AGENT_SKILLS.md).
Apply [pokesql-thermonuclear-review](../pokesql-thermonuclear-review/SKILL.md)
and [pokesql-verify](../pokesql-verify/SKILL.md) for this project's boundaries
and checks. Skip the full loop for documentation-only or trivial cosmetic work.
