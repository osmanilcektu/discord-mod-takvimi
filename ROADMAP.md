# Roadmap

This roadmap describes likely directions for the project. It is not a fixed release commitment; priorities may change based on real-world use, bug reports, and contributor feedback.

## Near term

### Reliability and testing

- Add broader scheduler and database integration tests.
- Add restart/recovery scenarios to automated tests.
- Add Windows CI coverage alongside Linux CI.
- Continue dependency and security maintenance.

### Operator experience

- Improve diagnostics returned by `npm run doctor`.
- Improve setup validation and configuration error messages.
- Make permission and channel diagnostics easier to act on.
- Expand troubleshooting documentation from real support cases.

### Discord UX

- Refine administrator command responses.
- Improve schedule summaries and moderator workload visibility.
- Improve empty-state messages for new installations.
- Review command naming and help output for first-time users.

## Medium term

### Multi-server architecture

The current release is intentionally self-hosted and configured for one Discord guild per bot process. A future major version may support multiple guilds with isolated configuration and persistence.

Potential work includes:

- Per-guild configuration storage
- Per-guild scheduler state
- Per-guild moderator role and channel mappings
- Safe migrations from the current single-guild configuration model

### Persistence layer

- Evaluate maintained SQLite driver alternatives.
- Keep migrations backward-compatible where practical.
- Add backup/export guidance for operators.

### Observability

- More structured health information.
- Optional operational metrics that remain local to the self-hosted instance.
- Better release/update reporting.

## Contribution ideas

Good first contributions include:

- Documentation improvements
- Additional tests
- Windows installation verification
- Better error messages
- Translation/localization of user-facing documentation

For contribution requirements, see `CONTRIBUTING.md`.
