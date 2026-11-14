//! A unified-style diff of a file's lines, shown before `sendmock ai install` writes it.

const CONTEXT_LINES: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LineChange<'text> {
    Kept(&'text str),
    Removed(&'text str),
    Added(&'text str),
}

/// The longest common subsequence walk; the files an agent reads are small.
fn compare_lines<'text>(
    old_lines: &[&'text str],
    new_lines: &[&'text str],
) -> Vec<LineChange<'text>> {
    let mut common_lengths = vec![vec![0_usize; new_lines.len() + 1]; old_lines.len() + 1];
    for old_index in (0..old_lines.len()).rev() {
        for new_index in (0..new_lines.len()).rev() {
            common_lengths[old_index][new_index] = if old_lines[old_index] == new_lines[new_index] {
                common_lengths[old_index + 1][new_index + 1] + 1
            } else {
                common_lengths[old_index + 1][new_index]
                    .max(common_lengths[old_index][new_index + 1])
            };
        }
    }
    let (mut old_index, mut new_index) = (0, 0);
    let mut line_changes = Vec::new();
    while old_index < old_lines.len() || new_index < new_lines.len() {
        if old_index < old_lines.len()
            && new_index < new_lines.len()
            && old_lines[old_index] == new_lines[new_index]
        {
            line_changes.push(LineChange::Kept(old_lines[old_index]));
            (old_index, new_index) = (old_index + 1, new_index + 1);
        } else if new_index < new_lines.len()
            && (old_index == old_lines.len()
                || common_lengths[old_index][new_index + 1]
                    > common_lengths[old_index + 1][new_index])
        {
            line_changes.push(LineChange::Added(new_lines[new_index]));
            new_index += 1;
        } else {
            line_changes.push(LineChange::Removed(old_lines[old_index]));
            old_index += 1;
        }
    }
    line_changes
}

/// `--- path`, `+++ path`, then the changed lines with two lines of context around them;
/// `None` when nothing changes.
pub fn render_line_diff(file_label: &str, old_text: &str, new_text: &str) -> Option<String> {
    let old_lines: Vec<&str> = old_text.lines().collect();
    let new_lines: Vec<&str> = new_text.lines().collect();
    let line_changes = compare_lines(&old_lines, &new_lines);
    let changed_positions: Vec<usize> = line_changes
        .iter()
        .enumerate()
        .filter(|(_, line_change)| !matches!(line_change, LineChange::Kept(_)))
        .map(|(position, _)| position)
        .collect();
    if changed_positions.is_empty() {
        return None;
    }
    let mut diff_lines = vec![format!("--- {file_label}"), format!("+++ {file_label}")];
    let mut last_shown: Option<usize> = None;
    for (position, line_change) in line_changes.iter().enumerate() {
        let is_near_change = changed_positions
            .iter()
            .any(|changed_position| changed_position.abs_diff(position) <= CONTEXT_LINES);
        if !is_near_change {
            continue;
        }
        if last_shown.is_some_and(|last_position| position > last_position + 1) {
            diff_lines.push("@@".to_owned());
        }
        diff_lines.push(match line_change {
            LineChange::Kept(line) => format!(" {line}"),
            LineChange::Removed(line) => format!("-{line}"),
            LineChange::Added(line) => format!("+{line}"),
        });
        last_shown = Some(position);
    }
    Some(diff_lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: AI-05.2
    #[test]
    fn shows_the_added_and_removed_lines_with_context() {
        let diff = render_line_diff(
            "a.md",
            "one\ntwo\nthree\nfour\nfive\nsix\n",
            "one\ntwo\nTHREE\nfour\nfive\nsix\nseven\n",
        );

        assert_eq!(
            diff.as_deref(),
            Some("--- a.md\n+++ a.md\n one\n two\n-three\n+THREE\n four\n five\n six\n+seven")
        );
        assert_eq!(render_line_diff("a.md", "same\n", "same\n"), None);
    }
}
