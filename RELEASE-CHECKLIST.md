# Ant Colony for Pi — Release Checklist

Status: **Beta release candidate**
Target package version: **v0.1.86**

## 1. Product positioning

- [x] Main story is **Ant Colony for Pi**
- [x] `oh-pi` is described as the current bootstrap / distribution layer
- [x] README points users to colony-first value
- [x] Extension README describes the plugin as a Pi extension, not just an internal module

## 2. Architecture readiness

- [x] Thin extension entry (`pi-package/extensions/ant-colony/index.ts`)
- [x] `core/` contains real runtime / scheduling / parsing / state implementations
- [x] `pi/` contains real Pi integration implementations
- [x] Root-level files preserved as compatibility wrappers
- [x] Compatibility path covered by automated tests

## 3. User-facing capability review

### Core flows
- [x] Launch colony through `ant_colony` tool
- [x] Background progress follows passive push model
- [x] Manual status snapshot available
- [x] Stop command available (`/colony-stop`)
- [x] Resume command available (`/colony-resume`)
- [x] Detail overlay available (`Ctrl+Shift+A`)

### Reliability features
- [x] Planning recovery loop
- [x] Plan validation gate
- [x] Adaptive concurrency
- [x] File conflict blocking
- [x] Pheromone-based shared context
- [x] Review phase with soldier ants
- [x] Budget exceeded state
- [x] Checkpoint / resumable nest state

## 4. Packaging and install review

- [x] Package contains `pi-package/`
- [x] `pi` package metadata present in `package.json`
- [x] `prepublishOnly` builds before publish
- [x] README includes `pi install npm:oh-pi`
- [x] README includes `npx oh-pi`
- [x] Final publish dry run (`npm pack`) checked
- [ ] Fresh-machine install smoke test checked

## 5. Provider / environment expectations

- [x] Node.js version requirement documented
- [x] API key requirement documented
- [x] Beta positioning documented
- [x] Capability matrix documented
- [ ] Multi-provider smoke test on Anthropic / OpenAI / Gemini
- [ ] Explicit guidance for provider-specific limitations kept up to date

## 6. Test and verification

- [x] Unit tests green
- [x] Core structure tests green
- [x] Compatibility wrapper tests green
- [x] Current result: **23/23 test files, 245/245 tests passing**

## 7. Release artifacts

- [x] `CHANGELOG.md` updated
- [x] Minimal release notes added
- [x] Beta capability matrix added to README
- [x] Extension README updated for install + operation

## 8. Recommended release label

Use one of:
- **Beta**
- **Preview**
- **v0.x experimental but usable**

Do **not** label this as:
- GA
- 1.0 stable
- production-proven
