---
name: pokesql-thermonuclear-review
description: Apply the full upstream Thermos maintainability rubric to a PokeSQL diff or named subsystem. Use for requested code-quality reviews and structural self-review of substantive implementation changes. Standalone reviews produce findings only.
---

# PokeSQL structural review

Use `toolkit-structural-review`, resolved through [toolkit setup](../../../docs/AGENT_SKILLS.md).
Read [AGENTS.md](../../../AGENTS.md) before assessing the diff. Preserve the SQL
worker's cancellation/snapshot contract, isolated read-only challenge grading,
checkpoint/transaction boundaries and sandboxed, local-only Electron renderer.

Standalone reviews report findings only. During authorized implementation,
return findings to the engineering workflow for scoped fixes and re-review;
review does not authorize publishing or unrelated refactors.
