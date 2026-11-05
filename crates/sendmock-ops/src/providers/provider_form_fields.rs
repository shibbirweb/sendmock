use super::ProviderHttpRequest;

/// The body's form fields in order: `application/x-www-form-urlencoded`, or the text parts of
/// `multipart/form-data`, which providers that read PHP's `$_POST` accept just the same.
pub fn read_provider_form_fields(request: &ProviderHttpRequest) -> Vec<(String, String)> {
    let content_type = request.header("content-type").unwrap_or_default();
    let media_type = content_type.split(';').next().unwrap_or_default().trim();
    if !media_type.eq_ignore_ascii_case("multipart/form-data") {
        return serde_urlencoded::from_bytes(&request.body).unwrap_or_default();
    }
    read_multipart_boundary(content_type)
        .map(|boundary| read_multipart_text_fields(&request.body, &boundary))
        .unwrap_or_default()
}

fn read_multipart_boundary(content_type: &str) -> Option<String> {
    content_type
        .split(';')
        .map(str::trim)
        .skip(1)
        .find_map(|parameter| {
            let (parameter_name, parameter_value) = parameter.split_once('=')?;
            parameter_name
                .trim()
                .eq_ignore_ascii_case("boundary")
                .then(|| parameter_value.trim().trim_matches('"').to_owned())
        })
        .filter(|boundary| !boundary.is_empty())
}

fn read_multipart_text_fields(body: &[u8], boundary: &str) -> Vec<(String, String)> {
    let body_text = String::from_utf8_lossy(body);
    let delimiter = format!("--{boundary}");
    body_text
        .split(delimiter.as_str())
        .skip(1)
        .take_while(|part| !part.starts_with("--"))
        .filter_map(read_text_part)
        .collect()
}

/// A part's field name and value; none for a file part or a part without a name.
fn read_text_part(part: &str) -> Option<(String, String)> {
    let part = part.strip_prefix("\r\n").unwrap_or(part);
    let (header_block, part_value) = part.split_once("\r\n\r\n")?;
    let disposition = header_block.lines().find_map(|header_line| {
        let (header_name, header_value) = header_line.split_once(':')?;
        header_name
            .trim()
            .eq_ignore_ascii_case("content-disposition")
            .then_some(header_value)
    })?;
    let mut field_name = None;
    for disposition_parameter in disposition.split(';').map(str::trim) {
        let Some((parameter_name, parameter_value)) = disposition_parameter.split_once('=') else {
            continue;
        };
        let parameter_name = parameter_name.trim().to_ascii_lowercase();
        if parameter_name == "filename" {
            return None;
        }
        if parameter_name == "name" {
            field_name = Some(parameter_value.trim().trim_matches('"').to_owned());
        }
    }
    let part_value = part_value.strip_suffix("\r\n").unwrap_or(part_value);
    Some((field_name?, part_value.to_owned()))
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    fn build_request(content_type: &str, body: &str) -> ProviderHttpRequest {
        ProviderHttpRequest {
            method: "POST".to_owned(),
            path: "/gwprocess/v4/api.php".to_owned(),
            query_string: None,
            headers: BTreeMap::from([("content-type".to_owned(), content_type.to_owned())]),
            body: body.as_bytes().to_vec(),
        }
    }

    #[test]
    fn reads_urlencoded_fields_in_order() {
        let request = build_request(
            "application/x-www-form-urlencoded",
            "tran_id=T1&total_amount=100.50&cus_name=Rahim+Uddin",
        );

        assert_eq!(
            read_provider_form_fields(&request),
            vec![
                ("tran_id".to_owned(), "T1".to_owned()),
                ("total_amount".to_owned(), "100.50".to_owned()),
                ("cus_name".to_owned(), "Rahim Uddin".to_owned()),
            ]
        );
    }

    #[test]
    fn reads_multipart_text_parts_and_skips_files() {
        let multipart_body = "--XyZ\r\nContent-Disposition: form-data; name=\"tran_id\"\r\n\r\nT1\r\n\
             --XyZ\r\nContent-Disposition: form-data; name=\"note\"\r\n\r\nline one\r\nline two\r\n\
             --XyZ\r\nContent-Disposition: form-data; name=\"logo\"; filename=\"logo.png\"\r\n\
             Content-Type: image/png\r\n\r\nPNG\r\n\
             --XyZ\r\ncontent-disposition: form-data; name=\"empty\"\r\n\r\n\r\n--XyZ--\r\n";
        let request = build_request("multipart/form-data; boundary=\"XyZ\"", multipart_body);

        assert_eq!(
            read_provider_form_fields(&request),
            vec![
                ("tran_id".to_owned(), "T1".to_owned()),
                ("note".to_owned(), "line one\r\nline two".to_owned()),
                ("empty".to_owned(), String::new()),
            ]
        );
    }

    #[test]
    fn a_multipart_body_without_a_boundary_has_no_fields() {
        let request = build_request("multipart/form-data", "--XyZ\r\n");

        assert_eq!(read_provider_form_fields(&request), Vec::new());
    }
}
