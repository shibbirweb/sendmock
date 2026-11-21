use std::fs;
use std::path::PathBuf;

use sendmock_ops::{CI_FORMAT_VERSION, build_ci_json_schema};

fn committed_ci_schema_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../website/public/schema/ci")
        .join(format!("v{CI_FORMAT_VERSION}.json"))
}

// AC: WH-15.7
#[test]
fn the_published_ci_schema_matches_this_build() {
    let rendered_schema = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_ci_json_schema())
            .unwrap_or_else(|error| panic!("the schema writes: {error}"))
    );
    let schema_path = committed_ci_schema_path();
    if std::env::var("SENDMOCK_UPDATE_SCHEMA").as_deref() == Ok("1") {
        if let Some(schema_folder) = schema_path.parent() {
            fs::create_dir_all(schema_folder).unwrap_or_else(|error| panic!("{error}"));
        }
        fs::write(&schema_path, &rendered_schema).unwrap_or_else(|error| panic!("{error}"));
        return;
    }
    // A Windows checkout may turn the committed file's line endings into CRLF.
    let committed_schema = fs::read_to_string(&schema_path)
        .unwrap_or_default()
        .replace("\r\n", "\n");
    assert!(
        committed_schema == rendered_schema,
        "website/public/schema/ci/v{CI_FORMAT_VERSION}.json is out of date: run \
         `SENDMOCK_UPDATE_SCHEMA=1 cargo test -p sendmock-api --test ci_schema` and commit it. \
         The schema this build writes:\n{rendered_schema}"
    );
}
