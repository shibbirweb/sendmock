mod serve_arguments;

use clap::{Parser, Subcommand};

pub use serve_arguments::ServeArguments;

#[derive(Debug, Parser)]
#[command(
    name = "sendmock",
    version,
    about = "Catch email, SMS, payments and webhooks from any app on your machine.",
    args_conflicts_with_subcommands = true,
    disable_help_subcommand = true
)]
pub struct CliArguments {
    #[command(subcommand)]
    command: Option<CliCommand>,

    /// `sendmock` alone runs the server, so its flags work without `serve`.
    #[command(flatten)]
    serve_arguments: ServeArguments,
}

#[derive(Debug, Subcommand)]
enum CliCommand {
    /// Run the servers (the default when no command is given).
    Serve(Box<ServeArguments>),

    /// Print the version and release channel of this binary.
    Version {
        /// Print JSON
        #[arg(long)]
        json: bool,
    },

    /// Print help; `--all` lists every command, `--all --json` the whole tree for agents.
    Help {
        /// List every command
        #[arg(long)]
        all: bool,

        /// Print JSON
        #[arg(long)]
        json: bool,
    },
}

/// The commands the binary handles itself; operation commands are built from the registry.
pub enum BuiltInCommand<'arguments> {
    Serve(&'arguments ServeArguments),
    Version {
        json: &'arguments bool,
    },
    Help {
        all: &'arguments bool,
        json: &'arguments bool,
    },
}

impl CliArguments {
    pub fn built_in_command(&self) -> BuiltInCommand<'_> {
        match &self.command {
            Some(CliCommand::Serve(serve_arguments)) => BuiltInCommand::Serve(serve_arguments),
            Some(CliCommand::Version { json }) => BuiltInCommand::Version { json },
            Some(CliCommand::Help { all, json }) => BuiltInCommand::Help { all, json },
            None => BuiltInCommand::Serve(&self.serve_arguments),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parsed_http_addr(arguments: &[&str]) -> Option<std::net::SocketAddr> {
        let cli_arguments = CliArguments::try_parse_from(arguments).ok()?;
        match cli_arguments.built_in_command() {
            BuiltInCommand::Serve(serve_arguments) => serve_arguments.http_addr,
            _ => None,
        }
    }

    #[test]
    fn runs_the_server_with_or_without_the_serve_command() {
        let expected_addr = "127.0.0.1:9000".parse().ok();

        assert_eq!(
            parsed_http_addr(&["sendmock", "--http-addr", "127.0.0.1:9000"]),
            expected_addr
        );
        assert_eq!(
            parsed_http_addr(&["sendmock", "serve", "--http-addr", "127.0.0.1:9000"]),
            expected_addr
        );
    }

    #[test]
    fn rejects_an_address_that_is_not_host_and_port() {
        assert!(CliArguments::try_parse_from(["sendmock", "--http-addr", "localhost"]).is_err());
    }
}
