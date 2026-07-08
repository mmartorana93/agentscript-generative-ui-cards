/**
 * PrimoAgentProxy — same-origin REST proxy that fronts the Agentforce Agent API
 * (api.salesforce.com/einstein/ai-agent/v1) for the custom Primo chat UI in the
 * ProntoPortal Experience Cloud site.
 *
 * Why a proxy: browser JS cannot call api.salesforce.com directly (CORS/CSP), and
 * the OAuth Consumer Secret must never reach the client. The React chat calls this
 * class same-origin at /services/apexrest/primo/* ; the class holds the secret,
 * mints a Client Credentials token per request, and relays to the Agent API.
 *
 * Connection settings live in Agent_API_Config__mdt (label "Primo") so no secret
 * is committed to source. Populate Consumer_Key__c / Consumer_Secret__c in Setup.
 *
 * Endpoints:
 *   POST /services/apexrest/primo/session          -> { ok, sessionId, messages[] }
 *   POST /services/apexrest/primo/message           -> { ok, messages[] }
 *        body: { "sessionId": "...", "text": "...", "sequenceId": 1 }
 */
@RestResource(urlMapping='/primo/*')
global with sharing class PrimoAgentProxy {

    static final String API_BASE = 'https://api.salesforce.com/einstein/ai-agent/v1';

    // ---- Routing --------------------------------------------------------------

    @HttpPost
    global static void handlePost() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        res.addHeader('Content-Type', 'application/json');

        String path = req.requestURI == null ? '' : req.requestURI;
        String action = path.substringAfterLast('/').toLowerCase();
        String body = req.requestBody == null ? '' : req.requestBody.toString();

        try {
            Config cfg = loadConfig();
            if (cfg == null) {
                writeError(res, 500, 'Agent API is not configured. Set Agent_API_Config__mdt (Primo) with the Consumer Key/Secret.');
                return;
            }
            String token = getAccessToken(cfg);
            if (String.isBlank(token)) {
                writeError(res, 502, 'Could not obtain an access token. Check the External Client App Run-As user and credentials.');
                return;
            }

            if (action == 'session') {
                createSession(res, cfg, token);
            } else if (action == 'message') {
                sendMessage(res, cfg, token, body);
            } else {
                writeError(res, 404, 'Unknown endpoint "' + action + '". Use /primo/session or /primo/message.');
            }
        } catch (Exception e) {
            writeError(res, 500, e.getMessage());
        }
    }

    // ---- Agent API calls ------------------------------------------------------

    static void createSession(RestResponse res, Config cfg, String token) {
        HttpRequest r = new HttpRequest();
        r.setEndpoint(API_BASE + '/agents/' + cfg.agentId + '/sessions');
        r.setMethod('POST');
        r.setHeader('Authorization', 'Bearer ' + token);
        r.setHeader('Content-Type', 'application/json');
        r.setTimeout(60000);
        r.setBody(JSON.serialize(new Map<String, Object>{
            'externalSessionKey' => 'pronto-' + String.valueOf(Crypto.getRandomLong()),
            'instanceConfig' => new Map<String, Object>{ 'endpoint' => cfg.orgUrl }
        }));

        HttpResponse hr = new Http().send(r);
        Integer code = hr.getStatusCode();
        if (code == 200 || code == 201) {
            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(hr.getBody());
            Map<String, Object> out = new Map<String, Object>{
                'ok' => true,
                'sessionId' => (String) parsed.get('sessionId'),
                'messages' => extractMessages(parsed)
            };
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(out));
        } else {
            writeError(res, code, hr.getBody());
        }
    }

    static void sendMessage(RestResponse res, Config cfg, String token, String body) {
        Map<String, Object> in0 = String.isBlank(body)
            ? new Map<String, Object>()
            : (Map<String, Object>) JSON.deserializeUntyped(body);
        String sessionId = (String) in0.get('sessionId');
        String text = (String) in0.get('text');
        Integer seq = in0.get('sequenceId') == null ? 1 : Integer.valueOf(in0.get('sequenceId'));

        if (String.isBlank(sessionId) || String.isBlank(text)) {
            writeError(res, 400, 'Both "sessionId" and "text" are required.');
            return;
        }

        HttpRequest r = new HttpRequest();
        r.setEndpoint(API_BASE + '/sessions/' + sessionId + '/messages');
        r.setMethod('POST');
        r.setHeader('Authorization', 'Bearer ' + token);
        r.setHeader('Content-Type', 'application/json');
        r.setTimeout(120000);
        r.setBody(JSON.serialize(new Map<String, Object>{
            'message' => new Map<String, Object>{
                'type' => 'Text',
                'text' => text,
                'sequenceId' => seq
            }
        }));

        HttpResponse hr = new Http().send(r);
        Integer code = hr.getStatusCode();
        if (code == 200 || code == 201) {
            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(hr.getBody());
            Map<String, Object> out = new Map<String, Object>{
                'ok' => true,
                'messages' => extractMessages(parsed)
            };
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(out));
        } else {
            writeError(res, code, hr.getBody());
        }
    }

    // ---- OAuth ----------------------------------------------------------------

    static String getAccessToken(Config cfg) {
        HttpRequest r = new HttpRequest();
        r.setEndpoint(cfg.orgUrl + '/services/oauth2/token');
        r.setMethod('POST');
        r.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        r.setTimeout(30000);
        r.setBody(
            'grant_type=client_credentials' +
            '&client_id=' + EncodingUtil.urlEncode(cfg.clientId, 'UTF-8') +
            '&client_secret=' + EncodingUtil.urlEncode(cfg.clientSecret, 'UTF-8')
        );
        HttpResponse hr = new Http().send(r);
        if (hr.getStatusCode() == 200) {
            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(hr.getBody());
            return (String) parsed.get('access_token');
        }
        return null;
    }

    // ---- Helpers --------------------------------------------------------------

    /** Normalizes the Agent API messages array into [{ text }] for the UI, keeping only non-blank text replies. */
    static List<Object> extractMessages(Map<String, Object> parsed) {
        List<Object> out = new List<Object>();
        Object raw = parsed.get('messages');
        if (raw instanceof List<Object>) {
            for (Object m : (List<Object>) raw) {
                if (m instanceof Map<String, Object>) {
                    Map<String, Object> msg = (Map<String, Object>) m;
                    String txt = (String) msg.get('message');
                    if (String.isNotBlank(txt)) {
                        out.add(new Map<String, Object>{ 'text' => txt });
                    }
                }
            }
        }
        return out;
    }

    static void writeError(RestResponse res, Integer status, String detail) {
        res.statusCode = (status == null || status <= 0) ? 500 : status;
        res.responseBody = Blob.valueOf(JSON.serialize(new Map<String, Object>{
            'ok' => false,
            'status' => res.statusCode,
            'error' => detail
        }));
    }

    @TestVisible
    class Config {
        String orgUrl;
        String clientId;
        String clientSecret;
        String agentId;
    }

    // Test seam: CMDT rows cannot be inserted in unit tests, so tests inject a Config here.
    @TestVisible
    static Config configOverride;

    static Config loadConfig() {
        if (configOverride != null) return configOverride;
        List<Agent_API_Config__mdt> rows = [
            SELECT Org_My_Domain_URL__c, Consumer_Key__c, Consumer_Secret__c, Agent_Id__c
            FROM Agent_API_Config__mdt
            WHERE Active__c = true
            LIMIT 1
        ];
        if (rows.isEmpty()) return null;
        Agent_API_Config__mdt row = rows[0];
        if (String.isBlank(row.Consumer_Key__c) || String.isBlank(row.Consumer_Secret__c)) return null;
        Config c = new Config();
        c.orgUrl = (row.Org_My_Domain_URL__c == null ? '' : row.Org_My_Domain_URL__c).removeEnd('/');
        c.clientId = row.Consumer_Key__c;
        c.clientSecret = row.Consumer_Secret__c;
        c.agentId = row.Agent_Id__c;
        return c;
    }
}
