/**
 * primoAgent — thin client for the custom Primo chat UI.
 *
 * Talks to the same-origin Apex REST proxy (PrimoAgentProxy, urlMapping /primo/*),
 * which fronts the Agentforce Agent API. The browser never sees OAuth secrets or
 * calls api.salesforce.com directly — it only hits Salesforce-origin /services/apexrest.
 *
 * Endpoints:
 *   POST {base}/services/apexrest/primo/session  -> { ok, sessionId, messages }
 *   POST {base}/services/apexrest/primo/message  -> { ok, messages }
 */

import { parseCards, type PrimoCard } from './primoCards';

export interface PrimoMessage {
  text: string;
}

/** A parsed agent turn: display text plus any Controlled Generative UI cards. */
export interface PrimoReply {
  text: string;
  cards: PrimoCard[];
}

interface SessionResponse {
  ok: boolean;
  sessionId?: string;
  messages?: PrimoMessage[];
  error?: string;
  status?: number;
}

interface MessageResponse {
  ok: boolean;
  messages?: PrimoMessage[];
  error?: string;
  status?: number;
}

/**
 * Resolve the apexrest base.
 *
 * ⚠️ REPLACE THIS PREFIX FOR YOUR SITE. On an Experience Cloud site, Apex REST is served
 * under the site's Visualforce path prefix (here "/prontovforcesite") — NOT at the bare
 * origin (returns 403) and NOT under the LWR SPA path like "/yourSite" (owned by the SPA
 * router → returns index.html). Find your prefix in Setup → Digital Experiences → your site
 * (or query Site.UrlPathPrefix). Verified shape:
 *   POST /<sitePathPrefix>/services/apexrest/primo/session → 200 JSON.
 */
const APEX_SITE_PREFIX = '/prontovforcesite'; // ← change to your site's VF path prefix

function apexRestBase(): string {
  if (typeof window === 'undefined') return `${APEX_SITE_PREFIX}/services/apexrest/primo`;
  return `${window.location.origin}${APEX_SITE_PREFIX}/services/apexrest/primo`;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apexRestBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Force the anonymous (site guest) identity: without this, a logged-in internal
    // user's session cookie is attached and the community rejects it with 401. The
    // guest user already has PrimoAgentProxy access, and real visitors are anonymous.
    credentials: 'omit',
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Primo returned a non-JSON response (${res.status}).`);
  }
  return parsed as T;
}

export async function startPrimoSession(): Promise<{ sessionId: string; greeting?: PrimoReply }> {
  const data = await postJson<SessionResponse>('/session');
  if (!data.ok || !data.sessionId) {
    throw new Error(data.error || 'Could not start a Primo session.');
  }
  const raw = data.messages?.map(m => m.text).filter(Boolean).join('\n\n');
  return {
    sessionId: data.sessionId,
    greeting: raw ? parseCards(raw) : undefined,
  };
}

export async function sendPrimoMessage(
  sessionId: string,
  text: string,
  sequenceId: number
): Promise<PrimoReply> {
  const data = await postJson<MessageResponse>('/message', { sessionId, text, sequenceId });
  if (!data.ok) {
    throw new Error(data.error || 'Primo could not answer right now.');
  }
  const raw = data.messages?.map(m => m.text).filter(Boolean).join('\n\n');
  const parsed = parseCards(raw || '');
  if (!parsed.text && parsed.cards.length === 0) {
    return { text: "I'm here, but I didn't catch a reply. Could you rephrase?", cards: [] };
  }
  return parsed;
}
