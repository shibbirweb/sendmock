use std::io;

/// The signals that stop the server, registered when created so a signal that arrives
/// right after the ready line is never missed: Ctrl-C, and `SIGTERM` (what `docker stop`
/// sends) on Unix.
pub struct ShutdownSignal {
    #[cfg(unix)]
    interrupt: tokio::signal::unix::Signal,
    #[cfg(unix)]
    terminate: tokio::signal::unix::Signal,
    #[cfg(windows)]
    ctrl_c: tokio::signal::windows::CtrlC,
}

impl ShutdownSignal {
    #[cfg(unix)]
    pub fn install() -> io::Result<Self> {
        use tokio::signal::unix::{SignalKind, signal};

        Ok(Self {
            interrupt: signal(SignalKind::interrupt())?,
            terminate: signal(SignalKind::terminate())?,
        })
    }

    #[cfg(windows)]
    pub fn install() -> io::Result<Self> {
        Ok(Self {
            ctrl_c: tokio::signal::windows::ctrl_c()?,
        })
    }

    #[cfg(unix)]
    pub async fn wait(mut self) {
        tokio::select! {
            _ = self.interrupt.recv() => {}
            _ = self.terminate.recv() => {}
        }
    }

    #[cfg(windows)]
    pub async fn wait(mut self) {
        self.ctrl_c.recv().await;
    }
}
