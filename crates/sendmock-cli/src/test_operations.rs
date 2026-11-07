use schemars::JsonSchema;
use sendmock_ops::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    OperationRegistry, SuccessStatus,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
pub struct ItemListQuery {
    pub limit: Option<i64>,
    pub is_unread: Option<bool>,
    pub tags: Option<Vec<String>>,
}

pub struct ListItemsOperation;

impl Operation for ListItemsOperation {
    type Input = ItemListQuery;
    type Output = ItemListQuery;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "testListItems",
            path: "/api/v1/test/items",
            summary: "Lists nothing.",
            is_read_only: true,
            cli_usage: "sendmock test list",
            mcp_tool: "sendmock_test_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        input: ItemListQuery,
    ) -> Result<ItemListQuery, OperationError> {
        Ok(input)
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ItemReference {
    pub item_id: String,
}

pub struct DeleteItemOperation;

impl Operation for DeleteItemOperation {
    type Input = ItemReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "testDeleteItem",
            method: HttpMethod::Delete,
            path: "/api/v1/test/items/{itemId}",
            summary: "Deletes nothing.",
            is_destructive: true,
            cli_usage: "sendmock test delete <itemId>",
            mcp_tool: "sendmock_test_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        input: ItemReference,
    ) -> Result<NoContent, OperationError> {
        if input.item_id.is_empty() {
            return Err(OperationError::NotFound {
                message: "No item without an id".to_owned(),
            });
        }
        Ok(NoContent)
    }
}

pub fn build_test_registry() -> OperationRegistry {
    let mut operation_registry = OperationRegistry::default();
    operation_registry.register(ListItemsOperation);
    operation_registry.register(DeleteItemOperation);
    operation_registry
}
