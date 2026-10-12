# Chrome Web Store listing and update communication

Use this copy after the release passes automated and manual acceptance. Dashboard publication and review replies are manual. Do not claim the several-hour disconnect is resolved until it is reproduced and verified.

## Positioning

Keep the brand **Session Switcher**. Lead with QA testers comparing multiple users, roles, and permissions. Secondary audiences can still use it for work/personal accounts. Avoid “works everywhere”, “airtight isolation”, and “beat rate limits”: those claims exceed the supported behavior.

Manifest summary (in `wxt.config.ts`):

```text
Test multiple accounts side by side on the same site. Separate cookies and storage for QA and multi-session testing.
```

Optional future title, if adopted consistently in the manifest and listing: **Session Switcher – Multi-Session Testing**.

## Description to paste

```text
Test your web app as multiple users in one browser window.

Session Switcher lets QA testers and developers open separate sessions on the same website. Compare Admin and Standard user accounts side by side, check role-based access, and test login/logout without repeatedly changing your normal browser profile.

GET STARTED
1. Open your web app and click Session Switcher.
2. Create a session named Admin.
3. Choose Open new tab or Use this tab, then log in.
4. Create another session named Standard user, open it, and log into a different account.

USE IT FOR
• Multi-session testing and comparing user roles
• Checking whether logout in one session affects another
• Keeping test accounts available side by side
• Separating work and personal accounts on supported sites

FEATURES
• Separate session cookie jars
• Namespaced localStorage, sessionStorage, and IndexedDB
• Named, color-coded sessions grouped by site
• Session export/import for backups
• Clear controls to open a new tab or use the current tab

WHAT'S NEW IN 0.2.0
• Temporary cookie-rule failures retry without forgetting a live tab's session
• A guide walks you through creating two sessions on the same site
• Visible session action labels and a Create another session control

LIMITATIONS
Sessions are scoped to a site/domain. After a browser restart, reconnect restored tabs before using them. External identity-provider SSO and cross-domain login flows may behave inconsistently. Storage isolation is best effort; this extension is not a security sandbox or a separate browser profile. Managed tabs block new site service-worker registrations and unregister existing origin registrations, which can also affect the site's offline/push behavior in other tabs. Cookie path handling is approximate.

PRIVACY
Session cookies are stored locally on your device. No extension analytics or remote account service. Exported backups contain sensitive login data; keep them private. Normal website requests still go to their websites.

See the linked homepage for the changelog, supported behavior, and testing checklist. Report issues through the support link with your extension version, browser version, steps, and approximate time before failure. Never include login cookies or tokens.
```

## Screenshots and demo

Replace screenshots after the UI is finalized. Show the actual extension beside a test application with fictional data:

1. Admin and Standard user visible side by side: “Compare two users on the same site”.
2. First-session guide: “Create → Open → Log in”.
3. Clearly labeled popup controls: “Create another session”.
4. Manager grouped by site: “Organize your QA accounts”.
5. Accurate limitations and privacy: “Local session data; reconnect tabs after restart”.

Record a 20–30 second workflow showing both identities. Add the store install link, changelog link, and support link to the public repository/homepage. Only use real screenshots of the final build; do not display customer data.

## Existing-user communication

- The popup shows a dismissible release note once per version, on a supported site. It does not open unsolicited tabs or request new permissions.
- Keep a dated public changelog and put user-visible changes near the top of the listing.
- After publication, reply to the affected reviews with the version and a specific retest request. Ask for feedback, without incentives or demands for a higher rating.
- Share the two-user demo in QA/developer communities where promotion is allowed. Link to a practical multi-user testing guide rather than repeatedly posting an advertisement.
- Use dashboard usage, ratings, and uninstall trends to judge the release; do not add tracking solely to measure this update.

### Draft reply to Fabiano (Portuguese; after publication)

```text
Obrigado pelo feedback, Fabiano. Na versão 0.2.0, adicionamos um guia e botões com nomes mais claros. Para testar duas contas no mesmo site: crie uma sessão, clique em “Open new tab” e faça login. Depois clique em “Create another session”, abra a segunda sessão e entre com outra conta. Se puder testar novamente, gostaria de saber se esse fluxo ficou mais claro.
```

### Draft follow-up to Henk (after publication)

```text
Hi Henk, version 0.2.0 now retries temporary cookie-rule update failures without dropping a live tab's session association. This addresses one possible detachment path, though I have not confirmed it was the cause of your several-hour issue. Could you retest your usual workflow and tell me the extension/browser version and whether it still happens after idle time or computer sleep? Thanks for helping investigate this.
```

## Search and discovery

Use “multiple accounts”, “multi-session testing”, “QA testing”, and “role-based access testing” naturally in relevant sentences. Do not append a keyword dump. Google documents metadata relevance, user experience, ratings, and usage signals; it does not publish exact ranking weights or guarantee a freshness boost. Prioritize a clear purpose, useful onboarding, accurate screenshots, and retention.

Official references: [Discovery](https://developer.chrome.com/docs/webstore/discovery), [listing guidance](https://developer.chrome.com/docs/webstore/best-listing), and [spam FAQ](https://developer.chrome.com/docs/webstore/spam-faq/).

## Package and release

1. Confirm the version exceeds the published version; align `package.json`, `package-lock.json`, and release copy.
2. Complete [QA acceptance](docs/QA_RELEASE_CHECKLIST.md), including the 4–8 hour check.
3. Run `npm run zip` and upload the new ZIP from `.output/` to the existing store item.
4. Review privacy disclosures and permission justifications. No permissions were added in this update.
5. Update listing text/screenshots, submit for review, and publish after approval. Use deferred publication if coordinating announcements.
6. Confirm the published version before posting replies or announcements.

Chrome requires a higher version for each update. See [updating an item](https://developer.chrome.com/docs/webstore/update). This repository does not publish automatically.
