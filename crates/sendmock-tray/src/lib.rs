//! The SendMock tray app's logic, with no GUI: what the menu shows and does, how it reads
//! SendMock and starts it. The tray shell (`main.rs`, the `gui` feature) only draws it.

mod browser_launcher;
mod sendmock_connection;
mod server_process;
mod tray_controller;
mod tray_icon_image;
mod tray_options;

pub use browser_launcher::open_in_browser;
pub use sendmock_connection::{LocalHttpConnection, SendmockConnection, SendmockReading};
pub use server_process::{ChildServerProcess, ServerProcess, find_sendmock_binary};
pub use tray_controller::{TrayAction, TrayController, TrayEffect, TrayMenuModel};
pub use tray_icon_image::{ICON_SIZE, draw_icon_rgba};
pub use tray_options::{DEFAULT_SENDMOCK_URL, TrayOptions};
