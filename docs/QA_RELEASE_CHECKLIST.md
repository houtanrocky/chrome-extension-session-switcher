# QA and release checklist

## Setup

Run `npm run compile`, `npm test`, and `npm run test:e2e`. Build with `npm run build`, then load `.output/chrome-mv3` through **Load unpacked** at `chrome://extensions`. Use a separate testing profile and test accounts. Record extension version, Chrome version, OS, site, authentication method, and tab count.

## Manual acceptance

| Scenario | Expected result |
| --- | --- |
| First use | Create Admin, choose Open new tab, log in; repeat for Standard user. Both accounts remain distinct. |
| Existing tab | Use this tab reloads into the selected session; saved web storage belongs to that session. |
| Third identity | A normal tab keeps its original account while both managed accounts remain distinct. |
| Reload and navigation | Hard reload, back/forward, SPA routes, and same-site subdomains retain the correct identity. |
| Long session | Leave accounts open 4–8 hours; trigger token refresh and compare identities at intervals. |
| Sleep and background lifecycle | Suspend/resume the machine and stop the extension worker from `chrome://serviceworker-internals` if available. Reload/request identity after waking; bindings and account separation remain. Do not leave worker DevTools open during the idle test. |
| Many tabs | Repeat with 20+ tabs and several sessions; closing one must not detach the others. |
| Logout | Logging out in one session must not log out another session or the normal browser profile. |
| Site service worker | Test a site previously visited normally. Managed-tab identity stays separate; offline/push support may be unavailable. |
| SSO | Test external identity-provider redirects and popups separately; cross-domain SSO is a known limitation. Record failures rather than claiming support. |
| Restart | Sessions remain listed, but restored tabs require explicit reconnection after browser restart. Reconnect before sending authenticated requests. |
| Backup | Export and merge into a clean test profile; saved sessions remain usable. Treat the file as sensitive login data. |
| Update note | Dismiss, reopen, and verify it stays hidden for this version. Try the workflow reveals the guide. |

Check both HTTP cookie identity and localStorage/IndexedDB identity in the application. A cookie count does not prove login. For failures, record steps and timings without sharing cookies, tokens, or backups.

## Ship and announce

Confirm the package version exceeds the currently published version. Run `npm run zip`; upload the newly generated ZIP, not the older root `.output.zip`. Update listing text and screenshots to match the shipped UI. Complete the manual long-session check before describing Henk's report as fixed. Keep results and any remaining site limitations with the release record.

After approval and publication, update the changelog date, post the review replies from `STORE_LISTING.md`, and share a short two-account QA demo. Nothing in this checklist sends messages or publishes automatically.
