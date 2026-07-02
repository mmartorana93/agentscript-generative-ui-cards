# Examples — sanitized code from a working build

Real code from a Salesforce Agentforce **Agent Script** service agent ("Primo", a food-delivery
demo) with a custom React chat over the Agent API. These are **excerpts** to illustrate the pattern,
not a runnable project. Follow [`../guide/RECIPE.md`](../guide/RECIPE.md) to apply them to your own agent.

The three layers of the marker pattern:

| File | Layer | What it shows |
|---|---|---|
| [`apex/BuildOrderSummary.cls`](apex/BuildOrderSummary.cls) | **1. Server** | An `@InvocableMethod` that computes data and emits `cardJson` (`{"type":"orderSummary",…}`); `null` when there's no data. |
| [`agent-script/chef-and-guardian.agent.txt`](agent-script/chef-and-guardian.agent.txt) | **2. Agent** | The `CARD RENDERING` instruction (echo `cardJson` inside `[[PRIMO_CARD]]…`) and an action declaring the `cardJson` output. |
| [`react/primoCards.ts`](react/primoCards.ts) | **3a. Client parser** | Card types + `parseCards()`: regex the marker, `JSON.parse`, validate `type`, strip the marker from the visible text. Tolerant of malformed JSON. |
| [`react/PrimoCards.tsx`](react/PrimoCards.tsx) | **3b. Client renderer** | A `switch (card.type)` mapping each card to a pre-built, on-brand component. |

Notes:
- Object/field names (`Menu_Item__c`, brand tokens like `pronto-speed`, the `[[PRIMO_CARD]]` marker
  name) are project-specific — rename to yours.
- The Apex example is the cleanest standalone one (it only reads a catalog object). Other actions in
  the real build (`GetDeliveryTracking`, refund services, meal carousel) follow the exact same
  `cardJson` shape convention.
