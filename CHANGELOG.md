# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Multi-agent AI mock integration to simulate decision intelligence.
- `SupervisorMobile` view with actionable override buttons (Approve Bypass, Confirm Quarantine).
- Fully functional `RuleConfigurator` with inline editing for Base Market Values.
- Event Bus Simulator streaming decisions via Server-Sent Events (SSE).
- Global Confirmation Modal system in `App.jsx` replacing native browser alerts.

### Changed
- Migrated legacy `returnbrain_presentation_content.html` to the updated `returnsos_content.html` video script.

### Fixed
- Fixed bug in Mobile View where supervisor overrides did not update backend status.
- Fixed Data Loss in Rule Configurator by implementing immediate `POST` updates on inline edit.
