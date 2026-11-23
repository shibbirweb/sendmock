//! The stack presets SendMock ships: a setup file and the options it is filled from.

/// One option a preset's setup file reads, written `{name}` in the file.
pub struct PresetOption {
    pub name: &'static str,
    pub default_value: &'static str,
    pub description: &'static str,
}

pub struct PresetDefinition {
    pub name: &'static str,
    pub description: &'static str,
    pub setup_template: &'static str,
    pub options: &'static [PresetOption],
}

const LARAVEL_MAILGUN_TWILIO_OPTIONS: [PresetOption; 5] = [
    PresetOption {
        name: "mailgun_events_path",
        default_value: "/webhooks/mailgun/events",
        description: "Where the app takes Mailgun's opened, bounced and complained events.",
    },
    PresetOption {
        name: "mailgun_inbound_path",
        default_value: "/webhooks/mailgun/inbound",
        description: "Where the app takes inbound email, as Mailgun's routes forward it.",
    },
    PresetOption {
        name: "twilio_inbound_path",
        default_value: "/webhooks/twilio/inbound",
        description: "Where the app takes texts its Twilio number receives.",
    },
    PresetOption {
        name: "twilio_status_path",
        default_value: "/webhooks/twilio/status",
        description: "Where the app takes Twilio's status callbacks.",
    },
    PresetOption {
        name: "twilio_debugger_path",
        default_value: "/webhooks/twilio/debugger",
        description: "Where the app takes Twilio Debugger events.",
    },
];

pub const PRESETS: [PresetDefinition; 1] = [PresetDefinition {
    name: "laravel-mailgun-twilio",
    description: "A Laravel app sending email through Mailgun and SMS through Twilio: Mailgun's event and inbound webhooks, Twilio's test sender with the app's inbound and status URLs, the Debugger URL and a Mailgun signing key.",
    setup_template: include_str!("../../builtin/presets/laravel-mailgun-twilio.toml"),
    options: &LARAVEL_MAILGUN_TWILIO_OPTIONS,
}];

pub fn find_preset(preset_name: &str) -> Option<&'static PresetDefinition> {
    PRESETS.iter().find(|preset| preset.name == preset_name)
}
