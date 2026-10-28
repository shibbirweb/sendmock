/// RFC 3339 UTC timestamps (`2026-10-24T16:00:00.123Z`), the API's time format, to and from
/// Unix milliseconds. Proleptic Gregorian calendar, by Howard Hinnant's day algorithms.
const MILLISECONDS_PER_DAY: i64 = 86_400_000;

pub fn format_rfc3339(unix_ms: i64) -> String {
    let days_since_epoch = unix_ms.div_euclid(MILLISECONDS_PER_DAY);
    let millisecond_of_day = unix_ms.rem_euclid(MILLISECONDS_PER_DAY);
    let (year, month, day) = civil_from_days(days_since_epoch);
    let hours = millisecond_of_day / 3_600_000;
    let minutes = millisecond_of_day / 60_000 % 60;
    let seconds = millisecond_of_day / 1000 % 60;
    let milliseconds = millisecond_of_day % 1000;
    if milliseconds == 0 {
        format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}Z")
    } else {
        format!(
            "{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}Z"
        )
    }
}

/// Reads `YYYY-MM-DDTHH:MM:SS`, optional fractional seconds, and `Z` or a `+HH:MM` offset.
pub fn parse_rfc3339(timestamp_text: &str) -> Option<i64> {
    let (date_text, time_text) = timestamp_text.trim().split_once(['T', 't', ' '])?;
    let mut date_parts = date_text.split('-');
    let year: i64 = date_parts.next()?.parse().ok()?;
    let month: i64 = date_parts.next()?.parse().ok()?;
    let day: i64 = date_parts.next()?.parse().ok()?;
    let (clock_text, offset_ms) = split_offset(time_text)?;
    let mut clock_parts = clock_text.split(':');
    let hours: i64 = clock_parts.next()?.parse().ok()?;
    let minutes: i64 = clock_parts.next()?.parse().ok()?;
    let seconds_text = clock_parts.next().unwrap_or("0");
    let (whole_seconds_text, fraction_text) =
        seconds_text.split_once('.').unwrap_or((seconds_text, ""));
    let seconds: i64 = whole_seconds_text.parse().ok()?;
    let milliseconds: i64 = format!("{fraction_text:0<3}").get(..3)?.parse().ok()?;
    let is_valid = (1..=12).contains(&month)
        && (1..=31).contains(&day)
        && hours < 24
        && minutes < 60
        && seconds < 61;
    is_valid.then(|| {
        days_from_civil(year, month, day) * MILLISECONDS_PER_DAY
            + hours * 3_600_000
            + minutes * 60_000
            + seconds * 1000
            + milliseconds
            - offset_ms
    })
}

/// `30s`, `500ms`, `2m` or a bare number of seconds, as milliseconds.
pub fn parse_duration_ms(duration_text: &str) -> Option<u64> {
    let duration_text = duration_text.trim();
    let (number_text, unit_ms) = if let Some(number_text) = duration_text.strip_suffix("ms") {
        (number_text, 1)
    } else if let Some(number_text) = duration_text.strip_suffix('s') {
        (number_text, 1000)
    } else if let Some(number_text) = duration_text.strip_suffix('m') {
        (number_text, 60_000)
    } else {
        (duration_text, 1000)
    };
    number_text
        .trim()
        .parse::<u64>()
        .ok()
        .map(|number| number * unit_ms)
}

fn split_offset(time_text: &str) -> Option<(&str, i64)> {
    if let Some(clock_text) = time_text.strip_suffix(['Z', 'z']) {
        return Some((clock_text, 0));
    }
    let sign_position = time_text.rfind(['+', '-'])?;
    let (clock_text, offset_text) = time_text.split_at(sign_position);
    let sign = if offset_text.starts_with('-') { -1 } else { 1 };
    let (offset_hours, offset_minutes) = offset_text[1..].split_once(':')?;
    let offset_ms =
        (offset_hours.parse::<i64>().ok()? * 60 + offset_minutes.parse::<i64>().ok()?) * 60_000;
    Some((clock_text, sign * offset_ms))
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let shifted_days = days_since_epoch + 719_468;
    let era = shifted_days.div_euclid(146_097);
    let day_of_era = shifted_days.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let shifted_year = if month <= 2 { year - 1 } else { year };
    let era = shifted_year.div_euclid(400);
    let year_of_era = shifted_year.rem_euclid(400);
    let month_index = if month > 2 { month - 3 } else { month + 9 };
    let day_of_year = (153 * month_index + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_unix_milliseconds_as_rfc3339_utc() {
        assert_eq!(format_rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_rfc3339(1_767_225_600_000), "2026-01-01T00:00:00Z");
        assert_eq!(
            format_rfc3339(1_709_210_096_789),
            "2024-02-29T12:34:56.789Z"
        );
    }

    #[test]
    fn reads_what_it_writes_and_offsets() {
        for unix_ms in [0, 1_767_225_600_000, 1_709_210_096_789, 951_782_400_000] {
            assert_eq!(parse_rfc3339(&format_rfc3339(unix_ms)), Some(unix_ms));
        }
        assert_eq!(
            parse_rfc3339("2026-01-01T06:00:00+06:00"),
            Some(1_767_225_600_000)
        );
        assert_eq!(parse_rfc3339("not a time"), None);
        assert_eq!(parse_rfc3339("2026-13-01T00:00:00Z"), None);
    }

    #[test]
    fn reads_durations() {
        assert_eq!(parse_duration_ms("30s"), Some(30_000));
        assert_eq!(parse_duration_ms("500ms"), Some(500));
        assert_eq!(parse_duration_ms("2m"), Some(120_000));
        assert_eq!(parse_duration_ms("5"), Some(5000));
        assert_eq!(parse_duration_ms("soon"), None);
    }
}
