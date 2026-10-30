//! Date filters: `date(format, tz)`, `date_add(seconds)` and `unix`. They read an RFC 3339
//! timestamp (what `now()` and event fields hold) or Unix seconds.

use std::fmt::Write;

use chrono::format::{Item, StrftimeItems};
use chrono::{DateTime, FixedOffset, Utc};
use minijinja::value::{Kwargs, ValueKind};
use minijinja::{Error, ErrorKind, Value};

const DEFAULT_DATE_FORMAT: &str = "%Y-%m-%dT%H:%M:%SZ";

fn date_error(message: impl Into<String>) -> Error {
    Error::new(ErrorKind::InvalidOperation, message.into())
}

fn read_date_time(value: &Value) -> Result<DateTime<Utc>, Error> {
    let unix_seconds = match value.kind() {
        ValueKind::Number => f64::try_from(value.clone()).ok(),
        _ => value
            .as_str()
            .and_then(|text| text.trim().parse::<f64>().ok()),
    };
    if let Some(unix_seconds) = unix_seconds {
        let whole_seconds = unix_seconds.floor() as i64;
        let nanoseconds = ((unix_seconds - unix_seconds.floor()) * 1e9) as u32;
        return DateTime::from_timestamp(whole_seconds, nanoseconds)
            .ok_or_else(|| date_error("The time is out of range"));
    }
    let timestamp_text = value.as_str().unwrap_or_default().trim();
    DateTime::parse_from_rfc3339(timestamp_text)
        .map(|date_time| date_time.with_timezone(&Utc))
        .map_err(|_| date_error(format!("Not a time: {timestamp_text}")))
}

/// `UTC`, `Z` or an offset such as `+05:30` or `-0800`.
fn read_offset(time_zone: &str) -> Result<FixedOffset, Error> {
    let zone_text = time_zone.trim();
    if zone_text.eq_ignore_ascii_case("utc") || zone_text == "Z" {
        return FixedOffset::east_opt(0).ok_or_else(|| date_error("Bad offset"));
    }
    let digits: String = zone_text.chars().filter(char::is_ascii_digit).collect();
    let sign = match zone_text.chars().next() {
        Some('-') => -1,
        Some('+') => 1,
        _ => 0,
    };
    if sign == 0 || digits.len() != 4 {
        return Err(date_error(format!(
            "Unknown time zone {zone_text}: use UTC or an offset like +05:30"
        )));
    }
    let hours: i32 = digits[0..2].parse().unwrap_or(0);
    let minutes: i32 = digits[2..4].parse().unwrap_or(0);
    FixedOffset::east_opt(sign * (hours * 3600 + minutes * 60))
        .ok_or_else(|| date_error(format!("Bad offset {zone_text}")))
}

/// The time written with a `strftime` format (default `%Y-%m-%dT%H:%M:%SZ`) in a time zone
/// (default UTC).
pub fn date_filter(
    value: Value,
    format: Option<String>,
    keyword_arguments: Kwargs,
) -> Result<String, Error> {
    let format_keyword: Option<String> = keyword_arguments.get("format")?;
    let time_zone: Option<String> = keyword_arguments.get("tz")?;
    keyword_arguments.assert_all_used()?;
    let format_text = format
        .or(format_keyword)
        .unwrap_or_else(|| DEFAULT_DATE_FORMAT.to_owned());
    let format_items: Vec<Item> = StrftimeItems::new(&format_text).collect();
    if format_items.contains(&Item::Error) {
        return Err(date_error(format!("Bad date format: {format_text}")));
    }
    let offset = read_offset(time_zone.as_deref().unwrap_or("UTC"))?;
    let local_time = read_date_time(&value)?.with_timezone(&offset);
    let mut formatted_time = String::new();
    write!(
        formatted_time,
        "{}",
        local_time.format_with_items(format_items.into_iter())
    )
    .map_err(|_| date_error(format!("Bad date format: {format_text}")))?;
    Ok(formatted_time)
}

/// The time `seconds` later (or earlier when negative), as an RFC 3339 timestamp.
pub fn date_add_filter(value: Value, seconds: i64) -> Result<String, Error> {
    let moved_time = read_date_time(&value)?
        .checked_add_signed(chrono::Duration::seconds(seconds))
        .ok_or_else(|| date_error("The time is out of range"))?;
    Ok(moved_time.format(DEFAULT_DATE_FORMAT).to_string())
}

/// The time as Unix seconds.
pub fn unix_filter(value: Value) -> Result<i64, Error> {
    Ok(read_date_time(&value)?.timestamp())
}
