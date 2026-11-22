use super::terminal_environment::ColorLevel;

/// A colour as red, green and blue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RgbColor {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
}

/// The website's dark-theme `--brand-to`, the mint at the top of the wordmark.
pub const BRAND_MINT: RgbColor = RgbColor {
    red: 0x34,
    green: 0xd3,
    blue: 0x99,
};
/// The website's `--brand-from`, the teal the wordmark fades to at its foot.
pub const BRAND_TEAL: RgbColor = RgbColor {
    red: 0x0d,
    green: 0x94,
    blue: 0x88,
};

/// The six levels of each channel in the 256-colour palette's colour cube (16 to 231).
const COLOR_CUBE_LEVELS: [u8; 6] = [0, 95, 135, 175, 215, 255];
const COLOR_CUBE_START: u8 = 16;

fn mix_channel(top_channel: u8, foot_channel: u8, position: f64) -> u8 {
    let mixed =
        f64::from(top_channel) + (f64::from(foot_channel) - f64::from(top_channel)) * position;
    mixed.round().clamp(0.0, 255.0) as u8
}

/// One colour per line, from mint on the first line to teal on the last.
pub fn pick_line_color(line_index: usize, line_count: usize) -> RgbColor {
    let position = match line_count {
        0 | 1 => 0.0,
        _ => line_index as f64 / (line_count - 1) as f64,
    };
    RgbColor {
        red: mix_channel(BRAND_MINT.red, BRAND_TEAL.red, position),
        green: mix_channel(BRAND_MINT.green, BRAND_TEAL.green, position),
        blue: mix_channel(BRAND_MINT.blue, BRAND_TEAL.blue, position),
    }
}

fn nearest_cube_level(channel: u8) -> usize {
    COLOR_CUBE_LEVELS
        .iter()
        .enumerate()
        .min_by_key(|(_, level)| channel.abs_diff(**level))
        .map_or(0, |(level_index, _)| level_index)
}

/// The colour cube entry closest to a colour, for terminals without 24-bit colour.
pub fn find_nearest_ansi256(color: RgbColor) -> u8 {
    let red_index = nearest_cube_level(color.red);
    let green_index = nearest_cube_level(color.green);
    let blue_index = nearest_cube_level(color.blue);
    let cube_offset = 36 * red_index + 6 * green_index + blue_index;
    COLOR_CUBE_START + u8::try_from(cube_offset).unwrap_or(0)
}

/// The text in the colour, as the terminal's colour level allows.
pub fn paint_text(text: &str, color: RgbColor, color_level: ColorLevel) -> String {
    match color_level {
        ColorLevel::None => text.to_owned(),
        ColorLevel::Ansi256 => {
            format!(
                "\u{1b}[38;5;{}m{text}\u{1b}[0m",
                find_nearest_ansi256(color)
            )
        }
        ColorLevel::TrueColor => format!(
            "\u{1b}[38;2;{};{};{}m{text}\u{1b}[0m",
            color.red, color.green, color.blue
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-23.3
    #[test]
    fn the_first_line_is_mint_and_the_last_is_teal() {
        assert_eq!(pick_line_color(0, 8), BRAND_MINT);
        assert_eq!(pick_line_color(7, 8), BRAND_TEAL);
        assert_eq!(pick_line_color(0, 1), BRAND_MINT);
    }

    // AC: PL-23.3
    #[test]
    fn colours_follow_the_colour_level() {
        assert_eq!(paint_text("S", BRAND_MINT, ColorLevel::None), "S");
        assert_eq!(
            paint_text("S", BRAND_MINT, ColorLevel::TrueColor),
            "\u{1b}[38;2;52;211;153mS\u{1b}[0m"
        );
        assert_eq!(
            paint_text("S", BRAND_MINT, ColorLevel::Ansi256),
            "\u{1b}[38;5;78mS\u{1b}[0m"
        );
    }

    #[test]
    fn the_256_colour_match_takes_the_closest_cube_entry() {
        let white = RgbColor {
            red: 255,
            green: 255,
            blue: 255,
        };
        let black = RgbColor {
            red: 0,
            green: 0,
            blue: 0,
        };

        assert_eq!(find_nearest_ansi256(white), 231);
        assert_eq!(find_nearest_ansi256(black), 16);
    }
}
