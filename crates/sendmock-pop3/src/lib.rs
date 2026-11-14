//! The POP3 listener (RFC 1939, with CAPA from RFC 2449): it serves the mail SendMock caught,
//! one project's mailbox per login. Off unless `--pop3-addr` is given.

mod protocol;
mod server;

pub use protocol::{
    Pop3Login, Pop3LoginError, Pop3Mailbox, Pop3MailboxError, Pop3Session, SessionStep,
};
pub use server::{OperationsMailbox, Pop3Server, serve_pop3};
