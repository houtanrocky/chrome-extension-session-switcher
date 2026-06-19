/**
 * declarativeNetRequest rule manager.
 *
 * For each managed tab we install exactly one *session-scoped* rule (id ===
 * tabId, which is unique among live tabs). The rule:
 *   - sets the outgoing `Cookie` header to the session jar's value for the
 *     tab's domain (or removes it entirely when the jar is empty => logged out),
 *   - removes incoming `Set-Cookie` so the browser's shared jar stays clean.
 *
 * `tabIds` conditions are only valid on session rules, which conveniently also
 * survive service-worker restarts and auto-clear on browser restart.
 */

const RT = chrome.declarativeNetRequest.ResourceType;
const RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  RT.MAIN_FRAME,
  RT.SUB_FRAME,
  RT.XMLHTTPREQUEST,
  RT.SCRIPT,
  RT.IMAGE,
  RT.STYLESHEET,
  RT.FONT,
  RT.MEDIA,
  RT.PING,
  RT.OTHER,
];

/** One rule per tab; the tab id doubles as the rule id. */
function ruleId(tabId: number): number {
  return tabId;
}

export async function applyTabRule(
  tabId: number,
  domain: string,
  cookieHeader: string,
): Promise<void> {
  const Op = chrome.declarativeNetRequest.HeaderOperation;
  const cookieAction: chrome.declarativeNetRequest.ModifyHeaderInfo = cookieHeader
    ? { header: 'cookie', operation: Op.SET, value: cookieHeader }
    : { header: 'cookie', operation: Op.REMOVE };

  const rule: chrome.declarativeNetRequest.Rule = {
    id: ruleId(tabId),
    priority: 1,
    condition: {
      tabIds: [tabId],
      requestDomains: [domain],
      resourceTypes: RESOURCE_TYPES,
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [cookieAction],
      responseHeaders: [{ header: 'set-cookie', operation: Op.REMOVE }],
    },
  };

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId(tabId)],
    addRules: [rule],
  });
}

export async function clearTabRule(tabId: number): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId(tabId)],
  });
}

/** Remove every rule we own — used when wiping all bindings. */
export async function clearAllRules(): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  if (existing.length) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map((r) => r.id),
    });
  }
}
