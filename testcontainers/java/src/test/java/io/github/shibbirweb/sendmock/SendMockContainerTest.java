package io.github.shibbirweb.sendmock;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class SendMockContainerTest {
    private static final String IMAGE =
            System.getenv().getOrDefault("SENDMOCK_IMAGE", SendMockContainer.DEFAULT_IMAGE);

    // DS-06.1
    @Test
    void startsTheImageAndGivesTheSmtpHttpAndProviderAddresses() throws Exception {
        try (SendMockContainer sendmock = new SendMockContainer(IMAGE)) {
            sendmock.start();
            HttpClient httpClient = HttpClient.newHttpClient();

            HttpResponse<String> healthResponse = httpClient.send(
                    HttpRequest.newBuilder(URI.create(sendmock.getHttpUrl() + "/api/v1/health")).build(),
                    HttpResponse.BodyHandlers.ofString());
            HttpResponse<String> twilioResponse = httpClient.send(
                    HttpRequest.newBuilder(URI.create(sendmock.getProviderUrl()
                                    + "/2010-04-01/Accounts/AC00000000000000000000000000000003/Messages.json"))
                            .header("Content-Type", "application/x-www-form-urlencoded")
                            .POST(HttpRequest.BodyPublishers.ofString(
                                    "From=%2B15005550006&To=%2B14155550102&Body=From+Java"))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
            String smtpGreeting;
            try (Socket smtpSocket = new Socket(sendmock.getSmtpHost(), sendmock.getSmtpPort());
                    BufferedReader smtpReader = new BufferedReader(
                            new InputStreamReader(smtpSocket.getInputStream(), StandardCharsets.US_ASCII))) {
                smtpGreeting = smtpReader.readLine();
            }

            assertEquals(200, healthResponse.statusCode());
            assertEquals(201, twilioResponse.statusCode(), twilioResponse.body());
            assertTrue(smtpGreeting.startsWith("220"), smtpGreeting);
        }
    }
}
