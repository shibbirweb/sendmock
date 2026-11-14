use crate::sendmock_connection::{SendmockConnection, SendmockReading};
use crate::server_process::ServerProcess;

/// Whose SendMock the tray shows: one it found running, one it started, or none.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ServerOwnership {
    Found,
    Started,
    NoServer,
}

/// What a menu item asks for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayAction {
    Open,
    Start,
    Stop,
    Quit,
}

/// What the tray shell does after an action.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrayEffect {
    OpenInBrowser(String),
    Exit,
    Nothing,
}

/// The menu as it should look now.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayMenuModel {
    pub status_label: String,
    /// Empty while SendMock is not running.
    pub unread_label: String,
    /// The unread total, shown beside the icon in the macOS menu bar; `None` at zero.
    pub badge_title: Option<String>,
    pub can_open: bool,
    pub can_start: bool,
    pub can_stop: bool,
}

/// Decides what the tray shows and does, over a SendMock connection and a server process.
pub struct TrayController<Connection: SendmockConnection, Process: ServerProcess> {
    connection: Connection,
    server_process: Process,
    sendmock_url: String,
    ownership: ServerOwnership,
    reading: SendmockReading,
    is_starting: bool,
    problem: Option<String>,
}

fn describe_unread(unread_email_count: u64, unread_sms_count: u64) -> String {
    let email_word = if unread_email_count == 1 {
        "email"
    } else {
        "emails"
    };
    format!("{unread_email_count} unread {email_word}, {unread_sms_count} unread SMS")
}

impl<Connection: SendmockConnection, Process: ServerProcess> TrayController<Connection, Process> {
    pub fn new(connection: Connection, server_process: Process, sendmock_url: String) -> Self {
        Self {
            connection,
            server_process,
            sendmock_url,
            ownership: ServerOwnership::NoServer,
            reading: SendmockReading::NotRunning,
            is_starting: false,
            problem: None,
        }
    }

    /// Uses a SendMock already running, else starts one.
    pub fn start_up(&mut self) {
        self.reading = self.connection.read_sendmock();
        if self.reading == SendmockReading::NotRunning {
            self.start_server();
        } else {
            self.ownership = ServerOwnership::Found;
        }
    }

    /// Reads SendMock again; a started server that exited shows as not running.
    pub fn refresh(&mut self) {
        if self.ownership == ServerOwnership::Started && self.server_process.has_exited() {
            self.ownership = ServerOwnership::NoServer;
            self.is_starting = false;
            self.problem = Some("SendMock stopped".to_owned());
        }
        self.reading = self.connection.read_sendmock();
        if self.reading != SendmockReading::NotRunning {
            self.is_starting = false;
            self.problem = None;
        } else if self.ownership == ServerOwnership::Found {
            self.ownership = ServerOwnership::NoServer;
        }
    }

    pub fn handle(&mut self, tray_action: TrayAction) -> TrayEffect {
        match tray_action {
            TrayAction::Open => TrayEffect::OpenInBrowser(self.sendmock_url.clone()),
            TrayAction::Start => {
                self.start_server();
                TrayEffect::Nothing
            }
            TrayAction::Stop => {
                self.stop_started_server();
                TrayEffect::Nothing
            }
            TrayAction::Quit => {
                self.stop_started_server();
                TrayEffect::Exit
            }
        }
    }

    pub fn menu_model(&self) -> TrayMenuModel {
        let is_running = self.reading != SendmockReading::NotRunning;
        let status_label = match (&self.reading, self.is_starting, &self.problem) {
            (SendmockReading::Running { .. }, _, _) => format!("Running at {}", self.sendmock_url),
            (SendmockReading::NotRunning, true, _) => "Starting SendMock...".to_owned(),
            (SendmockReading::NotRunning, false, Some(problem)) => {
                format!("Not running: {problem}")
            }
            (SendmockReading::NotRunning, false, None) => "Not running".to_owned(),
        };
        let (unread_label, badge_title) = match self.reading {
            SendmockReading::Running {
                unread_email_count,
                unread_sms_count,
            } => {
                let unread_total = unread_email_count + unread_sms_count;
                (
                    describe_unread(unread_email_count, unread_sms_count),
                    (unread_total > 0).then(|| unread_total.to_string()),
                )
            }
            SendmockReading::NotRunning => (String::new(), None),
        };
        TrayMenuModel {
            status_label,
            unread_label,
            badge_title,
            can_open: is_running,
            can_start: !is_running && !self.is_starting && self.ownership != ServerOwnership::Found,
            can_stop: self.ownership == ServerOwnership::Started,
        }
    }

    fn start_server(&mut self) {
        match self.server_process.start() {
            Ok(()) => {
                self.ownership = ServerOwnership::Started;
                self.is_starting = true;
                self.problem = None;
            }
            Err(start_problem) => self.problem = Some(start_problem),
        }
    }

    fn stop_started_server(&mut self) {
        if self.ownership == ServerOwnership::Started {
            self.server_process.stop();
            self.ownership = ServerOwnership::NoServer;
            self.is_starting = false;
            self.reading = SendmockReading::NotRunning;
        }
    }
}

#[cfg(test)]
mod tests {
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;

    use super::*;

    const URL: &str = "http://127.0.0.1:8025";
    const RUNNING: SendmockReading = SendmockReading::Running {
        unread_email_count: 3,
        unread_sms_count: 1,
    };

    /// Answers each reading in turn, then the last one forever.
    struct FakeConnection {
        readings: RefCell<Vec<SendmockReading>>,
    }

    impl SendmockConnection for FakeConnection {
        fn read_sendmock(&self) -> SendmockReading {
            let mut readings = self.readings.borrow_mut();
            if readings.len() > 1 {
                readings.remove(0)
            } else {
                readings
                    .first()
                    .copied()
                    .unwrap_or(SendmockReading::NotRunning)
            }
        }
    }

    #[derive(Clone, Default)]
    struct FakeProcess {
        start_count: Rc<Cell<u32>>,
        stop_count: Rc<Cell<u32>>,
        has_exited: Rc<Cell<bool>>,
    }

    impl ServerProcess for FakeProcess {
        fn start(&mut self) -> Result<(), String> {
            self.start_count.set(self.start_count.get() + 1);
            Ok(())
        }

        fn stop(&mut self) {
            self.stop_count.set(self.stop_count.get() + 1);
        }

        fn has_exited(&mut self) -> bool {
            self.has_exited.replace(false)
        }
    }

    fn build_controller(
        readings: Vec<SendmockReading>,
    ) -> (TrayController<FakeConnection, FakeProcess>, FakeProcess) {
        let fake_process = FakeProcess::default();
        let connection = FakeConnection {
            readings: RefCell::new(readings),
        };
        (
            TrayController::new(connection, fake_process.clone(), URL.to_owned()),
            fake_process,
        )
    }

    // AC: DS-08.1
    #[test]
    fn with_no_sendmock_running_it_starts_one_and_quit_stops_it() {
        let (mut controller, fake_process) =
            build_controller(vec![SendmockReading::NotRunning, RUNNING]);

        controller.start_up();
        let starting_menu = controller.menu_model();
        controller.refresh();
        let running_menu = controller.menu_model();
        let quit_effect = controller.handle(TrayAction::Quit);

        assert_eq!(fake_process.start_count.get(), 1);
        assert_eq!(starting_menu.status_label, "Starting SendMock...");
        assert_eq!(running_menu.status_label, format!("Running at {URL}"));
        assert!(running_menu.can_stop);
        assert_eq!(
            (quit_effect, fake_process.stop_count.get()),
            (TrayEffect::Exit, 1)
        );
    }

    // AC: DS-08.1 DS-08.3
    #[test]
    fn a_sendmock_already_running_is_used_and_left_running() {
        let (mut controller, fake_process) = build_controller(vec![RUNNING]);

        controller.start_up();
        let menu = controller.menu_model();
        let quit_effect = controller.handle(TrayAction::Quit);

        assert_eq!(fake_process.start_count.get(), 0);
        assert!(!menu.can_stop && !menu.can_start);
        assert_eq!(
            (quit_effect, fake_process.stop_count.get()),
            (TrayEffect::Exit, 0)
        );
    }

    // AC: DS-08.2
    #[test]
    fn the_menu_shows_the_unread_counts_and_open_names_the_web_ui() {
        let (mut controller, _) = build_controller(vec![RUNNING]);

        controller.start_up();
        let menu = controller.menu_model();

        assert_eq!(menu.unread_label, "3 unread emails, 1 unread SMS");
        assert_eq!(menu.badge_title.as_deref(), Some("4"));
        assert!(menu.can_open);
        assert_eq!(
            controller.handle(TrayAction::Open),
            TrayEffect::OpenInBrowser(URL.to_owned())
        );
    }

    // AC: DS-08.3
    #[test]
    fn stop_and_start_control_the_started_server_and_an_exit_shows_as_not_running() {
        let (mut controller, fake_process) = build_controller(vec![
            SendmockReading::NotRunning,
            RUNNING,
            SendmockReading::NotRunning,
        ]);
        controller.start_up();
        controller.refresh();

        controller.handle(TrayAction::Stop);
        let stopped_menu = controller.menu_model();
        controller.handle(TrayAction::Start);
        fake_process.has_exited.set(true);
        controller.refresh();
        let exited_menu = controller.menu_model();

        assert_eq!(stopped_menu.status_label, "Not running");
        assert!(stopped_menu.can_start && !stopped_menu.can_stop && !stopped_menu.can_open);
        assert_eq!(fake_process.start_count.get(), 2);
        assert_eq!(exited_menu.status_label, "Not running: SendMock stopped");
        assert!(exited_menu.can_start);
    }
}
