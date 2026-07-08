# Examples — sanitized code from a working build

Real code from a Salesforce Agentforce **Agent Script** service agent ("Primo", a food-delivery
demo) with a custom React chat over the Agent API. These are **excerpts** to illustrate the pattern,
not a runnable project. Follow [`../guide/RECIPE.md`](../guide/RECIPE.md) to apply them to your own agent.

**Connect layer** — how the custom chat reaches the agent (see [`../guide/CONNECT.md`](../guide/CONNECT.md)):

| File | Layer | What it shows |
|---|---|---|
| [`apex/PrimoAgentProxy.cls`](apex/PrimoAgentProxy.cls) | **0a. Proxy** | `@RestResource(urlMapping='/primo/*')` that mints a `client_credentials` token, relays `/session` + `/message` to the Agent API, reads secrets from Custom Metadata (never source), and normalizes the reply to `[{text}]`. Includes a `@TestVisible` config seam for unit tests. |
| [`react/primoAgent.ts`](react/primoAgent.ts) | **0b. Client transport** | Calls the proxy **same-origin** with `credentials:'omit'` (guest identity → avoids the 401) under the **site path prefix**, then hands the reply text to `parseCards()`. The two Experience-Cloud gotchas live here. |

**Card layer** — the three layers of the marker pattern:

| File | Layer | What it shows |
|---|---|---|
| [`apex/BuildOrderSummary.cls`](apex/BuildOrderSummary.cls) | **1. Server** | An `@InvocableMethod` that computes data and emits `cardJson` (`{"type":"orderSummary",…}`); `null` when there's no data. |
| [`agent-script/chef-and-guardian.agent.txt`](agent-script/chef-and-guardian.agent.txt) | **2. Agent** | The `CARD RENDERING` instruction (echo `cardJson` inside `[[PRIMO_CARD]]…`) and an action declaring the `cardJson` output. |
| [`react/primoCards.ts`](react/primoCards.ts) | **3a. Client parser** | Card types + `parseCards()`: regex the marker, `JSON.parse`, validate `type`, strip the marker from the visible text. Tolerant of malformed JSON. |
| [`react/PrimoCards.tsx`](react/PrimoCards.tsx) | **3b. Client renderer** | A `switch (card.type)` mapping each card to a pre-built, on-brand component. |

Notes:
- Object/field names (`Menu_Item__c`, brand tokens like `pronto-speed`, the `[[PRIMO_CARD]]` marker
  name, the `/prontovforcesite` site path prefix) are project-specific — **rename to yours**.
- `PrimoCards.tsx` uses project Tailwind tokens (`pronto-*`) and `@/` import aliases — it's
  illustrative styling; adapt to your design system.
- The Apex example is the cleanest standalone one (it only reads a catalog object). Other actions in
  the real build (`GetDeliveryTracking`, refund services, meal carousel) follow the exact same
  `cardJson` shape convention.
