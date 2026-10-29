//! The `minijinja` environment every template renders in: SendMock's filters and functions,
//! how values are written, the undefined behaviour of each mode and the fuel limit.

use std::sync::Arc;

use minijinja::value::{Kwargs, Serde};
use minijinja::{Environment, Error, ErrorKind, UndefinedBehavior, Value};

use super::template_date_filters::{date_add_filter, date_filter, unix_filter};
use super::template_encoding_filters::{
    base64_decode_filter, base64_encode_filter, escape_html_filter, fromjson_filter,
    hex_encode_filter, json_filter, omit_filter, pick_filter, strip_html_filter, to_display_text,
    tojson_filter, urlencode_filter,
};
use super::template_functions::TemplateFunctions;
use super::template_hash_filters::{
    hmac_sha1_filter, hmac_sha256_filter, md5_filter, sha1_filter, sha256_filter, sha512_filter,
};
use super::template_phone::{find_phone_country, format_e164, read_national_number};
use super::template_text_filters::{
    capitalize_filter, contains_filter, default_filter, number_format_filter, pad_left_filter,
    pad_right_filter, regex_extract_filter, regex_replace_filter, required_filter, slice_filter,
    slugify_filter, squish_filter, truncate_filter,
};
use super::{TemplateEscape, TemplateRenderMode};

/// Instructions one render may run, so a runaway loop stops instead of hanging a delivery.
pub const TEMPLATE_FUEL_LIMIT: u64 = 200_000;

pub fn build_template_environment(
    template_functions: Arc<dyn TemplateFunctions>,
    escape: TemplateEscape,
    render_mode: TemplateRenderMode,
) -> Environment<'static> {
    let mut environment = Environment::new();
    environment.set_undefined_behavior(match render_mode {
        TemplateRenderMode::Lenient => UndefinedBehavior::Chainable,
        TemplateRenderMode::Strict => UndefinedBehavior::SemiStrict,
    });
    environment.set_fuel(Some(TEMPLATE_FUEL_LIMIT));
    // Errors then point at the failing expression, so they can name it.
    environment.set_debug(true);
    environment.set_formatter(move |output, state, value| {
        if value.is_undefined() && state.undefined_behavior() != UndefinedBehavior::Chainable {
            return Err(Error::new(ErrorKind::UndefinedError, "undefined value"));
        }
        output.write_str(&write_value(value, escape))?;
        Ok(())
    });
    add_text_filters(&mut environment);
    add_encoding_filters(&mut environment);
    add_function_globals(&mut environment, &template_functions);
    environment
}

/// Strings as they are, null and missing values as nothing, other values as JSON; inside a
/// JSON string the text is escaped, unless a filter such as `json` marked it safe.
fn write_value(value: &Value, escape: TemplateEscape) -> String {
    let display_text = to_display_text(value);
    if value.is_safe() || escape == TemplateEscape::None {
        return display_text;
    }
    let quoted_text = serde_json::Value::from(display_text).to_string();
    quoted_text[1..quoted_text.len() - 1].to_owned()
}

fn add_text_filters(environment: &mut Environment<'static>) {
    environment.add_filter("default", default_filter);
    environment.add_filter("d", default_filter);
    environment.add_filter("required", required_filter);
    environment.add_filter("capitalize", capitalize_filter);
    environment.add_filter("squish", squish_filter);
    environment.add_filter("truncate", truncate_filter);
    environment.add_filter("slice", slice_filter);
    environment.add_filter("regex_replace", regex_replace_filter);
    environment.add_filter("regex_extract", regex_extract_filter);
    environment.add_filter("contains", contains_filter);
    environment.add_filter("slugify", slugify_filter);
    environment.add_filter("pad_left", pad_left_filter);
    environment.add_filter("pad_right", pad_right_filter);
    environment.add_filter("number_format", number_format_filter);
    environment.add_filter("date", date_filter);
    environment.add_filter("date_add", date_add_filter);
    environment.add_filter("unix", unix_filter);
    environment.add_filter("e164", |phone: String| format_e164(&phone));
    environment.add_filter("phone_country", |phone: String| find_phone_country(&phone));
    environment.add_filter("phone_national", |phone: String| {
        read_national_number(&phone)
    });
}

fn add_encoding_filters(environment: &mut Environment<'static>) {
    environment.add_filter("urlencode", urlencode_filter);
    environment.add_filter("base64_encode", base64_encode_filter);
    environment.add_filter("base64_decode", base64_decode_filter);
    environment.add_filter("hex_encode", hex_encode_filter);
    environment.add_filter("escape_html", escape_html_filter);
    environment.add_filter("strip_html", strip_html_filter);
    environment.add_filter("json", json_filter);
    environment.add_filter("tojson", tojson_filter);
    environment.add_filter("fromjson", fromjson_filter);
    environment.add_filter("pick", pick_filter);
    environment.add_filter("omit", omit_filter);
    environment.add_filter("md5", md5_filter);
    environment.add_filter("sha1", sha1_filter);
    environment.add_filter("sha256", sha256_filter);
    environment.add_filter("sha512", sha512_filter);
    environment.add_filter("hmac_sha256", hmac_sha256_filter);
    environment.add_filter("hmac_sha1", hmac_sha1_filter);
}

/// Each function of `template_functions` as a global, with keyword arguments passed as a
/// trailing object.
fn add_function_globals(
    environment: &mut Environment<'static>,
    template_functions: &Arc<dyn TemplateFunctions>,
) {
    for function_name in template_functions.function_names() {
        let shared_functions = Arc::clone(template_functions);
        environment.add_function(
            function_name,
            move |arguments: &[Value], keyword_arguments: Kwargs| {
                let json_arguments = to_json_arguments(arguments, &keyword_arguments)?;
                shared_functions
                    .call_function(function_name, &json_arguments)
                    .map(|result| Value::from(Serde(result)))
                    .ok_or_else(|| Error::new(ErrorKind::UnknownFunction, function_name))
            },
        );
    }
}

/// Positional arguments as JSON, then the keyword arguments as one trailing object.
fn to_json_arguments(
    arguments: &[Value],
    keyword_arguments: &Kwargs,
) -> Result<Vec<serde_json::Value>, Error> {
    let to_json = |argument: &Value| serde_json::to_value(argument).unwrap_or_default();
    let mut json_arguments: Vec<serde_json::Value> = arguments.iter().map(to_json).collect();
    let mut keyword_object = serde_json::Map::new();
    for argument_name in keyword_arguments.args() {
        let argument_value: Value = keyword_arguments.get(argument_name)?;
        keyword_object.insert(argument_name.to_owned(), to_json(&argument_value));
    }
    if !keyword_object.is_empty() {
        json_arguments.push(serde_json::Value::Object(keyword_object));
    }
    Ok(json_arguments)
}
