# Security and public-data policy

## Scope

This repository is public. Do not commit credentials, API keys, access tokens,
personal email addresses, local filesystem paths, Foundry world data, or other
private development artifacts.

The public project identity is intentionally documented:

- GitHub account: `emriis`
- Project author: **Aymeric VILAIN**

The author's name is part of the project attribution and is not treated as
private data.

## Local configuration

Keep local credentials and runtime data outside the repository. The repository
ignores common environment files, certificates, Foundry data directories,
runtime logs, test reports, and local scratch files.

If a secret is accidentally committed, removing it in a later commit is not
sufficient. Stop using or rotate the credential first, then purge the exposed
value from Git history and any published artifacts.

## Reporting

For a suspected security issue or accidental disclosure, use a private GitHub
security advisory when available rather than opening a public issue containing
the sensitive value.

## License

This project is distributed under the Cypher Open License terms applicable to
CRD-derived material. See [LICENSE.txt](LICENSE.txt).
