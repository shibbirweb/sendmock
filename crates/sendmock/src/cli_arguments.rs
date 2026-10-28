mod serve_arguments;

use clap::{Parser, Subcommand};

pub use serve_arguments::ServeArguments;

#[derive(Debug, Parser)]
#[command(
    name = "sendmock",
    version,
    about = "Catch email, SMS, payments and webhooks from any app on your machine.",
    args_conflicts_with_subcommands = true
)]
pub struct CliArguments {
    #[command(subcommand)]
    command: Option<Command>,

    /// `sendmock` alone runs the server, so its flags work without `serve`.
    #[command(flatten)]
    serve_arguments: ServeArguments,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Run the servers (the default when no command is given).
    Serve(ServeArguments),
}

impl CliArguments {
    pub fn serve_arguments(&self) -> &ServeArguments {
        match &self.command {
            Some(Command::Serve(serve_arguments)) => serve_arguments,
            None => &self.serve_arguments,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runs_the_server_with_or_without_the_serve_command() {
        let without_command =
            CliArguments::try_parse_from(["sendmock", "--http-addr", "127.0.0.1:9000"]);
        let with_command =
            CliArguments::try_parse_from(["sendmock", "serve", "--http-addr", "127.0.0.1:9000"]);

        for cli_arguments in [without_command, with_command] {
            let http_addr = cli_arguments.map(|parsed| parsed.serve_arguments().http_addr);
            assert_eq!(http_addr.ok().flatten(), "127.0.0.1:9000".parse().ok());
        }
    }

    #[test]
    fn rejects_an_address_that_is_not_host_and_port() {
        let parse_result = CliArguments::try_parse_from(["sendmock", "--http-addr", "localhost"]);

        assert!(parse_result.is_err());
    }
}
