// An app's test on Java's own java.net.http: it sends an email and reads its code, sends an SMS
// and waits for it, and captures an outgoing HTTP call, all against a running SendMock. Run it
// as a single file: `java SmokeTest.java`.
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SmokeTest {
    private static final String SENDMOCK_URL =
            System.getenv().getOrDefault("SENDMOCK_URL", "http://127.0.0.1:8025");
    private static final HttpClient HTTP_CLIENT =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    static String call(String method, String path, String jsonBody) throws Exception {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(SENDMOCK_URL + path))
                .timeout(Duration.ofSeconds(30));
        if (jsonBody == null) {
            requestBuilder.GET();
        } else {
            requestBuilder.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(jsonBody));
        }
        HttpResponse<String> response =
                HTTP_CLIENT.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 300) {
            fail(method + " " + path + " answered " + response.statusCode() + ": " + response.body());
        }
        return response.body();
    }

    /** A top-level string field of a JSON answer; enough for these checks without a library. */
    static String readString(String jsonAnswer, String fieldName) {
        Matcher fieldMatcher = Pattern.compile("\"" + fieldName + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(jsonAnswer);
        return fieldMatcher.find() ? fieldMatcher.group(1).replace("\\\"", "\"") : null;
    }

    static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    static void fail(String message) {
        System.err.println(message);
        System.exit(1);
    }

    static void expectEqual(Object actual, Object expected, String what) {
        if (!expected.equals(actual)) {
            fail(what + ": expected " + expected + ", got " + actual);
        }
    }

    public static void main(String[] arguments) throws Exception {
        call("POST", "/api/v1/send", "{\"from\":\"app@shop.test\",\"to\":[\"java@example.test\"],\"subject\":\"Your code\",\"text\":\"Your code is 482913\"}");
        String otp = call("GET", "/api/v1/otp?to=" + encode("java@example.test") + "&timeout=10s", null);
        expectEqual(readString(otp, "code"), "482913", "The code in the email");

        call("POST", "/api/v1/sms", "{\"from\":\"+15550001111\",\"to\":\"+15550002222\",\"body\":\"Hello from Java\"}");
        String sms = call("GET", "/api/v1/wait/sms?to=" + encode("+15550002222") + "&timeout=10s", null);
        expectEqual(readString(sms, "body"), "Hello from Java", "The SMS body");

        call("POST", "/catch/java-orders/orders", "{\"order\":42}");
        String captured = call("GET", "/api/v1/wait/http?bin=java-orders&timeout=10s", null);
        expectEqual(readString(captured, "method"), "POST", "The captured request's method");
        expectEqual(readString(captured, "body"), "{\"order\":42}", "The captured body");

        System.out.println("Java: email, SMS and HTTP capture all work.");
    }
}
