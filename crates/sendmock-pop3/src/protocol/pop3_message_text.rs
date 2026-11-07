/// A message as POP3 sends it: CRLF line ends, each line starting with `.` doubled, and the
/// `.` line that ends the answer (RFC 1939, section 3).
pub fn write_multiline_body(message_lines: &[&str]) -> String {
    let mut body = String::new();
    for message_line in message_lines {
        if message_line.starts_with('.') {
            body.push('.');
        }
        body.push_str(message_line);
        body.push_str("\r\n");
    }
    body.push_str(".\r\n");
    body
}

/// The message's lines, whatever line ends it was stored with.
pub fn split_message_lines(raw_message: &str) -> Vec<&str> {
    let trimmed_message = raw_message
        .strip_suffix("\r\n")
        .or_else(|| raw_message.strip_suffix('\n'))
        .unwrap_or(raw_message);
    trimmed_message
        .split('\n')
        .map(|message_line| message_line.strip_suffix('\r').unwrap_or(message_line))
        .collect()
}

/// TOP: the headers, the blank line after them, then the first `body_line_count` body lines.
pub fn take_top_lines<'message>(
    message_lines: &[&'message str],
    body_line_count: usize,
) -> Vec<&'message str> {
    let header_end = message_lines
        .iter()
        .position(|message_line| message_line.is_empty())
        .map_or(message_lines.len(), |blank_line_index| blank_line_index + 1);
    message_lines
        .iter()
        .take(header_end + body_line_count)
        .copied()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lines_starting_with_a_dot_are_doubled_and_the_body_ends_with_a_dot_line() {
        let message_lines = split_message_lines("Subject: Hi\n\n.hidden\nText\n");

        assert_eq!(
            write_multiline_body(&message_lines),
            "Subject: Hi\r\n\r\n..hidden\r\nText\r\n.\r\n"
        );
    }

    #[test]
    fn top_keeps_the_headers_and_the_first_body_lines() {
        let message_lines = split_message_lines("A: 1\r\nB: 2\r\n\r\none\r\ntwo\r\nthree\r\n");

        assert_eq!(
            take_top_lines(&message_lines, 2),
            ["A: 1", "B: 2", "", "one", "two"]
        );
        assert_eq!(take_top_lines(&message_lines, 0), ["A: 1", "B: 2", ""]);
    }
}
