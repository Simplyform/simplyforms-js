# Security Policy

This is the official client SDK for SimplyForms. It runs in customers' browsers and servers, so
the integrity of the published package matters. We take reports seriously and appreciate
responsible disclosure.

## Supported versions

Security fixes for `@simplyforms/sdk` land on the latest minor and are released as a new patch.

| Version      | Supported              |
| ------------ | ---------------------- |
| latest `0.x` | ✅                     |
| older `0.x`  | ❌ (please upgrade)    |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   (GitHub Private Vulnerability Reporting), or open:
   https://github.com/simplyform/simplyforms-js/security/advisories/new
2. If you cannot use GitHub Advisories, email **lasanthaslakmal@gmail.com** with the details and a
   way to reach you.

Please include a description and impact, steps to reproduce or a proof of concept, and the
affected version(s) and runtime.

### What to expect

- **Acknowledgement** within 3 business days.
- An initial assessment and severity within 7 business days.
- Coordinated disclosure: we'll agree on a timeline, prepare a fix, publish a patched release with
  provenance, and credit you in the advisory unless you prefer to remain anonymous.

## Scope notes

- Public form submission is **unauthenticated by design** — anyone with a form ID can submit, the
  same as an embedded HTML `<form>`. Abuse is mitigated server-side (Cloudflare Turnstile,
  honeypot fields, per-IP rate limiting). Reports that a form ID can be submitted to without a key
  are a documented non-goal, not a vulnerability.
- The client stores no secrets and never holds the encryption key for submissions.

## Supply chain

- The package is published from CI via **npm Trusted Publishing (OIDC)** with **provenance** —
  no long-lived npm tokens exist.
- GitHub Actions are pinned to commit SHAs and updated by Dependabot.
- Each release attaches a CycloneDX SBOM to its GitHub Release.
- The published client has **zero runtime dependencies**.
