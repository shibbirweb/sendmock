/// What an inbound text asks for under Twilio's Advanced Opt-Out.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OptOutKeyword {
    /// Stop sending to me: later sends get 21610.
    Stop,
    /// Send to me again.
    Start,
    /// Tell me how this works.
    Help,
}

/// Twilio's default keywords, matched as the whole text in any case.
const STOP_KEYWORDS: [&str; 6] = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_KEYWORDS: [&str; 3] = ["START", "YES", "UNSTOP"];
const HELP_KEYWORDS: [&str; 2] = ["HELP", "INFO"];

impl OptOutKeyword {
    /// The keyword a text is, ignoring case and the spaces around it; `None` for any other
    /// text, since Twilio only reacts to a text that is the keyword alone.
    pub fn classify(text_body: &str) -> Option<Self> {
        let keyword = text_body.trim().to_uppercase();
        if STOP_KEYWORDS.contains(&keyword.as_str()) {
            return Some(Self::Stop);
        }
        if START_KEYWORDS.contains(&keyword.as_str()) {
            return Some(Self::Start);
        }
        if HELP_KEYWORDS.contains(&keyword.as_str()) {
            return Some(Self::Help);
        }
        None
    }

    /// Twilio's name for it, as in the inbound webhook's `OptOutType`.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stop => "STOP",
            Self::Start => "START",
            Self::Help => "HELP",
        }
    }

    /// Twilio's default auto-reply to it.
    pub fn default_reply(self) -> &'static str {
        match self {
            Self::Stop => {
                "You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe."
            }
            Self::Start => {
                "You have successfully been re-subscribed to messages from this number. Reply HELP for help. Reply STOP to unsubscribe. Msg&Data Rates May Apply."
            }
            Self::Help => "Reply STOP to unsubscribe. Msg&Data Rates May Apply.",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: SM-23.1
    #[test]
    fn each_default_keyword_is_recognised_alone_in_any_case() {
        for stop_text in [
            "STOP",
            "stopall",
            " Unsubscribe ",
            "cancel",
            "End",
            "QUIT\n",
        ] {
            assert_eq!(
                OptOutKeyword::classify(stop_text),
                Some(OptOutKeyword::Stop),
                "{stop_text}"
            );
        }
        for start_text in ["start", "YES", "unstop"] {
            assert_eq!(
                OptOutKeyword::classify(start_text),
                Some(OptOutKeyword::Start),
                "{start_text}"
            );
        }
        assert_eq!(OptOutKeyword::classify("info"), Some(OptOutKeyword::Help));
        assert_eq!(OptOutKeyword::classify("please stop"), None);
        assert_eq!(OptOutKeyword::classify("STOP!"), None);
    }
}
