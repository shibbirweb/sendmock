-- Payment flows, methods and gateways that differ from what SendMock ships: an edited
-- built-in (its whole definition, so Reset to default deletes the row) or a custom one. The
-- built-ins themselves are embedded in the binary.
CREATE TABLE payment_definitions (
    kind TEXT NOT NULL,
    definition_key TEXT NOT NULL,
    definition TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (kind, definition_key)
) STRICT;
