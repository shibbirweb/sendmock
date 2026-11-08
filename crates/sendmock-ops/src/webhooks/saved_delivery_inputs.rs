use schemars::JsonSchema;
use serde::Deserialize;

/// `POST /api/v1/webhooks/saved` (WH-10.1).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SavedDeliveryInput {
    /// A name for the saved delivery.
    pub name: String,
    /// The delivery to save.
    pub delivery_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SavedDeliveryReference {
    /// The saved delivery's ID, from `GET /api/v1/webhooks/saved`.
    pub saved_id: String,
}

/// `PATCH /api/v1/webhooks/saved/{savedId}` (WH-10.4).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SavedDeliveryRename {
    /// The saved delivery's ID, from `GET /api/v1/webhooks/saved`.
    pub saved_id: String,
    /// The new name.
    pub name: String,
}

/// `POST /api/v1/webhooks/saved/{savedId}/send` (WH-10.2).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SavedDeliverySendRequest {
    /// The saved delivery's ID, from `GET /api/v1/webhooks/saved`.
    pub saved_id: String,
    /// The endpoint to send it to.
    pub endpoint_id: String,
    /// Renders again with the endpoint's template and variables; false sends the saved request as it was.
    pub rerender: bool,
}

/// `POST /api/v1/webhooks/saved/{savedId}/template` (WH-10.2).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct SaveAsTemplateRequest {
    /// The saved delivery's ID, from `GET /api/v1/webhooks/saved`.
    pub saved_id: String,
    /// The name of the new custom template.
    pub name: String,
}
