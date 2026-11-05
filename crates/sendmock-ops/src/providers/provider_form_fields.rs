use super::ProviderHttpRequest;

/// One part of a `multipart/form-data` body; a file part has a file name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MultipartFormPart {
    pub field_name: String,
    pub file_name: Option<String>,
    pub content_type: Option<String>,
    pub content: Vec<u8>,
}

/// The body's form fields in order: `application/x-www-form-urlencoded`, or the text parts of
/// `multipart/form-data`, which providers that read PHP's `$_POST` accept just the same.
pub fn read_provider_form_fields(request: &ProviderHttpRequest) -> Vec<(String, String)> {
    match read_multipart_boundary(request) {
        Some(boundary) => read_multipart_parts(&request.body, &boundary)
            .into_iter()
            .filter(|form_part| form_part.file_name.is_none())
            .map(|form_part| {
                let field_value = String::from_utf8_lossy(&form_part.content).into_owned();
                (form_part.field_name, field_value)
            })
            .collect(),
        None if is_multipart_form(request) => Vec::new(),
        None => serde_urlencoded::from_bytes(&request.body).unwrap_or_default(),
    }
}

/// The file parts of a `multipart/form-data` body, such as Mailgun's `attachment` fields.
pub fn read_provider_form_files(request: &ProviderHttpRequest) -> Vec<MultipartFormPart> {
    read_multipart_boundary(request)
        .map(|boundary| read_multipart_parts(&request.body, &boundary))
        .unwrap_or_default()
        .into_iter()
        .filter(|form_part| form_part.file_name.is_some())
        .collect()
}

fn is_multipart_form(request: &ProviderHttpRequest) -> bool {
    let content_type = request.header("content-type").unwrap_or_default();
    let media_type = content_type.split(';').next().unwrap_or_default().trim();
    media_type.eq_ignore_ascii_case("multipart/form-data")
}

fn read_multipart_boundary(request: &ProviderHttpRequest) -> Option<String> {
    if !is_multipart_form(request) {
        return None;
    }
    request
        .header("content-type")
        .unwrap_or_default()
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

fn find_bytes(haystack: &[u8], needle: &[u8], start_index: usize) -> Option<usize> {
    haystack
        .get(start_index..)?
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|found_index| found_index + start_index)
}

/// The parts between the delimiters, up to the closing `--boundary--`.
fn read_multipart_parts(body: &[u8], boundary: &str) -> Vec<MultipartFormPart> {
    let delimiter = format!("--{boundary}").into_bytes();
    let mut form_parts = Vec::new();
    let Some(mut part_start) = find_bytes(body, &delimiter, 0) else {
        return form_parts;
    };
    loop {
        part_start += delimiter.len();
        if body.get(part_start..part_start + 2) == Some(b"--".as_slice()) {
            break;
        }
        let Some(part_end) = find_bytes(body, &delimiter, part_start) else {
            break;
        };
        if let Some(form_part) = read_form_part(&body[part_start..part_end]) {
            form_parts.push(form_part);
        }
        part_start = part_end;
    }
    form_parts
}

/// A part's headers and content; none for a part without a field name.
fn read_form_part(part_bytes: &[u8]) -> Option<MultipartFormPart> {
    let part_bytes = part_bytes.strip_prefix(b"\r\n").unwrap_or(part_bytes);
    let header_end = find_bytes(part_bytes, b"\r\n\r\n", 0)?;
    let header_block = String::from_utf8_lossy(&part_bytes[..header_end]);
    let content = &part_bytes[header_end + 4..];
    let content = content.strip_suffix(b"\r\n").unwrap_or(content);
    let mut form_part = MultipartFormPart {
        field_name: String::new(),
        file_name: None,
        content_type: None,
        content: content.to_vec(),
    };
    for header_line in header_block.lines() {
        let Some((header_name, header_value)) = header_line.split_once(':') else {
            continue;
        };
        if header_name.trim().eq_ignore_ascii_case("content-type") {
            form_part.content_type = Some(header_value.trim().to_owned());
        } else if header_name
            .trim()
            .eq_ignore_ascii_case("content-disposition")
        {
            read_disposition(header_value, &mut form_part);
        }
    }
    (!form_part.field_name.is_empty()).then_some(form_part)
}

fn read_disposition(disposition: &str, form_part: &mut MultipartFormPart) {
    for disposition_parameter in disposition.split(';').map(str::trim) {
        let Some((parameter_name, parameter_value)) = disposition_parameter.split_once('=') else {
            continue;
        };
        let parameter_value = parameter_value.trim().trim_matches('"').to_owned();
        match parameter_name.trim().to_ascii_lowercase().as_str() {
            "name" => form_part.field_name = parameter_value,
            "filename" => form_part.file_name = Some(parameter_value),
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    fn build_request(content_type: &str, body: &[u8]) -> ProviderHttpRequest {
        ProviderHttpRequest {
            method: "POST".to_owned(),
            path: "/gwprocess/v4/api.php".to_owned(),
            query_string: None,
            headers: BTreeMap::from([("content-type".to_owned(), content_type.to_owned())]),
            body: body.to_vec(),
        }
    }

    const MULTIPART_BODY: &[u8] =
        b"--XyZ\r\nContent-Disposition: form-data; name=\"tran_id\"\r\n\r\nT1\r\n\
        --XyZ\r\nContent-Disposition: form-data; name=\"note\"\r\n\r\nline one\r\nline two\r\n\
        --XyZ\r\nContent-Disposition: form-data; name=\"attachment\"; filename=\"logo.png\"\r\n\
        Content-Type: image/png\r\n\r\n\x89PNG\r\n\x00\xff\r\n\
        --XyZ\r\ncontent-disposition: form-data; name=\"empty\"\r\n\r\n\r\n--XyZ--\r\n";

    #[test]
    fn reads_urlencoded_fields_in_order() {
        let request = build_request(
            "application/x-www-form-urlencoded",
            b"tran_id=T1&total_amount=100.50&cus_name=Rahim+Uddin",
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
    fn reads_multipart_text_parts_without_the_files() {
        let request = build_request("multipart/form-data; boundary=\"XyZ\"", MULTIPART_BODY);

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
    fn reads_multipart_file_parts_byte_for_byte() {
        let request = build_request("multipart/form-data; boundary=XyZ", MULTIPART_BODY);

        assert_eq!(
            read_provider_form_files(&request),
            vec![MultipartFormPart {
                field_name: "attachment".to_owned(),
                file_name: Some("logo.png".to_owned()),
                content_type: Some("image/png".to_owned()),
                content: b"\x89PNG\r\n\x00\xff".to_vec(),
            }]
        );
    }

    #[test]
    fn a_multipart_body_without_a_boundary_has_no_fields() {
        let request = build_request("multipart/form-data", b"--XyZ\r\n");

        assert_eq!(read_provider_form_fields(&request), Vec::new());
    }
}
