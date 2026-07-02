---
name: agentscript-generative-ui-cards
description: >
  Add rich, branded graphic "cards" (controlled generative UI) to a custom chat driven by a
  Salesforce Agentforce Agent Script agent over the Agent API — a channel that natively returns
  text only. Implements the marker convention: an Apex/Flow action emits a compact cardJson, the
  agent echoes it verbatim inside a [[PRIMO_CARD]] marker, and the frontend parses the marker and
  renders a pre-built component. Server owns the data; the model only picks the component.
  TRIGGER when: the user wants graphic cards / rich components / generative UI in a CUSTOM chat
  (React/mobile/embedded) backed by an Agent Script agent via the Agent API, or asks to reproduce
  "the card pattern". DO NOT TRIGGER when: using the native MIAW / Enhanced Web Chat widget with
  CLT (that renders natively), or a CopilotKit/Node stack (use useComponent()).
license: MIT
metadata:
  version: "1.0.0"
  source: "https://www.deeplearning.ai/courses/build-interactive-agents-with-generative-ui"
---

# agentscript-generative-ui-cards

Reproduce **controlled generative UI** on a Salesforce **Agent Script** agent whose replies are
consumed by a **custom chat** over the **Agent API** (`/einstein/ai-agent/v1`). That API returns
plain text, so native CLT components don't render there. This skill wires a transport-agnostic
**marker convention** so your own frontend renders branded cards.

Concept & full write-up: see the repo `README.md` and `guide/RECIPE.md`. Working, sanitized code is
in `examples/`.

## Prerequisites (verify first)
1. `sf config get target-org --json` returns an org; if not, ask the user to set one.
2. There is an existing Agent Script bundle: find the `.agent` file under
   `**/aiAuthoringBundles/<Name>/`. If none, this skill doesn't apply — the user must build the agent
   first.
3. There is a **custom chat client** the user controls (React/mobile/etc.) that already receives the
   agent's reply text. If they use the native MIAW widget instead, stop — use native CLT.

## Rules that always apply
- **Always pass `--json`** on every `sf` command; read the JSON directly.
- **Additive only.** Add a new `cardJson` output; never remove or rename existing action outputs or
  change existing agent behavior. If a native CLT output already exists, leave it.
- **Server owns the data.** The JSON must be built in Apex/Flow from real data — never ask the LLM to
  generate the card contents. The model only chooses whether to emit the (pre-computed) card.
- **Text-first.** Only add a card where a visual genuinely helps. Greetings, FAQ/policy answers, and
  clarifying questions stay as text.

## Procedure

### 1. Agree the card contract
With the user, list which agent actions should drive a card and define, for each, a compact JSON
shape with a **`type`** discriminator (e.g. `orderSummary`, `orderTracking`, `refund`). Keep it flat
and small — the model must echo it verbatim.

### 2. Emit `cardJson` from each backing action
For an **Apex** action: add `@InvocableVariable public String cardJson;` to the `Result` class and
populate it with `JSON.serialize(new Map<String,Object>{ 'type' => '<type>', … })` from the data the
method already computes. Set it to `null` when there's no data. Deploy the class.
For a **Flow** action: add an **output variable** `cardJson` and assign the JSON inside the Flow (the
agent's output schema must match the Flow, or publish fails).
Reference: `examples/apex/BuildOrderSummary.cls`.

### 3. Wire the Agent Script
In the `.agent` file, for each such action:
- add the output to its `outputs:` block:
  ```
  cardJson: string
      description: "Structured JSON for the custom chat card. Append verbatim inside the [[PRIMO_CARD]] marker; never narrate it."
      is_displayable: True
  ```
- add a **CARD RENDERING** instruction to the sub-agent that calls it (see `guide/RECIPE.md` Step 2 or
  `examples/agent-script/chef-and-guardian.agent.txt`): when the action returns a non-empty `cardJson`,
  append it verbatim at the end wrapped in `[[PRIMO_CARD]]…[[/PRIMO_CARD]]`, at most once, never
  narrated, never when empty.
Keep internal-only fields `filter_from_agent: True`.

### 4. Publish and verify the marker
```
sf agent validate authoring-bundle --json --api-name <Name>
sf agent publish  authoring-bundle --json --api-name <Name>
sf agent activate --json --api-name <Name> --version <N>
```
Then `sf agent preview start --use-live-actions …` + `sf agent preview send …` and confirm the reply
contains `[[PRIMO_CARD]]{…}[[/PRIMO_CARD]]`.
**If the publish regenerated the `GenAiPlannerBundle` without your external surface** (custom chat
stops responding), retrieve `GenAiPlannerBundle:<Name>_v<N>`, re-add the `<plannerSurfaces>` block
(e.g. `CustomerWebClient`) before `<plannerType>`, deploy it, then activate. This must be redone after
**every** publish.

### 5. Parse in the client
Add a tolerant parser: regex out `[[PRIMO_CARD]]…[[/PRIMO_CARD]]`, `JSON.parse`, validate `type`
against a known set, **strip the marker from the visible text**, return `{ text, cards }`. Malformed
JSON is skipped without breaking the text. Reference: `examples/react/primoCards.ts`.

### 6. Render the components
A single `switch (card.type)` maps each type to a pre-built, on-brand component, rendered beneath the
message. Unknown types render nothing. Reference: `examples/react/PrimoCards.tsx`.

### 7. End-to-end check
Trigger each action in the live chat → card renders, no marker/JSON visible. Plain greeting → text
only. Malformed payload → card skipped, text intact.

## Common failures
| Symptom | Cause | Fix |
|---|---|---|
| Publish fails: "property `cardJson` not found in schema" | Action is a **Flow**, output not declared there | Add `cardJson` as a Flow output variable + assign it |
| Raw JSON / marker visible in chat | Client not parsing/stripping | Implement Step 5 parser; ensure it runs on every reply |
| Card never appears | Marker not emitted | Check `is_displayable: True` + the CARD RENDERING instruction; verify via `agent preview` |
| Custom chat stops responding after publish | Planner lost `<plannerSurfaces>` | Re-patch the surface block into the new planner bundle, deploy, activate |
| Card appears for greetings too | Over-eager instruction | Emit "at most once" and "never when cardJson is empty/absent"; return `null` server-side |
