#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use support::test_app::{build_test_app, call_api_text};

// AC: AI-06.1
#[tokio::test]
async fn the_server_answers_llms_txt_and_llms_full_txt_as_plain_text() {
    let (app_router, _) = build_test_app();

    let (index_status, index_type, llms_text) = call_api_text(&app_router, "/llms.txt").await;
    let (full_status, _, llms_full_text) = call_api_text(&app_router, "/llms-full.txt").await;

    assert_eq!(index_status, 200, "{llms_text}");
    assert!(index_type.starts_with("text/plain"), "{index_type}");
    assert!(llms_text.starts_with("# SendMock\n"));
    assert!(llms_text.contains("/llms-full.txt"));
    assert_eq!(full_status, 200);
    assert!(llms_full_text.contains("## Skill"));
    assert!(
        llms_full_text.contains("MCP: `sendmock_email_wait`."),
        "the tools are listed"
    );
}
