/// The GSM 03.38 basic character set, each one septet.
const GSM_BASIC_CHARACTERS: &str = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/// The extension table: each one costs an escape septet plus itself.
const GSM_EXTENSION_CHARACTERS: &str = "^{}\\[~]|€\u{c}";

const GSM_SINGLE_SEGMENT_SEPTETS: usize = 160;
const GSM_CONCATENATED_SEGMENT_SEPTETS: usize = 153;
const UCS2_SINGLE_SEGMENT_UNITS: usize = 70;
const UCS2_CONCATENATED_SEGMENT_UNITS: usize = 67;

/// How a carrier would encode the text, which decides how many segments it costs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmsEncoding {
    Gsm7,
    Ucs2,
}

impl SmsEncoding {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Gsm7 => "GSM-7",
            Self::Ucs2 => "UCS-2",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SegmentCount {
    pub encoding: SmsEncoding,
    /// At least 1: an empty or media-only message still costs one.
    pub segments: u32,
}

/// GSM-7 when every character is in the GSM table (extension characters count twice),
/// otherwise UCS-2 counted in UTF-16 units; one segment up to 160 or 70, then 153 or 67
/// per segment (SM-06).
pub fn count_segments(message_text: &str) -> SegmentCount {
    let gsm_septets = message_text
        .chars()
        .try_fold(0_usize, |septet_count, character| {
            if GSM_BASIC_CHARACTERS.contains(character) {
                Some(septet_count + 1)
            } else if GSM_EXTENSION_CHARACTERS.contains(character) {
                Some(septet_count + 2)
            } else {
                None
            }
        });
    let (encoding, unit_count, single_limit, concatenated_limit) = match gsm_septets {
        Some(septet_count) => (
            SmsEncoding::Gsm7,
            septet_count,
            GSM_SINGLE_SEGMENT_SEPTETS,
            GSM_CONCATENATED_SEGMENT_SEPTETS,
        ),
        None => (
            SmsEncoding::Ucs2,
            message_text.encode_utf16().count(),
            UCS2_SINGLE_SEGMENT_UNITS,
            UCS2_CONCATENATED_SEGMENT_UNITS,
        ),
    };
    let segments = if unit_count <= single_limit {
        1
    } else {
        unit_count.div_ceil(concatenated_limit)
    };
    SegmentCount {
        encoding,
        segments: u32::try_from(segments).unwrap_or(u32::MAX),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: SM-06.1
    #[test]
    fn gsm_text_is_one_segment_up_to_160_then_153_each() {
        assert_eq!(
            count_segments(&"a".repeat(160)),
            SegmentCount {
                encoding: SmsEncoding::Gsm7,
                segments: 1
            }
        );
        assert_eq!(count_segments(&"a".repeat(161)).segments, 2);
        assert_eq!(count_segments(&"a".repeat(306)).segments, 2);
        assert_eq!(count_segments(&"a".repeat(307)).segments, 3);
    }

    // AC: SM-06.1
    #[test]
    fn extension_characters_count_twice() {
        assert_eq!(count_segments(&format!("{}€", "a".repeat(158))).segments, 1);
        assert_eq!(count_segments(&format!("{}€", "a".repeat(159))).segments, 2);
        assert_eq!(count_segments("{[]}").encoding, SmsEncoding::Gsm7);
    }

    // AC: SM-06.2
    #[test]
    fn any_other_character_switches_to_ucs2_at_70_then_67() {
        let with_bengali = format!("{}আ", "a".repeat(69));

        assert_eq!(
            count_segments(&with_bengali),
            SegmentCount {
                encoding: SmsEncoding::Ucs2,
                segments: 1
            }
        );
        assert_eq!(count_segments(&format!("{}আ", "a".repeat(70))).segments, 2);
        assert_eq!(count_segments(&"আ".repeat(134)).segments, 2);
        assert_eq!(count_segments(&"আ".repeat(135)).segments, 3);
    }

    #[test]
    fn an_emoji_takes_two_ucs2_units() {
        assert_eq!(count_segments(&format!("{}😀", "a".repeat(68))).segments, 1);
        assert_eq!(count_segments(&format!("{}😀", "a".repeat(69))).segments, 2);
    }

    #[test]
    fn an_empty_message_still_costs_one() {
        assert_eq!(count_segments("").segments, 1);
    }
}
