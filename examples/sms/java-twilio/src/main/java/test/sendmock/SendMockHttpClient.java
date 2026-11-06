package test.sendmock;

import com.twilio.exception.ApiConnectionException;
import com.twilio.http.HttpMethod;
import com.twilio.http.Request;
import com.twilio.http.Response;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

/** Sends every Twilio request to SendMock's provider port, keeping its path and query. */
final class SendMockHttpClient extends com.twilio.http.HttpClient {
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final URI providerUrl;

    SendMockHttpClient(URI providerUrl) {
        this.providerUrl = providerUrl;
    }

    @Override
    public Response makeRequest(Request twilioRequest) {
        URL twilioUrl = twilioRequest.constructURL();
        HttpRequest.Builder sendmockRequest = HttpRequest.newBuilder(providerUrl.resolve(twilioUrl.getFile()));
        if (twilioRequest.requiresAuthentication()) {
            sendmockRequest.header("Authorization", twilioRequest.getAuthString());
        }
        for (Map.Entry<String, List<String>> header : twilioRequest.getHeaderParams().entrySet()) {
            for (String headerValue : header.getValue()) {
                sendmockRequest.header(header.getKey(), headerValue);
            }
        }
        if (twilioRequest.getMethod() == HttpMethod.GET) {
            sendmockRequest.GET();
        } else {
            sendmockRequest
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .method(
                            twilioRequest.getMethod().toString(),
                            HttpRequest.BodyPublishers.ofString(twilioRequest.encodeFormBody()));
        }
        try {
            HttpResponse<String> sendmockResponse =
                    httpClient.send(sendmockRequest.build(), HttpResponse.BodyHandlers.ofString());
            return new Response(sendmockResponse.body(), sendmockResponse.statusCode());
        } catch (IOException requestError) {
            throw new ApiConnectionException("SendMock request failed: " + requestError.getMessage(), requestError);
        } catch (InterruptedException interruption) {
            Thread.currentThread().interrupt();
            throw new ApiConnectionException("SendMock request interrupted", interruption);
        }
    }
}
