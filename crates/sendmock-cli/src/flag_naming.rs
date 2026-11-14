use sendmock_ops::InputShape;

/// `tags` to `tag`, `policies` to `policy`; names without a plural stay.
pub fn to_singular(name: &str) -> String {
    if let Some(stem) = name.strip_suffix("ies") {
        return format!("{stem}y");
    }
    if name.ends_with('s') && !name.ends_with("ss") {
        return name[..name.len() - 1].to_owned();
    }
    name.to_owned()
}

/// The flag for an input, by the rules of docs/plan/21-reference-and-examples.md: kebab-case,
/// booleans without an `is_` prefix, lists in the singular. Returned without the `--`.
pub fn build_flag_name(input_name: &str, input_shape: InputShape) -> String {
    let flag_stem = match input_shape {
        InputShape::Scalar(sendmock_ops::ScalarType::Boolean) => input_name
            .strip_prefix("is_")
            .unwrap_or(input_name)
            .to_owned(),
        InputShape::List(_) => to_singular(input_name),
        InputShape::Scalar(_) | InputShape::Object => input_name.to_owned(),
    };
    flag_stem.replace('_', "-")
}

#[cfg(test)]
mod tests {
    use sendmock_ops::ScalarType;

    use super::*;

    #[test]
    fn names_flags_by_the_published_rules() {
        assert_eq!(
            build_flag_name("bounce_type", InputShape::Scalar(ScalarType::Text)),
            "bounce-type"
        );
        assert_eq!(
            build_flag_name("is_read", InputShape::Scalar(ScalarType::Boolean)),
            "read"
        );
        assert_eq!(
            build_flag_name("tags", InputShape::List(ScalarType::Text)),
            "tag"
        );
        assert_eq!(
            build_flag_name("policies", InputShape::List(ScalarType::Text)),
            "policy"
        );
        assert_eq!(build_flag_name("headers", InputShape::Object), "headers");
        assert_eq!(
            build_flag_name("address", InputShape::Scalar(ScalarType::Text)),
            "address"
        );
    }
}
