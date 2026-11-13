/// The webhook endpoints one action chose for its events, instead of the ones the rules pick
/// (WH-13.4). It travels on the request and on each event the request publishes, so two
/// actions running at once never see each other's choice.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WebhookChoice {
    /// Every chosen endpoint gets one delivery per event; none chosen sends no webhook.
    pub endpoint_ids: Vec<String>,
}
