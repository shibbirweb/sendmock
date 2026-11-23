use super::wordmark_outline::{VIEW_BOX_HEIGHT_HUNDREDTHS, VIEW_BOX_WIDTH_HUNDREDTHS};

/// Below this the letters lose their shape, so a narrower terminal gets one plain line.
pub const SMALLEST_LINE_COUNT: usize = 5;
/// Above this a wide terminal would be filled with the logo.
pub const LARGEST_LINE_COUNT: usize = 12;
/// A line that fills the last column wraps in some terminals, so the wordmark leaves these free.
const SPARE_COLUMN_COUNT: usize = 2;
/// A braille character holds a grid of 2 by 4 dots, and terminal cells are about twice as tall
/// as wide, so the dots are square.
pub const DOT_COLUMNS_PER_CHARACTER: usize = 2;
pub const DOT_ROWS_PER_LINE: usize = 4;

/// How many characters wide the wordmark is at a height: 71 at 8 lines.
pub fn count_wordmark_columns(line_count: usize) -> usize {
    let dot_row_count = (line_count * DOT_ROWS_PER_LINE) as f64;
    let width_to_height =
        f64::from(VIEW_BOX_WIDTH_HUNDREDTHS) / f64::from(VIEW_BOX_HEIGHT_HUNDREDTHS);
    let dot_column_count = dot_row_count * width_to_height;
    (dot_column_count / DOT_COLUMNS_PER_CHARACTER as f64).round() as usize
}

/// The tallest wordmark that fits the terminal's width, or `None` when not even the smallest does.
pub fn choose_banner_line_count(terminal_columns: usize) -> Option<usize> {
    (SMALLEST_LINE_COUNT..=LARGEST_LINE_COUNT)
        .rev()
        .find(|&line_count| {
            count_wordmark_columns(line_count) + SPARE_COLUMN_COUNT <= terminal_columns
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-23.2
    #[test]
    fn an_eighty_column_terminal_fits_eight_lines_seventy_one_columns_wide() {
        assert_eq!(choose_banner_line_count(80), Some(8));
        assert_eq!(count_wordmark_columns(8), 71);
    }

    // AC: PL-23.2
    #[test]
    fn the_smallest_needs_about_forty_four_columns_and_narrower_gets_none() {
        let smallest_width = count_wordmark_columns(SMALLEST_LINE_COUNT);

        assert_eq!(smallest_width, 44);
        assert_eq!(choose_banner_line_count(smallest_width + 2), Some(5));
        assert_eq!(choose_banner_line_count(smallest_width + 1), None);
        assert_eq!(choose_banner_line_count(0), None);
    }

    // AC: PL-23.2
    #[test]
    fn a_very_wide_terminal_stops_at_twelve_lines() {
        assert_eq!(choose_banner_line_count(200), Some(LARGEST_LINE_COUNT));
        assert_eq!(count_wordmark_columns(LARGEST_LINE_COUNT), 106);
    }
}
