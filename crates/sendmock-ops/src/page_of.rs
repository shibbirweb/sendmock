use schemars::JsonSchema;
use serde::Serialize;

/// One page of a list; `next_cursor` continues after its last item, null on the last page.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct PageOf<Item: JsonSchema> {
    pub items: Vec<Item>,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub next_cursor: Option<String>,
    pub total_count: u64,
}
