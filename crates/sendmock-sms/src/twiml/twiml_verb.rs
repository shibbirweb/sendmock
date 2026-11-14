/// How Twilio requests an `action` or `<Redirect>` URL; anything but `GET` is `POST`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TwimlMethod {
    Get,
    Post,
}

impl TwimlMethod {
    /// `POST` is Twilio's default when the attribute is missing.
    pub fn from_attribute(method_attribute: Option<&str>) -> Self {
        match method_attribute {
            Some(method_text) if method_text.trim().eq_ignore_ascii_case("GET") => Self::Get,
            _ => Self::Post,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
        }
    }
}

/// A `<Message>` verb: one reply, with the attributes that change who gets it and what follows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwimlMessage {
    /// The text, from `<Body>` children or the verb's own text.
    pub body: String,
    pub to: Option<String>,
    pub from: Option<String>,
    pub status_callback: Option<String>,
    /// Requested once the reply is sent; its TwiML replaces the verbs left in this document.
    pub action: Option<String>,
    pub method: TwimlMethod,
    pub media_urls: Vec<String>,
}

/// A `<Redirect>` verb: the TwiML at `url` replaces the verbs left in this document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwimlRedirect {
    pub url: String,
    pub method: TwimlMethod,
}

/// The Messaging TwiML verbs SendMock acts on, in document order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TwimlVerb {
    Message(TwimlMessage),
    Redirect(TwimlRedirect),
}
