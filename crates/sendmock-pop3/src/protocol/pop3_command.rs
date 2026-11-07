/// A client's command line: the keyword in upper case (POP3 keywords ignore case) and its
/// arguments.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pop3Command {
    pub keyword: String,
    pub arguments: Vec<String>,
}

impl Pop3Command {
    pub fn parse(command_line: &str) -> Self {
        let mut words = command_line.split_whitespace();
        Self {
            keyword: words.next().unwrap_or_default().to_ascii_uppercase(),
            arguments: words.map(str::to_owned).collect(),
        }
    }

    /// The argument at `position` as a message number, 1 or more.
    pub fn read_number(&self, position: usize) -> Option<usize> {
        self.arguments
            .get(position)
            .and_then(|argument| argument.parse::<usize>().ok())
            .filter(|message_number| *message_number > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keywords_ignore_case_and_arguments_are_split_on_spaces() {
        let command = Pop3Command::parse("top 2  10");

        assert_eq!(command.keyword, "TOP");
        assert_eq!(command.read_number(0), Some(2));
        assert_eq!(command.read_number(1), Some(10));
        assert_eq!(Pop3Command::parse("RETR 0").read_number(0), None);
    }
}
