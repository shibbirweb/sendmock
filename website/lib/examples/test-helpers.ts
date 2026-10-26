/**
 * The small `call` helper the code examples use in languages whose HTTP
 * client is long-winded, shown once on each Connect page (WS-08).
 */

export type TestHelper = {
  /** The Connect page, relative to docs/wiki. */
  page: string;
  fileName: string;
  fenceLanguage: string;
  code: string;
};

const javaScriptHelper = `export const SENDMOCK = "http://127.0.0.1:8025/api/v1";
export const APP = "http://localhost:3000";

/** Calls SendMock or your app; returns the JSON answer, or null when there is none. */
export async function call(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(\`\${method} \${url} answered \${response.status}\`);
  }
  const isJson = response.headers.get("content-type")?.includes("json") ?? false;

  return isJson ? response.json() : null;
}`;

const goHelper = `package app_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

const sendmock = "http://127.0.0.1:8025/api/v1"
const app = "http://localhost:8080"

// call calls SendMock or your app and returns the JSON answer, or nil when there is none.
func call(t *testing.T, method, url string, body any) any {
	t.Helper()
	var payload bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&payload).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	request, err := http.NewRequest(method, url, &payload)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 {
		t.Fatalf("%s %s answered %d", method, url, response.StatusCode)
	}
	if !strings.Contains(response.Header.Get("Content-Type"), "json") {
		return nil
	}
	var answer any
	if err := json.NewDecoder(response.Body).Decode(&answer); err != nil {
		t.Fatal(err)
	}
	return answer
}`;

const javaHelper = `package app;

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
}`;

const rustHelper = `use serde_json::Value;

pub const SENDMOCK: &str = "http://127.0.0.1:8025/api/v1";
pub const APP: &str = "http://localhost:8080";

/// Calls SendMock or your app and returns the JSON answer, or \`Value::Null\` when there is none.
pub async fn call(method: &str, url: &str, body: Option<Value>) -> Value {
    let method = reqwest::Method::from_bytes(method.as_bytes()).expect("an HTTP method");
    let mut request = reqwest::Client::new().request(method, url);
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request
        .send()
        .await
        .expect("the request is sent")
        .error_for_status()
        .expect("a success status");
    let is_json = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .map_or(false, |value| value.contains("json"));
    if is_json {
        response.json().await.expect("a JSON answer")
    } else {
        Value::Null
    }
}`;

const rubyHelper = `require "json"
require "net/http"

SENDMOCK = "http://127.0.0.1:8025/api/v1"
APP = "http://localhost:3000"

# Calls SendMock or your app; returns the JSON answer, or nil when there is none.
def call(method, url, body = nil)
  uri = URI(url)
  headers = { "Content-Type" => "application/json" }
  request = Net::HTTPGenericRequest.new(method, !body.nil?, true, uri.request_uri, headers)
  if body
    request.body = body.to_json
  end
  response = Net::HTTP.start(uri.host, uri.port) { |http| http.request(request) }
  if response.code.to_i >= 400
    raise "#{method} #{url} answered #{response.code}"
  end

  response.content_type.to_s.include?("json") ? JSON.parse(response.body) : nil
end`;

const csharpHelper = `using System.Net.Http.Json;
using System.Text.Json;

public static class SendMock
{
    public const string Sendmock = "http://127.0.0.1:8025/api/v1";
    public const string App = "http://localhost:5000";
    private static readonly HttpClient Http = new();

    /// <summary>Calls SendMock or your app; returns the JSON answer, or an undefined element when there is none.</summary>
    public static async Task<JsonElement> Call(string method, string url, object? body = null)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        using var response = await Http.SendAsync(request);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentType?.MediaType?.Contains("json") != true)
        {
            return default;
        }

        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}`;

export const testHelpers: TestHelper[] = [
  {
    page: "connect/node.md",
    fileName: "sendmock.js",
    fenceLanguage: "js",
    code: javaScriptHelper,
  },
  {
    page: "connect/go.md",
    fileName: "sendmock_test.go",
    fenceLanguage: "go",
    code: goHelper,
  },
  {
    page: "connect/java.md",
    fileName: "src/test/java/app/SendMock.java",
    fenceLanguage: "java",
    code: javaHelper,
  },
  {
    page: "connect/rust.md",
    fileName: "tests/sendmock/mod.rs",
    fenceLanguage: "rust",
    code: rustHelper,
  },
  {
    page: "connect/ruby.md",
    fileName: "spec/sendmock_helper.rb",
    fenceLanguage: "ruby",
    code: rubyHelper,
  },
  {
    page: "connect/dotnet.md",
    fileName: "SendMock.cs",
    fenceLanguage: "csharp",
    code: csharpHelper,
  },
];
