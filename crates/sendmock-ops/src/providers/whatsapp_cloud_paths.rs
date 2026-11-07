/// A Cloud API path after Graph's version (`v21.0`): messages and uploads under a phone
/// number id, or one uploaded media object.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloudPath<'path> {
    Messages { phone_number_id: &'path str },
    MediaUpload { phone_number_id: &'path str },
    MediaObject { media_id: &'path str },
}

/// Graph's versions always have a minor number (`v21.0`), which tells them from other APIs'
/// `v3`-style versions on the same port, such as Mailgun's `/v3/<domain>/messages`.
fn is_graph_version(version: &str) -> bool {
    version
        .strip_prefix('v')
        .and_then(|number| number.split_once('.'))
        .is_some_and(|(major, minor)| is_numeric_id(major) && is_numeric_id(minor))
}

/// Meta's phone number and media ids are numbers.
fn is_numeric_id(path_segment: &str) -> bool {
    !path_segment.is_empty()
        && path_segment
            .chars()
            .all(|character| character.is_ascii_digit())
}

/// The Cloud API path, or `None` for any other path.
pub fn read_cloud_path(path: &str) -> Option<CloudPath<'_>> {
    let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    match segments.as_slice() {
        [version, phone_number_id, "messages"]
            if is_graph_version(version) && !phone_number_id.is_empty() =>
        {
            Some(CloudPath::Messages { phone_number_id })
        }
        [version, phone_number_id, "media"]
            if is_graph_version(version) && !phone_number_id.is_empty() =>
        {
            Some(CloudPath::MediaUpload { phone_number_id })
        }
        [version, media_id] if is_graph_version(version) && is_numeric_id(media_id) => {
            Some(CloudPath::MediaObject { media_id })
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloud_paths_are_told_apart_by_their_last_segment() {
        assert_eq!(
            read_cloud_path("/v21.0/1065/messages"),
            Some(CloudPath::Messages {
                phone_number_id: "1065"
            })
        );
        assert_eq!(
            read_cloud_path("/v21.0/1065/media"),
            Some(CloudPath::MediaUpload {
                phone_number_id: "1065"
            })
        );
        assert_eq!(
            read_cloud_path("/v21.0/1037543291543636"),
            Some(CloudPath::MediaObject {
                media_id: "1037543291543636"
            })
        );
        assert_eq!(read_cloud_path("/2010-04-01/Accounts"), None);
        assert_eq!(read_cloud_path("/v2/verify"), None);
        assert_eq!(read_cloud_path("/v3/mg.example.test/messages"), None);
    }
}
