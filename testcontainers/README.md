# Testcontainers modules

Each folder starts SendMock in Docker from a test, in one language, and gives the three addresses an app under test needs:

- the SMTP host and port, for the app's mail settings;
- the HTTP URL, for the API (`/api/v1/wait/email`, `/api/v1/otp`, ...) and the UI;
- the provider URL, the base URL to give a provider SDK (Twilio, Vonage, ...) instead of the provider's own.

| Language | Folder | Package | Built on |
|----------|--------|---------|----------|
| Java | `java` | `io.github.shibbirweb:sendmock-testcontainers` | Testcontainers 2.0.5 |
| Node | `node` | `sendmock-testcontainers` | testcontainers 12.2.1 |
| Go | `go` | `github.com/shibbirweb/sendmock/testcontainers/go` | testcontainers-go 0.44.0 |
| Python | `python` | `sendmock-testcontainers` | testcontainers 4.15.0 |
| .NET | `dotnet` | `SendMock.Testcontainers` | Testcontainers 4.16.0 |

The default image is `ghcr.io/shibbirweb/sendmock:beta`; every module also takes another image. The packages are not published yet; publishing comes with the 1.0 release work.

CI builds the image from the commit and runs each module's test against it (`.github/workflows/testcontainers.yml`). To run one by hand, for example the Python module:

1. Build the image.

   ```sh
   docker build -t sendmock:testcontainers .
   ```

2. Go to the module.

   ```sh
   cd testcontainers/python
   ```

3. Install it with its test tools.

   ```sh
   pip install ".[test]"
   ```

4. Run its test against the image you built.

   ```sh
   SENDMOCK_IMAGE=sendmock:testcontainers pytest -q
   ```

The other modules replace steps 2 to 4 with their own folder and these commands, with the same `SENDMOCK_IMAGE` set.

Java:

```sh
mvn test
```

Node (Node 24):

```sh
bun install
```

```sh
node --test test/
```

Go:

```sh
go test ./...
```

.NET:

```sh
dotnet test SendMock.Testcontainers.Tests
```
