# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### Features

- *(packaging)* Configure multiplatform bundles and daemon services - ([bdcaa63](https://github.com/Hephaestus-Studio/VPNHub/commit/bdcaa63653c501ab02577b2cfc79d23a1f9880ea))
- *(daemon)* Add core dependencies, config, and error types - ([f6f2974](https://github.com/Hephaestus-Studio/VPNHub/commit/f6f2974efc0912b5668a7043b7d13539c95a9906))
- *(daemon)* Implement security module with zeroize and audit ring buffer - ([9681d94](https://github.com/Hephaestus-Studio/VPNHub/commit/9681d94486356ca1f2e4355d08a7d980463f9ae5))
- *(daemon)* Implement IPC protocol, frame codec, and transport layer - ([fa4aede](https://github.com/Hephaestus-Studio/VPNHub/commit/fa4aedeaac47b0fb0330a4618c6ee8d135b3f201))
- *(daemon)* Implement core state machine, session management, and orchestrator - ([ff13f04](https://github.com/Hephaestus-Studio/VPNHub/commit/ff13f04f1f1ccd375de701305d332dc2116cf755))
- *(daemon)* Implement network layer with DNS, routing, and firewall killswitch - ([54ac705](https://github.com/Hephaestus-Studio/VPNHub/commit/54ac705696c84e83b39e2f3a6afdcdc34c7eb687))
- *(daemon)* Implement OpenVPN 3 and WireGuard driver engines - ([12b9d48](https://github.com/Hephaestus-Studio/VPNHub/commit/12b9d48c93ee8483e4d1113908aef02573df19cf))
- *(daemon)* Implement platform lifecycle and health diagnostics monitoring - ([9b85473](https://github.com/Hephaestus-Studio/VPNHub/commit/9b854736ca16c55e0c8c3518792f8ca31b630f83))
- *(daemon)* Wire up main entrypoint with CLI and signal handlers - ([898b12c](https://github.com/Hephaestus-Studio/VPNHub/commit/898b12c5e943bbebaa0db478db82f0d48840aa82))
- Implement full-stack desktop app and enhance driver engines - ([2f12a5e](https://github.com/Hephaestus-Studio/VPNHub/commit/2f12a5edf61164f7297af7baa9f0c30d39c0eb74))

### Maintenance

- Init project - ([030cec0](https://github.com/Hephaestus-Studio/VPNHub/commit/030cec040811247ba3ffef7f0db04ceec18836ec))
- *(changelog)* Configure git-cliff and generate changelog - ([af3022d](https://github.com/Hephaestus-Studio/VPNHub/commit/af3022df5dd634a962e2b77aff6507116664c638))
- Add changelog and release workflow - ([3e05250](https://github.com/Hephaestus-Studio/VPNHub/commit/3e052509acbcb2d7c28c89ecf4377f506afcecc8))
- Add linux release workflow and rename changelog workflow - ([b1eb70c](https://github.com/Hephaestus-Studio/VPNHub/commit/b1eb70c44cd9a8e659041372dd61f011e27abdd4))
- *(husky)* Configure husky and commitlint - ([0ddd6ba](https://github.com/Hephaestus-Studio/VPNHub/commit/0ddd6ba2a834ec6b9f8a4bc5df06ec04fdb10119))

### Refactoring

- *(workspace)* Restructure repository to monorepo with packages/app and daemon - ([2010713](https://github.com/Hephaestus-Studio/VPNHub/commit/20107134df5206824a16bb2baf823c239f19faad))
