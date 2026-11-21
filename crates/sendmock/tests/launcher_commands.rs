#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod sendmock_process;
}

use std::io;
use std::path::Path;
use std::process::Command;

use serde_json::Value;
use support::sendmock_process::{SendmockProcess, run_until_exit, sendmock_command};

/// A `sendmock` command whose saved launcher choice lives in the test's folder.
fn launcher_command(working_directory: &Path) -> Command {
    let mut command = sendmock_command(working_directory);
    command.env(
        "SENDMOCK_LAST_RUN_FILE",
        working_directory.join("last-run.toml"),
    );
    command
}

fn save_last_run(working_directory: &Path, file_text: &str) -> io::Result<()> {
    std::fs::write(working_directory.join("last-run.toml"), file_text)
}

fn read_ready_fields(server: &SendmockProcess) -> io::Result<Value> {
    serde_json::from_str(&server.wait_for_line("http_addr")).map_err(io::Error::other)
}

// AC: PL-22.5
#[test]
fn last_starts_the_saved_services_and_flags_given_with_it_win() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    save_last_run(
        working_directory.path(),
        "version = 1\nsmtp = \"127.0.0.1:0\"\ncatcher = \"127.0.0.1:0\"\npop3 = \"127.0.0.1:0\"\n",
    )?;

    let server = SendmockProcess::start(launcher_command(working_directory.path()).args([
        "--last",
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
        "--provider-addr",
        "127.0.0.1:0",
    ]))?;
    let ready_fields = read_ready_fields(&server)?;

    assert!(ready_fields["catcher_addr"].is_string(), "{ready_fields}");
    assert!(ready_fields["pop3_addr"].is_string(), "{ready_fields}");
    assert!(ready_fields["provider_addr"].is_string(), "{ready_fields}");
    Ok(())
}

// AC: PL-22.5
#[test]
fn last_with_nothing_saved_starts_the_defaults_and_says_so() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;

    // A missing config file stops the start right after the launcher has spoken.
    let output = run_until_exit(launcher_command(working_directory.path()).args([
        "--last",
        "--config",
        "missing.toml",
    ]))?;
    let server = SendmockProcess::start(launcher_command(working_directory.path()).args([
        "--last",
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
    ]))?;
    let ready_fields = read_ready_fields(&server)?;

    let launcher_output = String::from_utf8_lossy(&output.stderr);
    assert!(
        launcher_output.contains("Nothing saved by the launcher yet; starting with the defaults."),
        "{launcher_output}"
    );
    assert_eq!(ready_fields["catcher_addr"], Value::Null);
    Ok(())
}

// AC: PL-22.6
#[test]
fn services_starts_the_named_listeners_and_refuses_an_unknown_name() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;

    let server = SendmockProcess::start(launcher_command(working_directory.path()).args([
        "--services",
        "smtp,catcher,pop3",
        "--catcher-addr",
        "127.0.0.1:0",
        "--pop3-addr",
        "127.0.0.1:0",
        "--ready-json",
        "--http-addr",
        "127.0.0.1:0",
        "--db",
        "memory",
    ]))?;
    let ready_fields = read_ready_fields(&server)?;
    let refused = run_until_exit(
        launcher_command(working_directory.path()).args(["--services", "smtp,ftp"]),
    )?;

    assert!(ready_fields["catcher_addr"].is_string(), "{ready_fields}");
    assert!(ready_fields["pop3_addr"].is_string(), "{ready_fields}");
    assert_eq!(ready_fields["provider_addr"], Value::Null);
    assert_eq!(refused.status.code(), Some(2));
    let refusal = String::from_utf8_lossy(&refused.stderr);
    assert!(
        refusal.contains(
            "ftp is not a service. Use smtp, smtps, provider, provider-tls, catcher, pop3."
        ),
        "{refusal}"
    );
    Ok(())
}

// AC: PL-22.7
#[test]
fn last_run_prints_the_saved_choice_as_json_and_clear_deletes_it() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    save_last_run(
        working_directory.path(),
        "version = 1\nsmtp = \"127.0.0.1:1025\"\ncatcher = \"127.0.0.1:8030\"\n",
    )?;

    let printed =
        run_until_exit(launcher_command(working_directory.path()).args(["last-run", "--json"]))?;
    let cleared =
        run_until_exit(launcher_command(working_directory.path()).args(["last-run", "clear"]))?;
    let printed_after =
        run_until_exit(launcher_command(working_directory.path()).args(["last-run", "--json"]))?;

    let saved: Value = serde_json::from_slice(&printed.stdout).map_err(io::Error::other)?;
    assert_eq!(saved["services"]["catcher"], "127.0.0.1:8030");
    assert_eq!(
        saved["command"],
        "sendmock serve --smtp-addr 127.0.0.1:1025 --catcher-addr 127.0.0.1:8030"
    );
    assert!(cleared.status.success());
    assert!(!working_directory.path().join("last-run.toml").exists());
    let after: Value = serde_json::from_slice(&printed_after.stdout).map_err(io::Error::other)?;
    assert_eq!(after["is_saved"], false);
    Ok(())
}

// AC: PL-22.1
#[test]
fn a_bare_sendmock_without_a_terminal_asks_nothing_and_starts() -> io::Result<()> {
    let working_directory = tempfile::tempdir()?;
    let mut command = launcher_command(working_directory.path());
    command
        .env("SENDMOCK_HTTP_ADDR", "127.0.0.1:0")
        .env("SENDMOCK_DB", "memory")
        .env("SENDMOCK_READY_JSON", "1");

    let server = SendmockProcess::start(&mut command)?;
    let ready_fields = read_ready_fields(&server)?;

    assert!(ready_fields["http_addr"].is_string(), "{ready_fields}");
    assert!(!working_directory.path().join("last-run.toml").exists());
    Ok(())
}
