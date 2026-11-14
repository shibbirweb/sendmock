// The official Twilio Java SDK against SendMock: an SMS with status callbacks to a local
// handler, then a Verify login with the code read from SendMock's API (SM-02.4).
package test.sendmock;

import com.sun.net.httpserver.HttpServer;
import com.twilio.http.TwilioRestClient;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.rest.verify.v2.Service;
import com.twilio.rest.verify.v2.service.Verification;
import com.twilio.rest.verify.v2.service.VerificationCheck;
import com.twilio.type.PhoneNumber;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SendAndVerify {
    private static final String RECIPIENT_NUMBER = "+14155550104";
    private static final List<String> EXPECTED_STATUSES = List.of("queued", "sent", "delivered");
    private static final Duration CALLBACK_TIMEOUT = Duration.ofSeconds(60);
    private static final Pattern VERIFY_CODE_FIELD = Pattern.compile("\"code\"\\s*:\\s*\"([^\"]+)\"");

    public static void main(String[] arguments) throws Exception {
        String providerUrl = environmentOrDefault("SENDMOCK_PROVIDER_URL", "http://127.0.0.1:8026");
        String sendmockUrl = environmentOrDefault("SENDMOCK_URL", "http://127.0.0.1:8025");
        TwilioRestClient client = new TwilioRestClient.Builder("AC00000000000000000000000000000005", "any-auth-token")
                .httpClient(new SendMockHttpClient(URI.create(providerUrl)))
                .build();

        sendWithStatusCallbacks(client);
        runVerifyLogin(client, sendmockUrl);
    }

    private static void sendWithStatusCallbacks(TwilioRestClient client) throws Exception {
        List<String> receivedStatuses = new CopyOnWriteArrayList<>();
        HttpServer callbackServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        callbackServer.createContext("/status", exchange -> {
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            receivedStatuses.add(readFormField(requestBody, "MessageStatus"));
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
        });
        callbackServer.start();
        try {
            String callbackUrl = "http://127.0.0.1:" + callbackServer.getAddress().getPort() + "/status";
            Message message = Message.creator(
                            new PhoneNumber(RECIPIENT_NUMBER), new PhoneNumber("+15005550006"), "Your order has shipped")
                    .setStatusCallback(URI.create(callbackUrl))
                    .create(client);
            System.out.println("Sent " + message.getSid() + " (" + message.getStatus() + ")");
            waitForStatuses(receivedStatuses);
            System.out.println("Status callbacks: " + String.join(", ", receivedStatuses));
        } finally {
            callbackServer.stop(0);
        }
    }

    private static void waitForStatuses(List<String> receivedStatuses) throws InterruptedException {
        Instant deadline = Instant.now().plus(CALLBACK_TIMEOUT);
        while (receivedStatuses.size() < EXPECTED_STATUSES.size()) {
            if (Instant.now().isAfter(deadline)) {
                throw new IllegalStateException("Callbacks so far: " + receivedStatuses);
            }
            Thread.sleep(250);
        }
        if (!receivedStatuses.equals(EXPECTED_STATUSES)) {
            throw new IllegalStateException("Callbacks out of order: " + receivedStatuses);
        }
    }

    private static void runVerifyLogin(TwilioRestClient client, String sendmockUrl) throws Exception {
        Service verifyService = Service.creator("Java shop").create(client);
        Verification verification =
                Verification.creator(verifyService.getSid(), RECIPIENT_NUMBER, "sms").create(client);
        String verifyCode = readVerifyCode(sendmockUrl, RECIPIENT_NUMBER);
        VerificationCheck verificationCheck = VerificationCheck.creator(verifyService.getSid())
                .setTo(RECIPIENT_NUMBER)
                .setCode(verifyCode)
                .create(client);
        if (!"approved".equals(verificationCheck.getStatus())) {
            throw new IllegalStateException("Verify login ended " + verificationCheck.getStatus());
        }
        System.out.println("Verify login " + verification.getSid() + " approved with " + verifyCode);
    }

    private static String readVerifyCode(String sendmockUrl, String phoneNumber)
            throws IOException, InterruptedException {
        String query = "to=" + URLEncoder.encode(phoneNumber, StandardCharsets.UTF_8) + "&channel=verify";
        HttpRequest otpRequest = HttpRequest.newBuilder(URI.create(sendmockUrl + "/api/v1/otp?" + query))
                .build();
        HttpResponse<String> otpResponse =
                HttpClient.newHttpClient().send(otpRequest, HttpResponse.BodyHandlers.ofString());
        Matcher codeMatch = VERIFY_CODE_FIELD.matcher(otpResponse.body());
        if (otpResponse.statusCode() != 200 || !codeMatch.find()) {
            throw new IllegalStateException("No Verify code for " + phoneNumber + ": " + otpResponse.statusCode());
        }
        return codeMatch.group(1);
    }

    private static String readFormField(String formBody, String fieldName) {
        return Arrays.stream(formBody.split("&"))
                .map(pair -> pair.split("=", 2))
                .filter(pair -> pair.length == 2 && URLDecoder.decode(pair[0], StandardCharsets.UTF_8).equals(fieldName))
                .map(pair -> URLDecoder.decode(pair[1], StandardCharsets.UTF_8))
                .findFirst()
                .orElse("");
    }

    private static String environmentOrDefault(String variableName, String defaultValue) {
        String value = System.getenv(variableName);
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        return value;
    }
}
