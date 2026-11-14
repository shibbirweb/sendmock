use std::collections::BTreeMap;

use crate::{OperationContext, OperationError};

/// Endpoint names by id and ids by name, as seed files refer to endpoints by name.
pub struct EndpointNames {
    names_by_id: BTreeMap<String, String>,
}

impl EndpointNames {
    pub async fn load(operation_context: &OperationContext) -> Result<Self, OperationError> {
        let stored_endpoints = operation_context
            .webhook_endpoint_repository
            .list_endpoints()
            .await?;
        Ok(Self {
            names_by_id: stored_endpoints
                .into_iter()
                .map(|stored_endpoint| (stored_endpoint.endpoint_id, stored_endpoint.name))
                .collect(),
        })
    }

    pub fn find_name(&self, endpoint_id: &str) -> Option<String> {
        self.names_by_id.get(endpoint_id).cloned()
    }

    /// The id of the endpoint the file names, or why the file cannot use it.
    pub fn find_id(&self, endpoint_name: &str) -> Result<String, OperationError> {
        self.names_by_id
            .iter()
            .find(|(_, stored_name)| stored_name.as_str() == endpoint_name.trim())
            .map(|(endpoint_id, _)| endpoint_id.clone())
            .ok_or_else(|| OperationError::InvalidInput {
                message: format!("No webhook endpoint named \"{endpoint_name}\"; add it under [[webhook.endpoints]]"),
                field: Some("endpoint".to_owned()),
            })
    }
}
