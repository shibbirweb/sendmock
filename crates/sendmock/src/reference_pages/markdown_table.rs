/// A Markdown table; a `|` inside a cell is escaped so it does not end the cell.
pub fn render_markdown_table(headings: &[&str], rows: &[Vec<String>]) -> String {
    let escape_cell = |cell_text: &str| cell_text.replace('|', "\\|").replace('\n', " ");
    let mut table_lines = vec![
        format!("| {} |", headings.join(" | ")),
        format!("|{}", " --- |".repeat(headings.len())),
    ];
    for row in rows {
        let escaped_cells: Vec<String> = row.iter().map(|cell| escape_cell(cell)).collect();
        table_lines.push(format!("| {} |", escaped_cells.join(" | ")));
    }
    table_lines.join("\n") + "\n"
}

/// Inline code, so `<`, `{` and `|` in it are shown as written.
pub fn code(text: &str) -> String {
    format!("`{text}`")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pipe_inside_a_cell_is_escaped() {
        let table = render_markdown_table(&["Usage"], &[vec![code("value | md5")]]);

        assert_eq!(table, "| Usage |\n| --- |\n| `value \\| md5` |\n");
    }
}
