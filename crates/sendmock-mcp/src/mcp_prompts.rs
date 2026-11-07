//! The ready-made prompts an agent's user picks in the harness; each returns its workflow as
//! instructions naming SendMock's tools (AI-03.3).

use rmcp::model::{Prompt, PromptArgument, PromptMessage, Role};
use serde_json::{Map, Value};

/// One prompt: its arguments and the workflow it asks for, with `{argument}` filled in.
struct PromptRecipe {
    name: &'static str,
    description: &'static str,
    arguments: &'static [(&'static str, &'static str, bool)],
    workflow: &'static str,
}

const PROMPT_RECIPES: [PromptRecipe; 10] = [
    PromptRecipe {
        name: "setup-email-capture",
        description: "Point the app's mail at SendMock and send a test.",
        arguments: &[(
            "stack",
            "The app's stack, such as laravel, express or django.",
            false,
        )],
        workflow: "Find this app's mail settings ({stack}). Call sendmock_status, then sendmock_integration_snippet for the stack and the email channel, change the app's settings to it, send a test email from the app, and confirm it with sendmock_email_latest. If nothing arrives, read sendmock_logs_smtp.",
    },
    PromptRecipe {
        name: "setup-sms-capture",
        description: "Send the app's SMS through SendMock and send a test.",
        arguments: &[("stack", "The app's stack.", false)],
        workflow: "Find the code that sends SMS in this app ({stack}). Call sendmock_integration_snippet for the stack and the sms channel, switch the client to SendMock (the native API or the provider-compatible port), send a test SMS and confirm it with sendmock_sms_wait. If nothing arrives, read sendmock_logs_http.",
    },
    PromptRecipe {
        name: "setup-inbound-webhook",
        description: "Deliver a provider's webhook to the app's handler.",
        arguments: &[
            (
                "provider",
                "The provider whose webhooks the app receives, such as twilio or stripe.",
                true,
            ),
            ("url", "The app's local handler URL.", true),
        ],
        workflow: "Find the {provider} template with sendmock_webhook_template_list, create an endpoint for {url} with sendmock_webhook_endpoint_create, add a rule for the events the app handles with sendmock_webhook_rule_create, make one happen, and check sendmock_webhook_delivery_list for the app's answer.",
    },
    PromptRecipe {
        name: "test-otp-flow",
        description: "Run the app's OTP flow and return the code.",
        arguments: &[(
            "recipient",
            "The email address or phone number the code goes to.",
            true,
        )],
        workflow: "Trigger the app's one-time code flow for {recipient}, wait for the message with sendmock_email_wait or sendmock_sms_wait, read the code with sendmock_otp_get, submit it to the app and confirm the login succeeds.",
    },
    PromptRecipe {
        name: "simulate-sms-conversation",
        description: "Play a two-way SMS exchange against the app's inbound handler.",
        arguments: &[("number", "The app's virtual number.", true)],
        workflow: "Send each customer message to {number} with sendmock_sms_simulate_inbound, wait for the app's reply with sendmock_sms_wait, and check sendmock_sms_threads shows the conversation in order.",
    },
    PromptRecipe {
        name: "debug-failed-webhook",
        description: "Explain the latest failed delivery and replay it once fixed.",
        arguments: &[],
        workflow: "Find the newest failed delivery with sendmock_webhook_delivery_list, read its request and response with sendmock_webhook_delivery_get, explain why the app refused it, suggest the fix, and after the user applies it, replay it with sendmock_webhook_delivery_replay.",
    },
    PromptRecipe {
        name: "add-payment-flow",
        description: "Compose a checkout flow step by step from the provider's docs.",
        arguments: &[(
            "description",
            "The steps, such as wallet number, OTP, then PIN.",
            true,
        )],
        workflow: "Compose this flow: {description}. List the steps with sendmock_payment_step_type_list, create it with sendmock_payment_flow_create, add each step in order with sendmock_payment_flow_step_add, check it with sendmock_payment_flow_get, attach it to a method with sendmock_payment_method_update and run a test checkout.",
    },
    PromptRecipe {
        name: "add-payment-gateway",
        description: "Add a gateway SendMock does not ship, from its docs.",
        arguments: &[("docs_url", "The provider's documentation.", true)],
        workflow: "Read {docs_url}. Create the gateway with sendmock_payment_gateway_create, set its methods, redirect fields, event names and notification templates with sendmock_payment_gateway_update, check sendmock_payment_gateway_preview, run a test checkout with sendmock_payment_create_checkout and sendmock_checkout_complete, and export with sendmock_seed_export.",
    },
    PromptRecipe {
        name: "add-email-provider",
        description: "Add an email API SendMock does not ship, from its docs.",
        arguments: &[("docs_url", "The provider's API documentation.", true)],
        workflow: "Read {docs_url}. Create the provider with sendmock_email_provider_create from the closest built-in, set its requests, field mapping, checks and responses with sendmock_email_provider_update, check sendmock_email_provider_preview, send a test request, and export with sendmock_seed_export.",
    },
    PromptRecipe {
        name: "add-sms-provider",
        description: "Add an SMS vendor SendMock does not ship, from its docs.",
        arguments: &[("docs_url", "The vendor's API documentation.", true)],
        workflow: "Read {docs_url}. Create the provider with sendmock_sms_provider_create, set its requests, status names and error codes with sendmock_sms_provider_update, check sendmock_sms_provider_preview, send a test request, and export with sendmock_seed_export.",
    },
];

pub fn list_prompts() -> Vec<Prompt> {
    PROMPT_RECIPES
        .iter()
        .map(|recipe| {
            let arguments = recipe
                .arguments
                .iter()
                .map(|(argument_name, argument_description, is_required)| {
                    PromptArgument::new(*argument_name)
                        .with_description(*argument_description)
                        .with_required(*is_required)
                })
                .collect();
            Prompt::new(recipe.name, Some(recipe.description), Some(arguments))
        })
        .collect()
}

/// The workflow with the arguments filled in; a missing optional argument reads as "this app".
pub fn build_prompt_messages(
    prompt_name: &str,
    arguments: &Map<String, Value>,
) -> Result<Vec<PromptMessage>, String> {
    let recipe = PROMPT_RECIPES
        .iter()
        .find(|recipe| recipe.name == prompt_name)
        .ok_or_else(|| format!("No prompt named {prompt_name}"))?;
    let mut workflow = recipe.workflow.to_owned();
    for (argument_name, _, is_required) in recipe.arguments {
        let argument_value = arguments.get(*argument_name).and_then(Value::as_str);
        let filled_value = match (argument_value, is_required) {
            (Some(argument_value), _) => argument_value.to_owned(),
            (None, true) => return Err(format!("The prompt {prompt_name} needs {argument_name}")),
            (None, false) => "this app".to_owned(),
        };
        workflow = workflow.replace(&format!("{{{argument_name}}}"), &filled_value);
    }
    let instructions = format!(
        "{workflow}\n\nFirst check SendMock runs with sendmock_status. Never reset or delete everything without asking."
    );
    Ok(vec![PromptMessage::new_text(Role::User, instructions)])
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: AI-03.3
    #[test]
    fn every_prompt_is_listed_and_fills_its_workflow() {
        let arguments: Map<String, Value> = serde_json::from_value(
            serde_json::json!({ "provider": "twilio", "url": "http://localhost:3000/sms" }),
        )
        .unwrap_or_default();

        let messages =
            build_prompt_messages("setup-inbound-webhook", &arguments).unwrap_or_default();
        let missing = build_prompt_messages("add-payment-gateway", &Map::new());

        assert_eq!(list_prompts().len(), 10);
        let message_text = serde_json::to_string(&messages).unwrap_or_default();
        assert!(message_text.contains("twilio template"), "{message_text}");
        assert!(message_text.contains("http://localhost:3000/sms"));
        assert!(missing.is_err());
    }

    // AC: AI-03.3
    #[test]
    fn every_tool_a_prompt_names_exists() {
        let tool_names: Vec<&str> = sendmock_ops::build_operation_registry()
            .operations()
            .iter()
            .flat_map(|operation| {
                let definition = operation.definition();
                std::iter::once(definition.mcp_tool)
                    .chain(definition.mcp_aliases.iter().copied())
                    .collect::<Vec<_>>()
            })
            .collect();

        for recipe in PROMPT_RECIPES {
            for named_tool in recipe
                .workflow
                .split(|character: char| !(character.is_ascii_alphanumeric() || character == '_'))
                .filter(|word| word.starts_with("sendmock_"))
            {
                assert!(
                    tool_names.contains(&named_tool),
                    "{}: {named_tool}",
                    recipe.name
                );
            }
        }
    }
}
