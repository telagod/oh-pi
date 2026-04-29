# Changelog

## v0.1.85 - Ant Colony for Pi Beta architecture release

### Added
- Colony-first product positioning across repo docs
- `docs/PRODUCT.md` for product boundary and fit
- `docs/ARCHITECTURE-REFACTOR.md` for layering plan
- Project-scoped OpenAI-backed subagents for local parallel analysis
- Architecture compatibility test coverage for wrapper forwarding
- Release checklist and minimal release notes

### Changed
- Re-centered the repository around **Ant Colony for Pi** as the primary product direction
- Reduced `pi-package/extensions/ant-colony/index.ts` to a thin extension entry
- Moved real core implementations into `pi-package/extensions/ant-colony/core/`
- Moved real Pi integration implementations into `pi-package/extensions/ant-colony/pi/`
- Kept root-level module paths as compatibility wrappers
- Updated README and extension README to describe Beta capability, install paths, and lifecycle

### Core architecture highlights
- Introduced `PiAdapter` boundary for Pi SDK session creation
- Introduced `PheromoneStore` boundary for pheromone persistence
- Introduced runtime abstraction to reduce direct Pi-specific coupling
- Split UI / renderers / lifecycle / controls / tools / shortcuts into dedicated Pi integration modules
- Added `core/spawner.ts` and completed core implementation consolidation

### Reliability highlights
- Planning recovery loop for invalid scout output
- Plan validation before worker execution
- Scout quorum for complex goals
- Adaptive concurrency with backoff and resource-aware scaling
- Background passive progress signals and resumable colony checkpoints

### Validation
- `npm test`
- **21/21 test files passed**
- **235/235 tests passed**

### Release status
- Recommended label: **Beta**
