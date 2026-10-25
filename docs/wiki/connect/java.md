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

To use a provider SDK (Twilio, SendGrid, ...) instead, set its base URL to the provider port `http://127.0.0.1:8026`; the [SMS](../sms.md) and [Email](../email.md) pages list the providers.
