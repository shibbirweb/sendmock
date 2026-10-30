use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use sendmock_api::{EmbeddedUiAssets, build_app_router, serve_http};
use sendmock_core::{FixedClock, SystemIdGenerator};
use sendmock_ops::{InstanceDetails, OperationContext, ReleaseChannel, build_operation_registry};
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

const PUSH_BUDGET: Duration = Duration::from_millis(500);
const SEND_BODY: &str =
    r#"{"from":"app@shop.test","to":["sam@example.test"],"subject":"Live","text":"Hello"}"#;

async fn start_server() -> std::io::Result<SocketAddr> {
    let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
        .map_err(std::io::Error::other)?;
    let operation_context = OperationContext::new(
        Arc::new(database),
        Arc::new(FixedClock::new(1_767_225_600_000)),
        Arc::new(SystemIdGenerator),
        InstanceDetails {
            version: "0.0.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: 1_767_225_600_000,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: None,
            is_container: false,
        },
    );
    let app_router = build_app_router(
        &build_operation_registry(),
        &operation_context,
        Arc::new(EmbeddedUiAssets),
    );
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let http_addr = listener.local_addr()?;
    tokio::spawn(serve_http(listener, app_router, std::future::pending()));
    Ok(http_addr)
}

/// Sends a request over a fresh connection and answers the whole response.
async fn send_request(
    http_addr: SocketAddr,
    request_head: &str,
    body: &str,
) -> std::io::Result<String> {
    let mut stream = TcpStream::connect(http_addr).await?;
    let request = format!(
        "{request_head} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes()).await?;
    let mut response = String::new();
    stream.read_to_string(&mut response).await?;
    Ok(response)
}

/// Opens the SSE stream, with `Last-Event-ID` when given, and answers its reader.
async fn open_event_stream(
    http_addr: SocketAddr,
    last_event_id: Option<&str>,
) -> std::io::Result<BufReader<TcpStream>> {
    let mut stream = TcpStream::connect(http_addr).await?;
    let resume_header = last_event_id
        .map(|event_id| format!("Last-Event-ID: {event_id}\r\n"))
        .unwrap_or_default();
    stream
        .write_all(
            format!("GET /api/v1/events HTTP/1.1\r\nHost: localhost\r\n{resume_header}\r\n")
                .as_bytes(),
        )
        .await?;
    let mut reader = BufReader::new(stream);
    let mut header_line = String::new();
    while header_line != "\r\n" {
        header_line.clear();
        reader.read_line(&mut header_line).await?;
    }
    Ok(reader)
}

/// The next `data:` line of the stream, parsed.
async fn read_next_event(reader: &mut BufReader<TcpStream>) -> std::io::Result<Value> {
    loop {
        let mut stream_line = String::new();
        if reader.read_line(&mut stream_line).await? == 0 {
            return Err(std::io::Error::other("the event stream ended"));
        }
        if let Some(event_json) = stream_line.trim_end().strip_prefix("data: ") {
            return serde_json::from_str(event_json).map_err(std::io::Error::other);
        }
    }
}

// AC: PL-02.1
#[tokio::test]
async fn a_new_email_is_pushed_over_the_websocket_within_500_ms() -> std::io::Result<()> {
    let http_addr = start_server().await?;
    let (mut websocket, _) =
        tokio_tungstenite::connect_async(format!("ws://{http_addr}/api/v1/ws"))
            .await
            .map_err(std::io::Error::other)?;

    let sent_at = Instant::now();
    send_request(http_addr, "POST /api/v1/send", SEND_BODY).await?;
    let pushed_frame = tokio::time::timeout(PUSH_BUDGET, websocket.next())
        .await
        .map_err(std::io::Error::other)?
        .ok_or_else(|| std::io::Error::other("the websocket closed"))?
        .map_err(std::io::Error::other)?;

    let pushed_event: Value =
        serde_json::from_str(pushed_frame.to_text().map_err(std::io::Error::other)?)?;
    assert!(sent_at.elapsed() < PUSH_BUDGET);
    assert_eq!(pushed_event["type"], "email.received");
    assert_eq!(pushed_event["data"]["subject"], "Live");
    assert!(
        pushed_event["id"]
            .as_str()
            .is_some_and(|event_id| event_id.starts_with("evt_"))
    );
    Ok(())
}

// AC: PL-02.1
#[tokio::test]
async fn a_new_email_is_pushed_over_server_sent_events_within_500_ms() -> std::io::Result<()> {
    let http_addr = start_server().await?;
    let mut event_reader = open_event_stream(http_addr, None).await?;

    let sent_at = Instant::now();
    send_request(http_addr, "POST /api/v1/send", SEND_BODY).await?;
    let pushed_event = tokio::time::timeout(PUSH_BUDGET, read_next_event(&mut event_reader))
        .await
        .map_err(std::io::Error::other)??;

    assert!(sent_at.elapsed() < PUSH_BUDGET);
    assert_eq!(pushed_event["type"], "email.received");
    Ok(())
}

// AC: PL-02.2
#[tokio::test]
async fn a_reconnecting_event_stream_gets_only_what_it_missed() -> std::io::Result<()> {
    let http_addr = start_server().await?;
    send_request(http_addr, "POST /api/v1/send", SEND_BODY).await?;
    send_request(http_addr, "POST /api/v1/send", SEND_BODY).await?;
    let recent_response = send_request(http_addr, "GET /api/v1/events/recent", "").await?;
    let recent_events: Value =
        serde_json::from_str(recent_response.split("\r\n\r\n").nth(1).unwrap_or_default())?;
    let (newest_event_id, older_event_id) = (
        recent_events[0]["id"].clone(),
        recent_events[1]["id"].clone(),
    );

    let mut event_reader = open_event_stream(http_addr, older_event_id.as_str()).await?;
    let replayed_event = tokio::time::timeout(PUSH_BUDGET, read_next_event(&mut event_reader))
        .await
        .map_err(std::io::Error::other)??;

    assert_eq!(replayed_event["id"], newest_event_id);
    Ok(())
}

// AC: SM-01.5
#[tokio::test]
async fn a_new_sms_is_pushed_to_the_ui_within_a_second() -> std::io::Result<()> {
    let http_addr = start_server().await?;
    let (mut websocket, _) =
        tokio_tungstenite::connect_async(format!("ws://{http_addr}/api/v1/ws"))
            .await
            .map_err(std::io::Error::other)?;

    let sent_at = Instant::now();
    send_request(
        http_addr,
        "POST /api/v1/sms",
        r#"{"from":"+15550001111","to":"+8801700000000","body":"Your code is 482913"}"#,
    )
    .await?;
    let pushed_frame = tokio::time::timeout(Duration::from_secs(1), websocket.next())
        .await
        .map_err(std::io::Error::other)?
        .ok_or_else(|| std::io::Error::other("the websocket closed"))?
        .map_err(std::io::Error::other)?;

    let pushed_event: Value =
        serde_json::from_str(pushed_frame.to_text().map_err(std::io::Error::other)?)?;
    assert!(sent_at.elapsed() < Duration::from_secs(1));
    assert_eq!(pushed_event["type"], "sms.sent");
    assert_eq!(pushed_event["data"]["to_number"], "+8801700000000");
    Ok(())
}
