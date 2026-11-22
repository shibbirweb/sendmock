use schemars::generate::SchemaSettings;
use serde_json::Value;

use super::ci_file::{CI_FORMAT_VERSION, CiFile};

/// Where the website publishes each CI format version's schema.
const CI_SCHEMA_BASE_URL: &str = "https://shibbir.me/sendmock/schema/ci";

/// The JSON Schema of the CI file this build reads (WH-15.7), so editors and agents can check
/// a CI file while it is written.
pub fn build_ci_json_schema() -> Value {
    let schema_generator = SchemaSettings::draft2020_12().into_generator();
    let mut ci_schema = schema_generator.into_root_schema_for::<CiFile>().to_value();
    ci_schema["$id"] = Value::from(format!("{CI_SCHEMA_BASE_URL}/v{CI_FORMAT_VERSION}.json"));
    ci_schema["title"] = Value::from("SendMock CI file");
    ci_schema
}
