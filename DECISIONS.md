# DECISIONS

> Lightweight decision log for product direction and architecture trade-offs.

## D-001: Re-center product identity (oh-pi first, ant-colony optional)
- **Date:** 2026-02-24
- **Status:** Superseded by D-004

### Context
- ant-colony complexity and code size are growing quickly.
- New users mostly arrive for "one-command setup", not multi-agent orchestration.
- Current risk is positioning drift: users may confuse installer value with advanced swarm value.

### Decision
1. Keep **oh-pi** as the primary product identity: setup, onboarding, and immediate usability.
2. Treat **ant-colony** as an optional advanced extension for complex tasks.
3. Reorder docs to communicate in this sequence:
   - 30-second setup success
   - 2-minute value demonstration
   - clear "when not to use colony" boundaries

### Consequences
- Better first-run clarity and lower cognitive load for new users.
- Advanced users still keep colony power, but through explicit opt-in mental model.
- Short-term downside: some deep architecture content becomes less prominent on the first screen.

### Follow-ups
- Add benchmark evidence (single-agent vs colony) before expanding swarm messaging.
- Add explicit anti-corruption layer plan for pi SDK coupling in `spawner` path.
- Revisit this decision after early growth metrics (activation + retention) are stable.

---

## D-002: Growth focus on one language community first
- **Date:** 2026-02-24
- **Status:** Accepted

### Context
- Documentation is already multi-language, but community traction is still early.
- Spreading effort across many channels too soon risks shallow outcomes.

### Decision
- Prioritize one core developer community first (currently Chinese developer channels), while keeping multilingual docs available.

### Consequences
- Better signal concentration and tighter feedback loop.
- Non-priority language communities may get slower narrative updates initially.

---

## D-003: Introduce storage and SDK boundary abstractions before deeper optimization
- **Date:** 2026-02-24
- **Status:** Accepted

### Context
- Pheromone persistence currently relies on local JSONL behavior tightly coupled in `nest` flow.
- `spawner` directly depends on multiple pi SDK APIs, increasing upstream change risk.
- Further optimization without boundaries would amplify maintenance cost.

### Decision
1. Define a `PheromoneStore` interface first, keep JSONL as default implementation.
2. Make decay policy configurable (global + per-caste overrides).
3. Introduce a `PiAdapter` anti-corruption layer before major colony feature expansion.

### Consequences
- Near-term refactor overhead increases, but change risk is localized long-term.
- Future SQLite/Redis experiments become feasible without queen-level rewrites.
- SDK upgrades should mostly be absorbed in adapter layer, not core scheduling logic.

---

## D-004: Re-center around Ant Colony for Pi as the primary product
- **Date:** 2026-04-29
- **Status:** Accepted

### Context
- The strongest differentiated value is no longer setup convenience, but multi-agent execution for complex coding tasks.
- The current repository mixes two product stories: bootstrap/setup and ant-colony capability.
- This creates positioning noise: users may remember the installer, but miss the core reason to care.
- Pi itself is designed to be extended through extensions, so colony should align with that ecosystem shape.

### Decision
1. Make **Ant Colony for Pi** the primary product identity.
2. Treat **oh-pi** as the current distribution/bootstrap layer, not the long-term core narrative.
3. Rewrite docs and demos so the default message is:
   - what kinds of tasks need colony
   - how colony improves execution
   - how it plugs into pi
4. De-emphasize themes, presets, and convenience packaging as secondary support assets.
5. Prioritize plugin boundary hardening:
   - `PiAdapter`
   - `PheromoneStore`
   - runtime/integration separation

### Consequences
- Product messaging becomes sharper and more memorable.
- Some existing users who came for one-command setup may need migration in expectations.
- The repo will likely evolve toward clearer separation between colony core and bootstrap/install surfaces.
- Growth can be driven by benchmark evidence and task-fit clarity, instead of novelty alone.

### Follow-ups
- Publish a dedicated product boundary document.
- Rework README and roadmap around colony-first language.
- Add benchmark evidence for when colony outperforms a single agent.
- Define transitional naming strategy for `oh-pi` vs `ant-colony` packaging.
