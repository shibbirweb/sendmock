-- Saved deliveries (WH-10): a named copy of a delivery's request, kept apart from the delivery
-- log so pruning and `reset` leave it alone. `request` is the request before signing, as JSON;
-- `event` is the event it carried, so a send can render it again (NULL when the delivery came
-- from before events were kept). `endpoint_id` turns NULL when that endpoint is deleted.
CREATE TABLE saved_webhook_deliveries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    endpoint_id TEXT,
    event_type TEXT,
    event TEXT,
    template_id TEXT NOT NULL,
    request TEXT NOT NULL,
    saved_at INTEGER NOT NULL
);
