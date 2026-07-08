# Connect: custom chat → Agent Script agent (via the Agent API)

The **prerequisite half** of this repo. Before you can render cards ([`RECIPE.md`](RECIPE.md)),
your custom chat has to actually reach the agent and get its reply text back. This guide is the
"connect" layer: **browser → same-origin Apex proxy → OAuth → Agent API → agent → text back**.

> Why a proxy (not a direct browser call)? The browser **cannot** call `api.salesforce.com`
> directly (CORS/CSP), and the OAuth **Consumer Secret must never reach the client**. An Apex
> `@RestResource` sits same-origin, holds the secret, mints a token, and relays to the Agent API.
>
> If you instead use the **native MIAW / Enhanced Web Chat widget**, you don't need any of this —
> use native CLT. This guide is only for a **custom** chat (React/mobile/embedded) on the Agent API.

Reference code: [`../examples/apex/PrimoAgentProxy.cls`](../examples/apex/PrimoAgentProxy.cls) and
[`../examples/react/primoAgent.ts`](../examples/react/primoAgent.ts).

---

## Step 1 — External Client App (OAuth client credentials)

Setup → **App Manager → New External Client App**. Enable OAuth; Callback URL `https://localhost` (placeholder, unused by client credentials).

**OAuth scopes — add exactly these four:**

| Scope | API name |
|---|---|
| Manage user data via APIs | `api` |
| Perform requests at any time | `refresh_token` |
| Access chatbot services | `chatbot_api` |
| Access the Salesforce API Platform | `sfap_api` |

> ⚠️ Missing `chatbot_api` or `sfap_api` is a classic **silent failure** for the Agent API.

**Flow / security settings:**

| Setting | Value |
|---|---|
| Enable Client Credentials Flow | ✅ Checked |
| Issue JSON Web Token (JWT)-based access tokens | ✅ Checked |
| Require Proof Key for Code Exchange (PKCE) | ☐ Unchecked |
| Enable for Device Flow | ☐ Unchecked |
| Require Secret for Web Server Flow | ☐ Unchecked |
| Require Secret for Refresh Token Flow | ☐ Unchecked |

Save, then copy the **Consumer Key** and **Consumer Secret** (App → Settings → OAuth Settings → *Consumer Key and Secret*).

## Step 2 — Assign a Run-As user (critical)

App → **Policies** tab → **OAuth Policies** → Enable Client Credentials Flow → **Run As** = a user
with API access **and** Agentforce permission (an admin, or the agent's Einstein user).

> ⚠️ **Without a Run-As user, the token endpoint returns `null` and every call fails.** If you get a
> 502 "could not obtain an access token", this is the first thing to check.

## Step 3 — Store the secrets in Custom Metadata (never in source)

Create a Custom Metadata Type (e.g. `Agent_API_Config__mdt`) with fields:
`Org_My_Domain_URL__c`, `Consumer_Key__c`, `Consumer_Secret__c`, `Agent_Id__c`, `Active__c`.
Add one active record and paste the Key/Secret **in Setup** — they never live in Apex source or the frontend. The proxy reads them at runtime.

Find the **18-char Agent Id** (starts `0Xx`) in Setup → Agents (URL) or via
`SELECT Id, DeveloperName FROM BotDefinition`.

## Step 4 — RemoteSiteSettings (both endpoints)

Apex callouts need **two** allowlisted endpoints — miss either and the callout throws:

| Name | URL | Used for |
|---|---|---|
| Agent API | `https://api.salesforce.com` | the Agent API calls |
| Org My Domain | `https://<your-domain>.my.salesforce.com` | the OAuth token endpoint |

## Step 5 — Deploy the Apex REST proxy

Deploy an `@RestResource(urlMapping='/primo/*')` class that: reads the CMDT config, mints a
`client_credentials` token, and relays `/session` and `/message` to the Agent API — normalizing the
Agent API `messages[]` into `[{ text }]` for the client.

Full reference: [`../examples/apex/PrimoAgentProxy.cls`](../examples/apex/PrimoAgentProxy.cls). Endpoints it exposes:
```
POST /services/apexrest/primo/session   -> { ok, sessionId, messages[] }
POST /services/apexrest/primo/message   -> { ok, messages[] }   body: { sessionId, text, sequenceId }
```

> **Deploy note (`__dlm` / Data Cloud):** if your **card-building** actions query Data Cloud
> objects (`*__dlm`), those callouts **can't run in Apex unit tests** ("external callout not allowed
> in test"), so they can't carry coverage. Deploy them with `--test-level NoTestRun` (dev/trial
> orgs) or keep them thin and test the pure logic separately. The proxy class itself *is* testable —
> use a `@TestVisible` config override to inject fake credentials (see the example) and an
> `HttpCalloutMock`.

## Step 6 — The client transport

The React client calls the proxy **same-origin** and passes the reply text to `parseCards()`
(see [`RECIPE.md`](RECIPE.md)). Reference: [`../examples/react/primoAgent.ts`](../examples/react/primoAgent.ts).

### ⚠️ Three Experience-Cloud gotchas that cost hours

These are not guessable — they're the exact traps we hit:

1. **Apex REST is under the site path prefix, not the bare origin.**
   `POST /<sitePathPrefix>/services/apexrest/primo/message` (e.g. `/prontovforcesite/...`).
   The bare origin returns **403**; the LWR SPA path (`/yourSite`) returns **index.html** (the router
   swallows it). Find the prefix in Setup → Digital Experiences → your site (`Site.UrlPathPrefix`).

2. **`credentials: 'omit'` on the fetch — the "works for me, 401 for everyone" trap.**
   If you're logged into Salesforce, the browser attaches your internal session cookie and the
   community **rejects it with 401**. Real visitors are anonymous (guest), so force the guest
   identity with `credentials: 'omit'`. Then it works for everyone, logged-in or not.

3. **Grant the guest/community profile access to the proxy Apex class.**
   The chat runs as the **Site Guest User**, not the agent user. Without class access,
   `/services/apexrest/primo/*` is unreachable (403 for the guest). Add `PrimoAgentProxy` to the
   guest profile's Apex class access (or a permission set assigned to it).

## Step 7 — Verify

- Anonymous `curl` (simulates the guest) against `.../<prefix>/services/apexrest/primo/session`
  should return `{ ok: true, sessionId, messages }`.
- Send a message; you get back text. **Note:** the Agent API is sessionful but creates **no**
  `MessagingSession` record (that's MIAW-only) — verify via the reply itself, or Agentforce agent
  sessions / debug logs on the Run-As user.

Once text round-trips, you're ready for cards → [`RECIPE.md`](RECIPE.md).

---

## Related

For a broader treatment of connecting any app to an Agentforce agent via the Agent API (all caller
types — Visualforce, LWC, backend, external), see the companion **`sf-agentforce-api`** skill:
<https://gist.github.com/zaehicks/1e9f0cb765397fd11f78031aa577ed3c>. This guide is the
Experience-Cloud + custom-React-chat specialization of that idea, with the gotchas above.
