---
title: Java
description: Connect Java apps to SendMock with jakarta Mail, Spring and HttpClient.
---

> **Applies from the first beta (Phase 1) for email and Phase 2 for SMS.** See [Connect your app](./index.md) for the ports.

## Email

Spring Boot `application.properties`:

```properties
spring.mail.host=127.0.0.1
spring.mail.port=1025
```

Jakarta Mail: set `mail.smtp.host` to `127.0.0.1` and `mail.smtp.port` to `1025`.

## SMS

```java
var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8025/api/v1/sms"))
    .header("content-type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(
        "{\"from\":\"+15550001111\",\"to\":\"+8801700000000\",\"body\":\"Your code is 482913\"}"))
    .build();
HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
```

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms/index.md) and [Email](../mail/index.md) pages list the providers.

## Test helper

Save this as `src/test/java/app/SendMock.java`. The code examples in the [recipes](../recipes/index.md) use it to call SendMock and your app.

```java title="src/test/java/app/SendMock.java"
package app;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public final class SendMock {
    public static final String SENDMOCK = "http://127.0.0.1:8025/api/v1";
    public static final String APP = "http://localhost:8080";
    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Calls SendMock or your app; returns the JSON answer, or null when there is none. */
    public static JsonNode call(String method, String url, Object body) throws Exception {
        var publisher = body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body));
        var request = HttpRequest.newBuilder(URI.create(url))
            .header("Content-Type", "application/json")
            .method(method, publisher)
            .build();
        var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException(method + " " + url + " answered " + response.statusCode());
        }
        var contentType = response.headers().firstValue("Content-Type").orElse("");

        return contentType.contains("json") ? JSON.readTree(response.body()) : null;
    }
}
```
