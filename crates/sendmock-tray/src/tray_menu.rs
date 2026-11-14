use sendmock_tray::{TrayAction, TrayMenuModel};
use tray_icon::TrayIcon;
use tray_icon::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};

/// The tray's menu items; `apply` makes them match the controller's model.
pub struct TrayMenu {
    pub menu: Menu,
    status_item: MenuItem,
    unread_item: MenuItem,
    open_item: MenuItem,
    start_item: MenuItem,
    stop_item: MenuItem,
    quit_item: MenuItem,
}

impl TrayMenu {
    pub fn new() -> Result<Self, String> {
        let tray_menu = Self {
            menu: Menu::new(),
            status_item: MenuItem::new("Not running", false, None),
            unread_item: MenuItem::new("", false, None),
            open_item: MenuItem::new("Open SendMock", false, None),
            start_item: MenuItem::new("Start SendMock", false, None),
            stop_item: MenuItem::new("Stop SendMock", false, None),
            quit_item: MenuItem::new("Quit", true, None),
        };
        tray_menu
            .menu
            .append_items(&[
                &tray_menu.status_item,
                &tray_menu.unread_item,
                &PredefinedMenuItem::separator(),
                &tray_menu.open_item,
                &tray_menu.start_item,
                &tray_menu.stop_item,
                &PredefinedMenuItem::separator(),
                &tray_menu.quit_item,
            ])
            .map_err(|menu_error| menu_error.to_string())?;
        Ok(tray_menu)
    }

    pub fn apply(&self, menu_model: &TrayMenuModel, tray_icon: Option<&TrayIcon>) {
        self.status_item.set_text(&menu_model.status_label);
        self.unread_item.set_text(&menu_model.unread_label);
        self.open_item.set_enabled(menu_model.can_open);
        self.start_item.set_enabled(menu_model.can_start);
        self.stop_item.set_enabled(menu_model.can_stop);
        if let Some(tray_icon) = tray_icon {
            let _ = tray_icon.set_tooltip(Some(format!("SendMock: {}", menu_model.status_label)));
            tray_icon.set_title(menu_model.badge_title.as_deref());
        }
    }

    /// The action a menu click asks for, if it is one of these items.
    pub fn read_action(&self, menu_event: &MenuEvent) -> Option<TrayAction> {
        [
            (&self.open_item, TrayAction::Open),
            (&self.start_item, TrayAction::Start),
            (&self.stop_item, TrayAction::Stop),
            (&self.quit_item, TrayAction::Quit),
        ]
        .into_iter()
        .find(|(menu_item, _)| menu_item.id() == menu_event.id())
        .map(|(_, tray_action)| tray_action)
    }
}
