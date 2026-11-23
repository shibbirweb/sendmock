use super::banner_size::{DOT_COLUMNS_PER_CHARACTER, DOT_ROWS_PER_LINE, count_wordmark_columns};
use super::wordmark_outline::{
    VIEW_BOX_HEIGHT_HUNDREDTHS, VIEW_BOX_WIDTH_HUNDREDTHS, WORDMARK_CONTOURS,
};

/// The first braille character; the other 255 add one bit per raised dot.
const BRAILLE_BLANK: u32 = 0x2800;
/// Unicode's bit for each dot, by the dot's column (left, right) and row (top to bottom).
const DOT_BITS: [[u8; DOT_ROWS_PER_LINE]; DOT_COLUMNS_PER_CHARACTER] =
    [[0x01, 0x02, 0x04, 0x40], [0x08, 0x10, 0x20, 0x80]];

/// One straight edge of the outline, in view box units.
struct OutlineEdge {
    start: (f64, f64),
    end: (f64, f64),
}

fn to_units(point_hundredths: [u16; 2]) -> (f64, f64) {
    (
        f64::from(point_hundredths[0]) / 100.0,
        f64::from(point_hundredths[1]) / 100.0,
    )
}

/// Every edge of every shape, each shape closed back to its first point.
fn collect_outline_edges() -> Vec<OutlineEdge> {
    WORDMARK_CONTOURS
        .iter()
        .flat_map(|contour| {
            contour
                .iter()
                .enumerate()
                .map(|(point_index, point)| OutlineEdge {
                    start: to_units(*point),
                    end: to_units(contour[(point_index + 1) % contour.len()]),
                })
        })
        .collect()
}

/// Where the horizontal line at `line_y` crosses the outline, sorted left to right.
fn find_crossings(outline_edges: &[OutlineEdge], line_y: f64) -> Vec<f64> {
    let mut crossings: Vec<f64> = outline_edges
        .iter()
        .filter(|edge| (edge.start.1 <= line_y) != (edge.end.1 <= line_y))
        .map(|edge| {
            let along_edge = (line_y - edge.start.1) / (edge.end.1 - edge.start.1);
            edge.start.0 + along_edge * (edge.end.0 - edge.start.0)
        })
        .collect();
    crossings.sort_by(f64::total_cmp);
    crossings
}

/// The dot columns whose centres fall inside one filled span, by the even-odd rule.
fn dot_columns_between(
    span_start: f64,
    span_end: f64,
    units_per_dot: f64,
) -> std::ops::Range<usize> {
    let first_column = (span_start / units_per_dot - 0.5).ceil().max(0.0) as usize;
    let end_column = (span_end / units_per_dot - 0.5).ceil().max(0.0) as usize;
    first_column..end_column
}

fn encode_braille_line(dot_cells: &[u8]) -> String {
    let line: String = dot_cells
        .iter()
        .map(|&dot_bits| match dot_bits {
            0 => ' ',
            _ => char::from_u32(BRAILLE_BLANK + u32::from(dot_bits)).unwrap_or(' '),
        })
        .collect();
    line.trim_end().to_owned()
}

/// The wordmark as `line_count` lines of braille, filled row of dots by row of dots.
pub fn draw_wordmark_lines(line_count: usize) -> Vec<String> {
    let column_count = count_wordmark_columns(line_count);
    let dot_row_count = line_count * DOT_ROWS_PER_LINE;
    let units_per_dot = f64::from(VIEW_BOX_HEIGHT_HUNDREDTHS) / 100.0 / dot_row_count as f64;
    let dot_column_limit = (column_count * DOT_COLUMNS_PER_CHARACTER)
        .min((f64::from(VIEW_BOX_WIDTH_HUNDREDTHS) / 100.0 / units_per_dot).ceil() as usize);
    let outline_edges = collect_outline_edges();
    let mut cells = vec![vec![0_u8; column_count]; line_count];
    for dot_row in 0..dot_row_count {
        let crossings = find_crossings(&outline_edges, (dot_row as f64 + 0.5) * units_per_dot);
        for [span_start, span_end] in crossings.as_chunks::<2>().0 {
            for dot_column in dot_columns_between(*span_start, *span_end, units_per_dot) {
                if dot_column >= dot_column_limit {
                    break;
                }
                let cell =
                    &mut cells[dot_row / DOT_ROWS_PER_LINE][dot_column / DOT_COLUMNS_PER_CHARACTER];
                *cell |=
                    DOT_BITS[dot_column % DOT_COLUMNS_PER_CHARACTER][dot_row % DOT_ROWS_PER_LINE];
            }
        }
    }
    cells
        .iter()
        .map(|line_cells| encode_braille_line(line_cells))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_dot_sets_its_unicode_bit() {
        assert_eq!(encode_braille_line(&[0x01]), "\u{2801}");
        assert_eq!(encode_braille_line(&[0xff]), "\u{28ff}");
        assert_eq!(encode_braille_line(&[0x40, 0x80, 0]), "\u{2840}\u{2880}");
    }

    #[test]
    fn a_span_fills_the_dots_whose_centres_are_inside_it() {
        assert_eq!(dot_columns_between(0.0, 3.0, 1.0), 0..3);
        assert_eq!(dot_columns_between(0.6, 2.4, 1.0), 1..2);
    }

    #[test]
    fn a_square_fills_between_its_two_crossings() {
        let square = [
            OutlineEdge {
                start: (1.0, 1.0),
                end: (3.0, 1.0),
            },
            OutlineEdge {
                start: (3.0, 1.0),
                end: (3.0, 3.0),
            },
            OutlineEdge {
                start: (3.0, 3.0),
                end: (1.0, 3.0),
            },
            OutlineEdge {
                start: (1.0, 3.0),
                end: (1.0, 1.0),
            },
        ];

        assert_eq!(find_crossings(&square, 2.0), vec![1.0, 3.0]);
        assert!(find_crossings(&square, 4.0).is_empty());
    }

    // AC: PL-23.1
    #[test]
    fn the_wordmark_has_the_asked_height_in_braille_within_its_width() {
        for line_count in [5, 8, 12] {
            let wordmark_lines = draw_wordmark_lines(line_count);

            assert_eq!(wordmark_lines.len(), line_count);
            assert!(
                wordmark_lines
                    .iter()
                    .all(|line| line.chars().count() <= count_wordmark_columns(line_count))
            );
            assert!(
                wordmark_lines
                    .iter()
                    .flat_map(|line| line.chars())
                    .all(|character| character == ' '
                        || ('\u{2801}'..='\u{28ff}').contains(&character))
            );
            assert!(wordmark_lines.iter().all(|line| !line.is_empty()));
        }
    }
}
