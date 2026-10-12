# Changelog

## 0.2.0 — Unreleased

- Temporary cookie-rule update failures retry without discarding a live tab's session binding. Repeated failures are reported; new tabs remain blank if isolation cannot be installed.
- All UI commands wait for background initialization before changing sessions.
- Visible **Use this tab** and **Open new tab** actions replace unlabeled icons.
- A getting-started guide explains how to create two sessions for the same site, using QA roles as examples.
- **Create another session** makes the next step explicit after the first session.
- A dismissible release note appears in the popup once per installed version.
- Cookie counts are described as saved cookies, rather than proof of login.

These changes address a potential detachment path. They do not establish the root cause of the reported several-hour disconnect; complete the long-running manual checks before claiming that report is resolved.
