# Example apps

An app's test in each of eight languages, written with the language's own HTTP client, the way the guide's code examples are. Each one sends an email and reads its one-time code, sends an SMS and waits for it, and captures an outgoing HTTP call in a bin. CI runs all eight against a release binary (`.github/workflows/example-apps.yml`), and Release build runs them before it publishes.

| Folder | Language | Run with |
| --- | --- | --- |
| `php/` | PHP streams | `php smoke.php` |
| `node/` | Node `fetch` | `node smoke.mjs` |
| `python/` | `urllib` | `python smoke.py` |
| `go/` | `net/http` | `go run .` |
| `java/` | `java.net.http` | `java SmokeTest.java` |
| `rust/` | `reqwest` | `cargo run` |
| `ruby/` | `Net::HTTP` | `ruby smoke.rb` |
| `dotnet/` | `HttpClient` | `dotnet run` |

To run one by hand:

1. Start SendMock.

   ```sh
   sendmock --db memory
   ```

2. Go to the language's folder.

   ```sh
   cd examples/apps/python
   ```

3. Run its test. It prints one line when every step passed, and exits with an error otherwise.

   ```sh
   python smoke.py
   ```

Set `SENDMOCK_URL` when SendMock runs somewhere else than `http://127.0.0.1:8025`.
