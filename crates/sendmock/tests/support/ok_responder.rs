use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

/// A local HTTP server that answers every request `200 OK`, so webhook deliveries succeed
/// without leaving the machine. It runs until the test process ends.
pub fn start_ok_responder() -> io::Result<String> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let responder_addr = listener.local_addr()?.to_string();
    thread::spawn(move || {
        for stream in listener.incoming().map_while(Result::ok) {
            let _ = answer_ok(stream);
        }
    });
    Ok(responder_addr)
}

fn answer_ok(stream: TcpStream) -> io::Result<()> {
    let mut reader = BufReader::new(stream);
    let mut content_length: usize = 0;
    loop {
        let mut header_line = String::new();
        if reader.read_line(&mut header_line)? == 0 || header_line.trim().is_empty() {
            break;
        }
        if let Some((header_name, header_value)) = header_line.split_once(':')
            && header_name.trim().eq_ignore_ascii_case("content-length")
        {
            content_length = header_value.trim().parse().unwrap_or_default();
        }
    }
    let mut request_body = vec![0; content_length];
    reader.read_exact(&mut request_body)?;
    reader
        .get_mut()
        .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
}
