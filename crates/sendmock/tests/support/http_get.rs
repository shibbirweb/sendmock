use std::io::{self, Read, Write};
use std::net::TcpStream;

/// The raw HTTP/1.1 response to a GET, headers included, so tests need no HTTP client crate.
pub fn send_http_get(http_addr: &str, path: &str) -> io::Result<String> {
    let mut stream = TcpStream::connect(http_addr)?;
    write!(
        stream,
        "GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
    )?;
    let mut response = String::new();
    stream.read_to_string(&mut response)?;
    Ok(response)
}
