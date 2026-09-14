# Security Policy

## Supported Versions

Security fixes are provided for the latest release of the project.

| Version | Supported |
| --- | --- |
| 2.2.x | ✅ |
| < 2.2 | ❌ |

## Reporting a Vulnerability

Do not publish Discord bot tokens, server IDs tied to private infrastructure, database contents, or exploitable security details in a public issue.

Use GitHub's **Private vulnerability reporting** / **Security Advisories** for this repository when the report contains sensitive details.

Please include, where possible:

- affected version/commit;
- clear reproduction steps;
- expected and actual behavior;
- security impact;
- sanitized logs or screenshots;
- a suggested mitigation, if known.

## Secrets

`DISCORD_TOKEN` must only be stored in a local `.env` file or a protected deployment secret store. The repository ignores `.env` and SQLite runtime data by default.

If a real Discord token is ever committed, deleting the file is not enough. Revoke/regenerate the token in the Discord Developer Portal and then remove the secret from Git history if necessary.

## Scope

Security reports about this project's own code and deployment guidance are in scope. Vulnerabilities in Discord, discord.js, Node.js, SQLite, or other dependencies should also be reported to their respective maintainers where appropriate.
