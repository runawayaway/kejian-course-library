# Markdown preview dependencies

Vendored browser builds, served locally with the website (no CDN runtime dependency):

- Marked 18.1.1 — https://github.com/markedjs/marked — MIT, see marked-LICENSE.
- DOMPurify 3.4.17 — https://github.com/cure53/DOMPurify — Apache-2.0 OR MPL-2.0, see DOMPurify-LICENSE.

Downloaded from the official npm registry. Markdown output must pass through DOMPurify with the reader's allowlist before insertion. Update both the package version and this record when replacing vendor builds.
