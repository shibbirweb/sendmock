/// A reply code and its text lines; more than one line is sent as `250-...` continuations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmtpReply {
    pub code: u16,
    pub lines: Vec<String>,
}

impl SmtpReply {
    pub fn new(code: u16, line: impl Into<String>) -> Self {
        Self {
            code,
            lines: vec![line.into()],
        }
    }

    pub fn multiline(code: u16, lines: Vec<String>) -> Self {
        Self { code, lines }
    }

    /// The reply as sent on the wire, each line ending in CRLF.
    pub fn to_wire(&self) -> String {
        let last_position = self.lines.len().saturating_sub(1);
        self.lines
            .iter()
            .enumerate()
            .map(|(line_position, line)| {
                let separator = if line_position == last_position {
                    ' '
                } else {
                    '-'
                };
                format!("{}{separator}{line}\r\n", self.code)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_continuation_lines_and_a_final_line() {
        let reply = SmtpReply::multiline(
            250,
            vec![
                "sendmock.local".to_owned(),
                "PIPELINING".to_owned(),
                "SIZE 1024".to_owned(),
            ],
        );

        assert_eq!(
            reply.to_wire(),
            "250-sendmock.local\r\n250-PIPELINING\r\n250 SIZE 1024\r\n"
        );
        assert_eq!(SmtpReply::new(221, "Bye").to_wire(), "221 Bye\r\n");
    }
}
