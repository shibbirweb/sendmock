use std::io::{self, Read, Write};
use std::net::TcpStream;

/// The raw HTTP/1.1 response to a JSON POST, headers included.
pub fn send_http_post(http_addr: &str, path: &str, json_body: &str) -> io::Result<String> {
    let mut stream = TcpStream::connect(http_addr)?;
    write!(
        stream,
        "POST {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{json_body}",
        json_body.len()
    )?;
    let mut response_bytes = Vec::new();
    stream.read_to_end(&mut response_bytes)?;
    Ok(String::from_utf8_lossy(&response_bytes).into_owned())
}
