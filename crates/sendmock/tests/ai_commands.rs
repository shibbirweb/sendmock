#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::path::{Path, PathBuf};

use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

fn start_server(working_directory: &Path) -> (SendmockProcess, String) {
    let sendmock = SendmockProcess::start_with_free_port(working_directory)
        .unwrap_or_else(|start_error| panic!("sendmock starts: {start_error}"));
    let server_url = format!("http://{}", sendmock.wait_for_http_addr());
    (sendmock, server_url)
}

fn skill_examples_directory() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../skill/sendmock/examples")
}

// AC: AI-05.1
#[test]
fn ai_skill_prints_the_skill_for_this_version() {
    let working_directory = tempfile::tempdir()
        .unwrap_or_else(|folder_error| panic!("temporary folder: {folder_error}"));
    let (_sendmock, server_url) = start_server(working_directory.path());

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "ai",
        "skill",
        "--server",
        &server_url,
    ]))
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));

    let skill_markdown = String::from_utf8_lossy(&output.stdout);
    assert_eq!(output.status.code(), Some(0), "{skill_markdown}");
    assert!(
        skill_markdown.starts_with("---\nname: sendmock\n"),
        "{skill_markdown}"
    );
    assert!(skill_markdown.contains(&format!(
        "Written for SendMock {}.",
        env!("CARGO_PKG_VERSION")
    )));
}

// AC: AI-04.3
#[test]
fn the_skills_example_scenarios_pass_against_the_binary() {
    let working_directory = tempfile::tempdir()
        .unwrap_or_else(|folder_error| panic!("temporary folder: {folder_error}"));
    let (_sendmock, server_url) = start_server(working_directory.path());
    let mut example_paths: Vec<PathBuf> = std::fs::read_dir(skill_examples_directory())
        .unwrap_or_else(|read_error| panic!("the skill's examples: {read_error}"))
        .filter_map(|directory_entry| {
            directory_entry
                .ok()
                .map(|directory_entry| directory_entry.path())
        })
        .collect();
    example_paths.sort();

    assert_eq!(example_paths.len(), 3, "{example_paths:?}");
    for example_path in example_paths {
        let output = run_until_exit(
            sendmock_command(working_directory.path())
                .args(["scenario", "run"])
                .arg(&example_path)
                .args(["--server", &server_url]),
        )
        .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));
        let scenario_report = String::from_utf8_lossy(&output.stdout);
        assert_eq!(
            output.status.code(),
            Some(0),
            "{}: {scenario_report}",
            example_path.display()
        );
    }
}

/// `sendmock ai install` in a project folder whose home folder is a second temporary one.
fn run_install(
    project_directory: &Path,
    home_directory: &Path,
    arguments: &[&str],
) -> std::process::Output {
    run_until_exit(
        sendmock_command(project_directory)
            .env("HOME", home_directory)
            .args(["ai", "install"])
            .args(arguments)
            .stdin(std::process::Stdio::null()),
    )
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"))
}

fn read_text(file_path: &Path) -> String {
    std::fs::read_to_string(file_path).unwrap_or_default()
}

fn make_directory() -> tempfile::TempDir {
    tempfile::tempdir().unwrap_or_else(|folder_error| panic!("temporary folder: {folder_error}"))
}

// AC: AI-05.2
#[test]
fn ai_install_shows_the_diff_and_writes_nothing_without_yes() {
    let (project_directory, home_directory) = (make_directory(), make_directory());

    let output = run_install(
        project_directory.path(),
        home_directory.path(),
        &["--target", "cursor"],
    );

    let shown_diff = String::from_utf8_lossy(&output.stderr);
    assert_eq!(output.status.code(), Some(1), "{shown_diff}");
    assert!(shown_diff.contains("+++ .cursor/mcp.json"), "{shown_diff}");
    assert!(
        shown_diff.contains("+++ .cursor/rules/sendmock.mdc"),
        "{shown_diff}"
    );
    assert!(shown_diff.contains("--yes"), "{shown_diff}");
    assert!(!project_directory.path().join(".cursor").exists());
}

// AC: AI-05.2
#[test]
fn ai_install_for_cursor_keeps_other_servers_and_writes_the_rule() {
    let (project_directory, home_directory) = (make_directory(), make_directory());
    let mcp_path = project_directory.path().join(".cursor/mcp.json");
    std::fs::create_dir_all(project_directory.path().join(".cursor"))
        .unwrap_or_else(|error| panic!("{error}"));
    std::fs::write(
        &mcp_path,
        r#"{"mcpServers": {"other": {"command": "other-mcp"}}}"#,
    )
    .unwrap_or_else(|error| panic!("{error}"));

    let output = run_install(
        project_directory.path(),
        home_directory.path(),
        &["--target", "cursor", "--yes"],
    );
    let again = run_install(
        project_directory.path(),
        home_directory.path(),
        &["--target", "cursor", "--yes"],
    );

    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let mcp_config: serde_json::Value =
        serde_json::from_str(&read_text(&mcp_path)).unwrap_or_default();
    assert_eq!(mcp_config["mcpServers"]["other"]["command"], "other-mcp");
    assert_eq!(mcp_config["mcpServers"]["sendmock"]["args"][0], "mcp");
    let rule_text = read_text(&project_directory.path().join(".cursor/rules/sendmock.mdc"));
    assert!(rule_text.starts_with("---\ndescription:"), "{rule_text}");
    assert!(rule_text.contains("## Workflows"));
    assert!(String::from_utf8_lossy(&again.stdout).contains("already set up"));
}

// AC: AI-05.2
#[test]
fn ai_install_for_claude_code_and_codex_writes_their_files() {
    let (project_directory, home_directory) = (make_directory(), make_directory());
    std::fs::write(
        project_directory.path().join("AGENTS.md"),
        "# Team rules\n\nBe kind.\n",
    )
    .unwrap_or_else(|error| panic!("{error}"));

    let claude_output = run_install(
        project_directory.path(),
        home_directory.path(),
        &["--target", "claude-code", "--yes"],
    );
    let codex_output = run_install(
        project_directory.path(),
        home_directory.path(),
        &["--target", "codex", "--yes"],
    );

    assert_eq!(
        claude_output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&claude_output.stderr)
    );
    assert_eq!(
        codex_output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&codex_output.stderr)
    );
    let skill_directory = project_directory.path().join(".claude/skills/sendmock");
    assert!(
        read_text(&skill_directory.join("SKILL.md")).contains(&format!(
            "Written for SendMock {}.",
            env!("CARGO_PKG_VERSION")
        ))
    );
    assert!(skill_directory.join("examples/otp-from-sms.toml").exists());
    assert!(read_text(&project_directory.path().join(".mcp.json")).contains("\"sendmock\""));
    assert!(
        read_text(&home_directory.path().join(".codex/config.toml"))
            .contains("[mcp_servers.sendmock]")
    );
    let agents_text = read_text(&project_directory.path().join("AGENTS.md"));
    assert!(
        agents_text.starts_with("# Team rules\n\nBe kind.\n"),
        "{agents_text}"
    );
    assert!(agents_text.contains("<!-- sendmock:start -->"));
}

// AC: AI-05.4
#[test]
fn an_endpoint_created_with_the_cli_records_cli() {
    let working_directory = make_directory();
    let (_sendmock, server_url) = start_server(working_directory.path());
    let endpoint_body = serde_json::json!({
        "name": "Made with the CLI", "url": "http://localhost:3000/hooks", "method": "POST",
        "headers": {}, "extra_fields": {}, "template_id": "native", "template_mode": "linked",
        "timeout_ms": 10_000,
        "retry_policy": { "max_attempts": 2, "backoff_seconds": [1], "retry_on_client_errors": false },
        "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
        "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
        "render_mode": "strict",
    });

    let output = run_until_exit(sendmock_command(working_directory.path()).args([
        "webhook",
        "endpoint",
        "create",
        "--data",
        &endpoint_body.to_string(),
        "--server",
        &server_url,
        "--json",
    ]))
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));

    let created_endpoint: serde_json::Value =
        serde_json::from_slice(&output.stdout).unwrap_or_default();
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(created_endpoint["created_by"], "cli", "{created_endpoint}");
}

// AC: AI-05.9
#[test]
fn ai_install_with_npx_writes_configurations_that_start_sendmock_through_npx() {
    let (project_directory, home_directory) = (make_directory(), make_directory());

    let output = run_install(
        project_directory.path(),
        home_directory.path(),
        &["--target", "codex", "--npx", "--yes"],
    );
    let vscode_output = run_install(
        project_directory.path(),
        home_directory.path(),
        &["--target", "vscode", "--npx", "--yes"],
    );

    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(vscode_output.status.code(), Some(0));
    let codex_config = read_text(&home_directory.path().join(".codex/config.toml"));
    assert!(
        codex_config.contains("command = \"npx\"\nargs = [\"-y\", \"sendmock\", \"mcp\"]"),
        "{codex_config}"
    );
    let vscode_config: serde_json::Value = serde_json::from_str(&read_text(
        &project_directory.path().join(".vscode/mcp.json"),
    ))
    .unwrap_or_default();
    assert_eq!(vscode_config["servers"]["sendmock"]["command"], "npx");
    assert_eq!(
        vscode_config["servers"]["sendmock"]["args"],
        serde_json::json!(["-y", "sendmock", "mcp"])
    );
}

// AC: AI-05.9
#[test]
fn ai_install_started_by_the_npm_launcher_uses_npx_without_being_asked() {
    let (project_directory, home_directory) = (make_directory(), make_directory());

    let output = run_until_exit(
        sendmock_command(project_directory.path())
            .env("HOME", home_directory.path())
            .env("SENDMOCK_LAUNCHER", "npm")
            .args(["ai", "install", "--target", "claude-code", "--yes"])
            .stdin(std::process::Stdio::null()),
    )
    .unwrap_or_else(|run_error| panic!("the command runs: {run_error}"));

    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let mcp_config: serde_json::Value =
        serde_json::from_str(&read_text(&project_directory.path().join(".mcp.json")))
            .unwrap_or_default();
    assert_eq!(mcp_config["mcpServers"]["sendmock"]["command"], "npx");
}
