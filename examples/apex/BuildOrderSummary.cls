public with sharing class BuildOrderSummary {
    // PRE-ORDER confirmation action: given the items the customer chose, compute prices/total
    // from the catalog and return a summary card so the agent can confirm BEFORE placing.
    // This action does NOT create an order (that is place_order / PlaceOrder).

    public class Request {
        @InvocableVariable(label='Items' description='The chosen items, comma or semicolon separated' required=true)
        public String items;
        @InvocableVariable(label='Total' description='Optional total; if blank it is computed from the catalog')
        public String total;
    }

    public class Result {
        @InvocableVariable(label='Summary Text' description='Displayable bullet summary of the pre-order')
        public String summaryText;
        // Additive output for the custom React chat (Agent API path). The agent appends this
        // verbatim inside the [[PRIMO_CARD]] marker; the client parser routes it by `type`.
        @InvocableVariable(label='Card Json' description='Structured JSON for the custom React order-summary card. Echo verbatim inside the [[PRIMO_CARD]] marker; never narrate it.')
        public String cardJson;
    }

    // Deterministic demo delivery address (same as PlaceOrder — no address on the Contact).
    private static final String DELIVERY_ADDRESS = '742 Elm Street, Apt 3B, Dallas, TX 75201';

    @InvocableMethod(
        label='Build Order Summary'
        description='Computes prices/total for the chosen items and returns a pre-order summary card (does NOT place the order)'
    )
    public static List<Result> run(List<Request> requests) {
        List<Result> out = new List<Result>();
        for (Request req : requests) {
            out.add(build(req));
        }
        return out;
    }

    @TestVisible
    private static Result build(Request req) {
        Result r = new Result();

        // Compute total from the catalog and build per-item lines + structured items (same
        // pricing logic as PlaceOrder: Menu_Item__c where Available__c = true, match by
        // lowercased Name, sum Price__c).
        Decimal computed = 0;
        Boolean matchedAny = false;
        List<String> priced = new List<String>();
        List<Object> itemsJson = new List<Object>();
        if (String.isNotBlank(req.items)) {
            List<String> names = req.items.replace(';', ',').split(',');
            Map<String, Decimal> priceByName = new Map<String, Decimal>();
            for (Menu_Item__c mi : [
                SELECT Name, Price__c FROM Menu_Item__c WHERE Available__c = true
            ]) {
                if (mi.Price__c != null) priceByName.put(mi.Name.toLowerCase(), mi.Price__c);
            }
            for (String n : names) {
                String display = n == null ? '' : n.trim();
                if (String.isBlank(display)) continue;
                String key = display.toLowerCase();
                if (priceByName.containsKey(key)) {
                    Decimal p = priceByName.get(key);
                    computed += p;
                    matchedAny = true;
                    priced.add('   - ' + display + ' — €' + p.setScale(2));
                    itemsJson.add(new Map<String, Object>{
                        'name' => display,
                        'price' => String.valueOf(p.setScale(2))
                    });
                } else {
                    // extra not in catalog (e.g. a drink): include with price omitted/null.
                    priced.add('   - ' + display);
                    itemsJson.add(new Map<String, Object>{
                        'name' => display,
                        'price' => null
                    });
                }
            }
        }

        Decimal amount = null;
        if (String.isNotBlank(req.total)) {
            amount = Decimal.valueOf(req.total.replace('€', '').trim());
        } else if (matchedAny) {
            amount = computed;
        }
        String totalStr = (amount == null) ? '0.00' : String.valueOf(amount.setScale(2));
        String totalDisplay = (amount == null) ? 'to be confirmed' : '€' + amount.setScale(2);

        // Deterministic ETA for the demo (25-40 min), derived from the items text so a given
        // basket yields a stable estimate before the order id exists.
        Integer seed = String.isBlank(req.items) ? 0 : Math.abs(req.items.hashCode());
        Integer etaMin = 25 + Math.mod(seed, 16);
        String eta = etaMin + ' minutes';

        r.summaryText = 'Here\'s your order summary — confirm to place it:\n'
            + '• Items:\n' + String.join(priced, '\n') + '\n'
            + '• Total: ' + totalDisplay + '\n'
            + '• Delivery address: ' + DELIVERY_ADDRESS + '\n'
            + '• Estimated delivery: ~' + eta;

        // Custom React chat payload: only emitted when there are items (no card on empty).
        r.cardJson = itemsJson.isEmpty()
            ? null
            : JSON.serialize(new Map<String, Object>{
                'type' => 'orderSummary',
                'items' => itemsJson,
                'total' => totalStr,
                'deliveryAddress' => DELIVERY_ADDRESS,
                'eta' => eta
            });
        return r;
    }
}
