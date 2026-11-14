/// Resolves a URL from TwiML against the URL the document came from, as Twilio does, so
/// `<Redirect>/sms/next</Redirect>` works: absolute `http(s)` URLs stay as written, a path
/// starting with `/` keeps the document's origin, anything else is relative to its folder.
pub fn resolve_twiml_url(document_url: &str, twiml_url: &str) -> String {
    let twiml_url = twiml_url.trim();
    if twiml_url.starts_with("http://") || twiml_url.starts_with("https://") {
        return twiml_url.to_owned();
    }
    let document_url = document_url
        .split(['?', '#'])
        .next()
        .unwrap_or(document_url);
    let path_start = document_url
        .find("://")
        .map(|scheme_end| scheme_end + 3)
        .and_then(|authority_start| {
            document_url[authority_start..]
                .find('/')
                .map(|slash_offset| authority_start + slash_offset)
        })
        .unwrap_or(document_url.len());
    if twiml_url.starts_with('/') {
        return format!("{}{twiml_url}", &document_url[..path_start]);
    }
    let folder_end = document_url[path_start..]
        .rfind('/')
        .map_or(document_url.len(), |slash_offset| path_start + slash_offset);
    format!("{}/{twiml_url}", &document_url[..folder_end])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_absolute_urls() {
        assert_eq!(
            resolve_twiml_url("http://localhost:8000/sms", "https://example.test/next"),
            "https://example.test/next"
        );
    }

    #[test]
    fn resolves_a_root_path_against_the_origin() {
        assert_eq!(
            resolve_twiml_url("http://localhost:8000/sms/inbound?step=1", "/sms/next"),
            "http://localhost:8000/sms/next"
        );
        assert_eq!(
            resolve_twiml_url("http://localhost:8000", "/next"),
            "http://localhost:8000/next"
        );
    }

    #[test]
    fn resolves_a_relative_path_against_the_folder() {
        assert_eq!(
            resolve_twiml_url("http://localhost:8000/sms/inbound", "next"),
            "http://localhost:8000/sms/next"
        );
        assert_eq!(
            resolve_twiml_url("http://localhost:8000", "next"),
            "http://localhost:8000/next"
        );
    }
}
