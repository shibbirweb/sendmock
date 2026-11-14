//! The SendMock tray app: an icon in the macOS menu bar or the system tray whose menu shows
//! SendMock's status and unread counts, opens the web UI, and starts and stops the server.

mod tray_menu;

use std::time::{Duration, Instant};

use sendmock_tray::{
    ChildServerProcess, ICON_SIZE, LocalHttpConnection, TrayController, TrayEffect, TrayOptions,
    draw_icon_rgba, find_sendmock_binary, open_in_browser,
};
use tao::event::{Event, StartCause};
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::menu::MenuEvent;
use tray_icon::{Icon, TrayIcon, TrayIconBuilder};

use crate::tray_menu::TrayMenu;

/// How often the menu reads SendMock again.
const REFRESH_INTERVAL: Duration = Duration::from_secs(2);

fn read_options() -> TrayOptions {
    TrayOptions::from_arguments(std::env::args().skip(1), std::env::var("SENDMOCK_URL").ok())
        .unwrap_or_else(|option_problem| {
            eprintln!("sendmock-tray: {option_problem}");
            std::process::exit(2);
        })
}

fn build_tray_icon(tray_menu: &TrayMenu) -> Option<TrayIcon> {
    let icon = Icon::from_rgba(draw_icon_rgba(), ICON_SIZE, ICON_SIZE).ok()?;
    TrayIconBuilder::new()
        .with_menu(Box::new(tray_menu.menu.clone()))
        .with_icon(icon)
        .with_tooltip("SendMock")
        .build()
        .ok()
}

type SendmockTrayController = TrayController<LocalHttpConnection, ChildServerProcess>;

/// The controller over the URL's SendMock and the `sendmock` binary it would start.
fn build_controller(tray_options: &TrayOptions) -> SendmockTrayController {
    let Some(connection) = LocalHttpConnection::new(&tray_options.sendmock_url) else {
        eprintln!("sendmock-tray: --url must be http://host:port");
        std::process::exit(2);
    };
    let current_binary = std::env::current_exe().ok();
    let sendmock_binary = find_sendmock_binary(
        tray_options.sendmock_binary.as_deref(),
        current_binary.as_deref(),
    );
    let server_process = ChildServerProcess::new(sendmock_binary, tray_options.read_http_address());
    TrayController::new(
        connection,
        server_process,
        tray_options.sendmock_url.clone(),
    )
}

/// Runs the clicked items' actions; answers whether the app should exit.
fn handle_menu_events(tray_menu: &TrayMenu, controller: &mut SendmockTrayController) -> bool {
    let mut should_exit = false;
    while let Ok(menu_event) = MenuEvent::receiver().try_recv() {
        let Some(tray_action) = tray_menu.read_action(&menu_event) else {
            continue;
        };
        match controller.handle(tray_action) {
            TrayEffect::OpenInBrowser(url) => {
                if let Err(open_problem) = open_in_browser(&url) {
                    eprintln!("sendmock-tray: {open_problem}");
                }
            }
            TrayEffect::Exit => should_exit = true,
            TrayEffect::Nothing => {}
        }
    }
    should_exit
}

fn main() {
    let mut controller = build_controller(&read_options());
    let tray_menu = TrayMenu::new().unwrap_or_else(|menu_problem| {
        eprintln!("sendmock-tray: {menu_problem}");
        std::process::exit(1);
    });
    #[allow(unused_mut, reason = "only macOS changes the event loop")]
    let mut event_loop = EventLoopBuilder::new().build();
    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::{ActivationPolicy, EventLoopExtMacOS};
        event_loop.set_activation_policy(ActivationPolicy::Accessory);
    }
    let mut tray_icon: Option<TrayIcon> = None;
    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::WaitUntil(Instant::now() + REFRESH_INTERVAL);
        match event {
            Event::NewEvents(StartCause::Init) => {
                tray_icon = build_tray_icon(&tray_menu);
                controller.start_up();
            }
            Event::NewEvents(StartCause::ResumeTimeReached { .. }) => controller.refresh(),
            _ => {}
        }
        if handle_menu_events(&tray_menu, &mut controller) {
            *control_flow = ControlFlow::Exit;
        }
        tray_menu.apply(&controller.menu_model(), tray_icon.as_ref());
    });
}
