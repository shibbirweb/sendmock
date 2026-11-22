use super::banner_colors::{BRAND_TEAL, paint_text, pick_line_color};
use super::banner_size::count_wordmark_columns;
use super::braille_raster::draw_wordmark_lines;
use super::terminal_environment::ColorLevel;

/// What the banner looks like in this terminal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BannerLayout {
    /// The braille wordmark at this many lines, with the version under it.
    Wordmark { line_count: usize },
    /// `SendMock v<version>`, for terminals too narrow or without braille.
    OneLine,
}

/// The whole banner, ending with a blank line that sets it apart from the startup lines.
pub fn render_banner(
    version: &str,
    banner_layout: BannerLayout,
    color_level: ColorLevel,
) -> String {
    let BannerLayout::Wordmark { line_count } = banner_layout else {
        return format!("SendMock v{version}\n\n");
    };
    let mut banner = String::new();
    for (line_index, wordmark_line) in draw_wordmark_lines(line_count).iter().enumerate() {
        let line_color = pick_line_color(line_index, line_count);
        banner.push_str(&paint_text(wordmark_line, line_color, color_level));
        banner.push('\n');
    }
    let version_line = format!(
        "{:>width$}",
        format!("v{version}"),
        width = count_wordmark_columns(line_count)
    );
    banner.push_str(&paint_text(&version_line, BRAND_TEAL, color_level));
    banner.push_str("\n\n");
    banner
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-23.1
    #[test]
    fn the_version_sits_right_aligned_under_the_wordmark() {
        let banner = render_banner(
            "1.5.0",
            BannerLayout::Wordmark { line_count: 8 },
            ColorLevel::None,
        );
        let banner_lines: Vec<&str> = banner.lines().collect();

        assert_eq!(banner_lines.len(), 10);
        assert_eq!(banner_lines[8].chars().count(), 71);
        assert!(banner_lines[8].ends_with(" v1.5.0"));
        assert_eq!(banner_lines[9], "");
    }

    // AC: PL-23.2
    #[test]
    fn the_one_line_banner_names_the_version_without_colour() {
        assert_eq!(
            render_banner("1.5.0-beta.1", BannerLayout::OneLine, ColorLevel::TrueColor),
            "SendMock v1.5.0-beta.1\n\n"
        );
    }

    // AC: PL-23.1
    #[test]
    fn the_wordmark_at_five_lines_matches_its_snapshot() {
        insta::assert_snapshot!(render_banner(
            "1.5.0",
            BannerLayout::Wordmark { line_count: 5 },
            ColorLevel::None
        ));
    }

    // AC: PL-23.2
    #[test]
    fn the_wordmark_at_eight_lines_matches_its_snapshot() {
        insta::assert_snapshot!(render_banner(
            "1.5.0",
            BannerLayout::Wordmark { line_count: 8 },
            ColorLevel::None
        ));
    }

    // AC: PL-23.2
    #[test]
    fn the_wordmark_at_twelve_lines_matches_its_snapshot() {
        insta::assert_snapshot!(render_banner(
            "1.5.0",
            BannerLayout::Wordmark { line_count: 12 },
            ColorLevel::None
        ));
    }

    // AC: PL-23.3
    #[test]
    fn the_wordmark_in_24_bit_colour_matches_its_snapshot() {
        insta::assert_snapshot!(render_banner(
            "1.5.0",
            BannerLayout::Wordmark { line_count: 8 },
            ColorLevel::TrueColor
        ));
    }
}
