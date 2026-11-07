use schemars::JsonSchema;
use serde::Serialize;

/// The languages Settings > Connection has snippets for.
const SNIPPET_LANGUAGES: [&str; 8] = [
    "laravel", "node", "python", "go", "java", "ruby", "dotnet", "curl",
];

/// Stack names people use, to the snippet language that covers them.
const STACK_LANGUAGES: [(&str, &str); 9] = [
    ("php", "laravel"),
    ("express", "node"),
    ("nestjs", "node"),
    ("django", "python"),
    ("flask", "python"),
    ("fastapi", "python"),
    ("spring", "java"),
    ("rails", "ruby"),
    ("aspnet", "dotnet"),
];

/// Copy-ready settings, as Settings > Connection shows them.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct IntegrationSnippet {
    pub stack: String,
    /// `email`, `sms` or `http`.
    pub channel: String,
    /// The host the app reaches SendMock on: `127.0.0.1`, `host.docker.internal` or `sendmock`.
    pub host: String,
    pub language: String,
    pub code: String,
}

/// Where SendMock is reached from the app, and on which ports.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnippetTarget {
    pub host: String,
    pub smtp_port: u16,
    pub http_port: u16,
}

/// The snippet language for a stack name, if there is one.
pub fn find_snippet_language(stack: &str) -> Option<&'static str> {
    let stack = stack.to_lowercase();
    SNIPPET_LANGUAGES
        .iter()
        .find(|language| **language == stack)
        .copied()
        .or_else(|| {
            STACK_LANGUAGES
                .iter()
                .find(|(stack_name, _)| *stack_name == stack)
                .map(|(_, language)| *language)
        })
}

/// The host for where the app runs: `local` (the default), `docker-host` or `compose`.
pub fn find_app_host(host_setting: Option<&str>) -> &'static str {
    match host_setting {
        Some("docker-host") => "host.docker.internal",
        Some("compose") => "sendmock",
        _ => "127.0.0.1",
    }
}

/// The SMTP settings for a language, word for word as the Connection screen shows them.
pub fn build_smtp_snippet(language: &str, target: &SnippetTarget) -> String {
    let SnippetTarget {
        host, smtp_port, ..
    } = target;
    match language {
        "laravel" => format!(
            "MAIL_MAILER=smtp\nMAIL_HOST={host}\nMAIL_PORT={smtp_port}\nMAIL_ENCRYPTION=null"
        ),
        "node" => format!(
            "nodemailer.createTransport({{ host: \"{host}\", port: {smtp_port}, secure: false }});"
        ),
        "python" => format!("smtplib.SMTP(\"{host}\", {smtp_port})"),
        "go" => format!("smtp.SendMail(\"{host}:{smtp_port}\", nil, from, to, message)"),
        "java" => format!("spring.mail.host={host}\nspring.mail.port={smtp_port}"),
        "ruby" => format!(
            "config.action_mailer.smtp_settings = {{ address: \"{host}\", port: {smtp_port} }}"
        ),
        "dotnet" => format!("client.Connect(\"{host}\", {smtp_port}, SecureSocketOptions.None);"),
        _ => format!(
            "curl --url \"smtp://{host}:{smtp_port}\" --mail-from app@app.test \\\n  --mail-rcpt user@example.com --upload-file message.eml"
        ),
    }
}

/// The HTTP catcher URL to point Slack, push or other webhooks at.
pub fn build_catcher_snippet(target: &SnippetTarget) -> String {
    format!(
        "http://{}:{}/catch/slack/services/T000/B000/XXXX",
        target.host, target.http_port
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local_target() -> SnippetTarget {
        SnippetTarget {
            host: "127.0.0.1".to_owned(),
            smtp_port: 1025,
            http_port: 8025,
        }
    }

    #[test]
    fn frameworks_map_to_their_language() {
        assert_eq!(find_snippet_language("Django"), Some("python"));
        assert_eq!(find_snippet_language("laravel"), Some("laravel"));
        assert_eq!(find_snippet_language("cobol"), None);
    }

    // AC: PL-05.5
    #[test]
    fn snippets_use_the_host_for_where_the_app_runs_and_the_ports() {
        let compose_target = SnippetTarget {
            host: find_app_host(Some("compose")).to_owned(),
            ..local_target()
        };

        assert_eq!(
            build_smtp_snippet("laravel", &compose_target),
            "MAIL_MAILER=smtp\nMAIL_HOST=sendmock\nMAIL_PORT=1025\nMAIL_ENCRYPTION=null"
        );
        assert_eq!(
            build_smtp_snippet("python", &local_target()),
            "smtplib.SMTP(\"127.0.0.1\", 1025)"
        );
        assert_eq!(find_app_host(Some("docker-host")), "host.docker.internal");
        assert_eq!(find_app_host(None), "127.0.0.1");
    }
}
