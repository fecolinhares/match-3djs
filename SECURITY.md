# Security Policy

## Supported Versions

Match-3D.js is a client-side browser game. Only the latest release on the
`main` branch receives security updates. Older tags are not patched — users
are encouraged to stay on the latest version.

| Version | Supported          |
|---------|--------------------|
| latest (main) | ✅ |
| older tags | ❌ |

## Scope

This project is a pure client-side application (JavaScript + Three.js) served
as static files. There is **no backend, no server-side processing, and no
user data storage**. The security surface is limited to:

- **Dependencies** — `three` and build tooling (`vite`). Vulnerabilities in
  these are tracked by Dependabot and fixed on `main`.
- **Client-side XSS** — any place where user input reaches the DOM.
  Currently the game has no user-supplied content, but this is a design
  invariant: never introduce `innerHTML` with untrusted data.
- **Supply chain** — the published build on GitHub Pages comes from a
  GitHub Actions workflow (see `.github/workflows/`); the workflow pins
  action versions and uses `npm ci` with a committed lockfile.

Out of scope: features that do not exist in this project (accounts, network
calls, storage, etc.).

## Reporting a Vulnerability

Please **do not open a public issue** for security problems.

Instead, report privately using GitHub's Security Advisories:

1. Go to the repository → **Security** tab → **Report a vulnerability**
   (or use the direct link: `https://github.com/fecolinhares/match-3djs/security/advisories/new`).
2. Include:
   - A description of the issue and its impact.
   - Steps to reproduce (a minimal example is ideal).
   - Affected version/commit and suggested fix if you have one.

You can expect a reply within **7 days**. If the issue is confirmed, a fix is
released on `main` as soon as possible, and a security advisory is published
after the fix lands (never before, to avoid exposing active users).

## Security Considerations for Deployments

- The GitHub Pages workflow only runs the deploy steps when the repository
  is **public**; on private repos the build job validates but skips deploy.
- The built artifact uses relative asset paths (`base: './'`), so it can be
  hosted on any static host (GitHub Pages, Netlify, etc.) without changes.
- No environment variables or secrets are required at build time.

## Dependencies

Dependencies are pinned via `package-lock.json`. Dependabot is enabled and
opens PRs for vulnerable or outdated packages; review and merge them to keep
the supply chain healthy.
