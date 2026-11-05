use schemars::JsonSchema;
use serde::Deserialize;

use super::agent_setups::{AiAgentSetup, AiAgentTarget, list_agent_setups};
use super::skill_files::render_skill_markdown;
use crate::{
    AnswerKind, FileAnswer, HttpMethod, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError,
};

const SKILL_CONTENT_TYPE: &str = "text/markdown; charset=utf-8";

/// `GET /api/v1/ai/agents`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct AiAgentsQuery {
    /// Only this agent.
    pub target: Option<AiAgentTarget>,
}

pub struct ListAiAgentsOperation;

impl Operation for ListAiAgentsOperation {
    type Input = AiAgentsQuery;
    type Output = Vec<AiAgentSetup>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getAiAgents",
            method: HttpMethod::Get,
            path: "/api/v1/ai/agents",
            summary: "For each AI agent, the install command and its MCP configuration.",
            is_read_only: true,
            cli_usage: "sendmock ai install --target <agent>",
            mcp_tool: "sendmock_ai_agents",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        _operation_context: &OperationContext,
        input: AiAgentsQuery,
    ) -> Result<Vec<AiAgentSetup>, OperationError> {
        Ok(list_agent_setups()
            .into_iter()
            .filter(|agent_setup| {
                input
                    .target
                    .is_none_or(|target| agent_setup.target == target)
            })
            .collect())
    }
}

pub struct GetAiSkillOperation;

impl Operation for GetAiSkillOperation {
    type Input = NoInput;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getAiSkill",
            method: HttpMethod::Get,
            path: "/api/v1/ai/skill",
            summary: "The SendMock agent skill as Markdown.",
            is_read_only: true,
            cli_usage: "sendmock ai skill",
            mcp_tool: "sendmock://docs/skill",
            answer_kind: AnswerKind::File {
                content_type: SKILL_CONTENT_TYPE,
            },
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The skill for this binary's version (AI-05.1).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<FileAnswer, OperationError> {
        Ok(FileAnswer {
            content_type: SKILL_CONTENT_TYPE.to_owned(),
            file_name: Some("SKILL.md".to_owned()),
            bytes: render_skill_markdown(operation_context.instance_details.version).into_bytes(),
        })
    }
}
