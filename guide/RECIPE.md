# Recipe: add generative-UI cards to an Agent Script agent + custom chat

A step-by-step guide to reproduce the **controlled generative UI** pattern (marker convention) on
your own Salesforce Agentforce **Agent Script** agent, consumed by a **custom chat** over the Agent
API. See [`../README.md`](../README.md) for the concept.

Prerequisites:
- An Agent Script agent (`AiAuthoringBundle`) already working and returning text in your custom chat.
- A custom chat client you control (this guide uses React; any client that receives the reply text works).
- Salesforce CLI (`sf`), and the ability to publish/activate the agent.

---

## Step 0 — Design the card contract

Decide, up front, the JSON shape for each card and a **`type` discriminator**. Keep it compact.
Example set (from the reference build):

| `type` | Emitted by | Payload (illustrative) |
|---|---|---|
| `mealCarousel` | a recommendation action | `{type,title,subtitle,meals:[{name,category,imageUrl,tags,badge}]}` |
| `orderSummary` | a "price the basket" action | `{type,items:[{name,price}],total,deliveryAddress,eta}` |
| `orderConfirmation` | the place-order action | `{type,orderId,items:[...],total,deliveryAddress,eta}` |
| `orderTracking` | an order-status action | `{type,orderId,restaurant,driver,etaMinutes,minutesLate,isLate,total}` |
| `refund` | a refund action | `{type,kind,decision,amount,orderTotal,voucher,limit}` |

Rule of thumb: **text where text is enough; a card only where a visual genuinely helps.** Greetings,
policy/FAQ answers, clarifying questions → leave as text.

---

## Step 1 — Emit `cardJson` from the action (server-side)

In each backing **Apex** action (or Flow), add **one extra output**: a `String cardJson`. Build it
from the data the action already computes — never from model text.

```apex
public class Result {
    // …existing outputs…
    @InvocableVariable(
        label='Card Json'
        description='Structured JSON for the custom chat card. Echo verbatim inside the [[PRIMO_CARD]] marker; never narrate it.')
    public String cardJson;
}

// …inside the method, after you've computed the data:
r.cardJson = itemsJson.isEmpty()
    ? null                                   // no data → no card
    : JSON.serialize(new Map<String, Object>{
        'type'  => 'orderSummary',           // the discriminator the client switches on
        'items' => itemsJson,
        'total' => totalStr,
        'deliveryAddress' => address,
        'eta'   => eta
    });
```

Guidelines:
- Set `cardJson = null` when there's no data → the client shows text only.
- Keep the JSON **flat and small**. The LLM has to echo it verbatim; smaller = more reliable.
- If the action is a **Flow**, add an output variable and assign the JSON there (see Gotchas).

See [`../examples/apex/BuildOrderSummary.cls`](../examples/apex/BuildOrderSummary.cls).

---

## Step 2 — Declare the output + instruct the agent (Agent Script)

In the `.agent` file, for each action that emits a card:

**(a)** declare `cardJson` as a **displayable** output:

```
outputs:
    # …existing outputs…
    cardJson: string
        description: "Structured JSON for the custom chat card. Append verbatim inside the [[PRIMO_CARD]] marker; never narrate it."
        is_displayable: True
```

**(b)** add a **CARD RENDERING** instruction to the sub-agent that calls it:

```
CARD RENDERING (custom web chat): when <action_a>, <action_b> or <action_c> returns a
non-empty cardJson value, append that value EXACTLY as returned — unchanged, not summarized —
on a new line at the very end of your reply, wrapped like this:
[[PRIMO_CARD]]<the cardJson value>[[/PRIMO_CARD]]. Emit it at most once per turn. Never mention
the marker or the JSON to the customer, and never write the marker when cardJson is empty or absent.
```

Notes:
- Pick a marker unlikely to collide with normal text. `[[PRIMO_CARD]]…[[/PRIMO_CARD]]` (ASCII) is
  safer than fancy Unicode brackets across encodings.
- `is_displayable: True` lets the value reach the model so it can echo it; the instruction tells it
  **not to narrate** it. (Keep purely-internal fields `filter_from_agent: True`.)
- If the agent also emits a **native CLT** for the same action, leave it — this is **additive**.

See [`../examples/agent-script/chef-and-guardian.agent.txt`](../examples/agent-script/chef-and-guardian.agent.txt).

---

## Step 3 — Validate, publish, activate

```bash
sf agent validate authoring-bundle --json --api-name <YourAgent>
sf agent publish  authoring-bundle --json --api-name <YourAgent>     # creates a new version
sf agent activate --json --api-name <YourAgent> --version <N>
```

Confirm the marker actually appears before touching the UI:

```bash
sf agent preview start --json --use-live-actions --authoring-bundle <YourAgent>
sf agent preview send  --json --authoring-bundle <YourAgent> --session-id <ID> -u "…utterance…"
# look for [[PRIMO_CARD]]{…}[[/PRIMO_CARD]] in the reply
```

---

## Step 4 — Parse the marker in the client

Extract the blocks, validate the `type`, strip the marker from the visible text, return `{text, cards}`.

```ts
const CARD_MARKER = /\[\[PRIMO_CARD\]\]([\s\S]*?)\[\[\/PRIMO_CARD\]\]/g;
const KNOWN_TYPES = new Set(['orderSummary', 'orderConfirmation', /* … */]);

export function parseCards(raw: string): { text: string; cards: Card[] } {
  const cards: Card[] = [];
  let m: RegExpExecArray | null;
  CARD_MARKER.lastIndex = 0;
  while ((m = CARD_MARKER.exec(raw)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim());
      if (obj && typeof obj.type === 'string' && KNOWN_TYPES.has(obj.type)) cards.push(obj);
    } catch { /* malformed → skip, text still shows */ }
  }
  const text = raw.replace(CARD_MARKER, '').replace(/\n{3,}/g, '\n\n').trim();
  return { text, cards };
}
```

Key properties: **tolerant** (bad JSON is skipped, never crashes the chat) and **invisible**
(the marker is removed from what the user reads).

See [`../examples/react/primoCards.ts`](../examples/react/primoCards.ts).

---

## Step 5 — Render the components

A single switch maps `type` → your pre-built component:

```tsx
function CardView({ card }: { card: Card }) {
  switch (card.type) {
    case 'orderSummary':      return <OrderSummaryCard card={card} />;
    case 'orderConfirmation': return <OrderConfirmationCard card={card} />;
    // …
    default: return null;   // unknown type → render nothing
  }
}
```

Render the cards **beneath** the message bubble. Style them with your design system so they read as
part of the same experience.

See [`../examples/react/PrimoCards.tsx`](../examples/react/PrimoCards.tsx).

---

## Verify end-to-end

1. In the live chat, send an utterance that should trigger each action.
2. Confirm: the human sentence shows, the card renders below it, and **no marker/JSON is visible**.
3. Send a plain greeting → **text only**, no card (regression check).
4. Force a malformed payload (temporarily) → the card is skipped, the text still shows (robustness).

---

## Gotchas & tips

- **Flow-backed actions.** If an action's `target` is a Flow (not Apex), the `.agent` output schema
  must match the **Flow's** outputs — add `cardJson` as a Flow **output variable** and assign the
  JSON inside the Flow, or the `publish` will fail with a "property not found" schema error.
- **Publish drops planner surfaces.** On some orgs, `sf agent publish` regenerates the
  `GenAiPlannerBundle` **without** the `<plannerSurfaces>` block that enables your external client
  surface (e.g. `CustomerWebClient`). If your custom chat stops getting responses after a publish,
  retrieve the new planner bundle, re-add the `<plannerSurfaces>` block before `<plannerType>`, deploy
  it, then activate.
- **Keep the JSON tiny.** Long payloads are more likely to be truncated/altered by the model. Send
  only what the card renders; look values up client-side if needed.
- **One marker per turn.** Instruct "at most once" to avoid duplicate cards.
- **Don't rely on `messages[].result`.** The Agent API's structured `result[]` is not reliably
  populated for custom-client surfaces — that's *why* we route the payload through text.
