use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use serde_json::Value;

/// How long one request to the local SendMock may take; it answers in milliseconds.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(2);

/// What the tray reads from SendMock on each refresh.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SendmockReading {
    /// It answered, with the counts the Overview shows as unread.
    Running {
        unread_email_count: u64,
        unread_sms_count: u64,
    },
    NotRunning,
}

/// A SendMock the tray talks to; tests use a fake.
pub trait SendmockConnection {
    fn read_sendmock(&self) -> SendmockReading;
}

/// SendMock at a local `http://host:port` address, read with plain HTTP/1.1.
pub struct LocalHttpConnection {
    host_and_port: String,
}

impl LocalHttpConnection {
    /// `None` for a URL that is not `http://host:port`.
    pub fn new(sendmock_url: &str) -> Option<Self> {
        let host_and_port = sendmock_url.strip_prefix("http://")?.split('/').next()?;
        host_and_port.contains(':').then(|| Self {
            host_and_port: host_and_port.to_owned(),
        })
    }

    /// The body of a `GET`, or `None` when SendMock does not answer `200`.
    fn get(&self, path: &str) -> Option<String> {
        let socket_address = self.host_and_port.to_socket_addrs().ok()?.next()?;
        let mut stream = TcpStream::connect_timeout(&socket_address, REQUEST_TIMEOUT).ok()?;
        stream.set_read_timeout(Some(REQUEST_TIMEOUT)).ok()?;
        let request = format!(
            "GET {path} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
            self.host_and_port
        );
        stream.write_all(request.as_bytes()).ok()?;
        let mut response = String::new();
        stream.read_to_string(&mut response).ok()?;
        let (head, body) = response.split_once("\r\n\r\n")?;
        let is_ok = head.lines().next()?.split_whitespace().nth(1) == Some("200");
        is_ok.then(|| body.to_owned())
    }
}

/// The JSON of a body, which may come in HTTP's chunked encoding.
fn read_json_body(body: &str) -> Option<Value> {
    serde_json::from_str(body).ok().or_else(|| {
        let json_start = body.find('{')?;
        let json_end = body.rfind('}')?;
        serde_json::from_str(body.get(json_start..=json_end)?).ok()
    })
}

impl SendmockConnection for LocalHttpConnection {
    fn read_sendmock(&self) -> SendmockReading {
        let Some(stats) = self
            .get("/api/v1/stats")
            .as_deref()
            .and_then(read_json_body)
        else {
            return SendmockReading::NotRunning;
        };
        SendmockReading::Running {
            unread_email_count: stats["unread_email_count"].as_u64().unwrap_or_default(),
            unread_sms_count: stats["unread_sms_count"].as_u64().unwrap_or_default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::io::{BufRead, BufReader};
    use std::net::TcpListener;
    use std::thread;

    use super::*;

    /// A one-request server answering `status_line` with `body`.
    fn serve_once(status_line: &'static str, body: &'static str) -> String {
        let listener =
            TcpListener::bind("127.0.0.1:0").unwrap_or_else(|error| panic!("a port: {error}"));
        let address = listener
            .local_addr()
            .map(|address| address.to_string())
            .unwrap_or_default();
        thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut request_line = String::new();
                let _ = BufReader::new(&stream).read_line(&mut request_line);
                let response = format!(
                    "{status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(response.as_bytes());
            }
        });
        address
    }

    #[test]
    fn a_running_sendmock_answers_its_unread_counts() {
        let address = serve_once(
            "HTTP/1.1 200 OK",
            r#"{"unread_email_count":3,"unread_sms_count":1}"#,
        );
        let connection = LocalHttpConnection::new(&format!("http://{address}"));

        let reading = connection.map(|connection| connection.read_sendmock());

        assert_eq!(
            reading,
            Some(SendmockReading::Running {
                unread_email_count: 3,
                unread_sms_count: 1
            })
        );
    }

    #[test]
    fn an_error_answer_or_no_server_reads_as_not_running() {
        let address = serve_once("HTTP/1.1 500 Internal Server Error", "{}");
        let failing = LocalHttpConnection::new(&format!("http://{address}"));
        let closed = LocalHttpConnection::new("http://127.0.0.1:9");

        assert_eq!(
            failing.map(|connection| connection.read_sendmock()),
            Some(SendmockReading::NotRunning)
        );
        assert_eq!(
            closed.map(|connection| connection.read_sendmock()),
            Some(SendmockReading::NotRunning)
        );
        assert!(LocalHttpConnection::new("https://sendmock.test").is_none());
    }
}
