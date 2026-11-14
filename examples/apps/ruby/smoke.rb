# An app's test on Ruby's own Net::HTTP: it sends an email and reads its code, sends an SMS and
# waits for it, and captures an outgoing HTTP call, all against a running SendMock.
require "json"
require "net/http"
require "uri"

SENDMOCK_URL = ENV.fetch("SENDMOCK_URL", "http://127.0.0.1:8025")

def call(method, path, body = nil)
  uri = URI("#{SENDMOCK_URL}#{path}")
  request = method == "GET" ? Net::HTTP::Get.new(uri) : Net::HTTP::Post.new(uri)
  unless body.nil?
    request["Content-Type"] = "application/json"
    request.body = JSON.generate(body)
  end
  response = Net::HTTP.start(uri.host, uri.port, read_timeout: 30) { |http| http.request(request) }
  abort("#{method} #{path} answered #{response.code}: #{response.body}") unless response.code.start_with?("2")
  JSON.parse(response.body)
end

def expect_equal(actual, expected, what)
  abort("#{what}: expected #{expected.inspect}, got #{actual.inspect}") unless actual == expected
end

call("POST", "/api/v1/send", { from: "app@shop.test", to: ["ruby@example.test"], subject: "Your code", text: "Your code is 482913" })
otp = call("GET", "/api/v1/otp?#{URI.encode_www_form(to: "ruby@example.test", timeout: "10s")}")
expect_equal(otp["code"], "482913", "The code in the email")

call("POST", "/api/v1/sms", { from: "+15550001111", to: "+15550002222", body: "Hello from Ruby" })
sms = call("GET", "/api/v1/wait/sms?#{URI.encode_www_form(to: "+15550002222", timeout: "10s")}")
expect_equal(sms["body"], "Hello from Ruby", "The SMS body")

call("POST", "/catch/ruby-orders/orders", { order: 42 })
captured = call("GET", "/api/v1/wait/http?#{URI.encode_www_form(bin: "ruby-orders", timeout: "10s")}")
expect_equal(captured["method"], "POST", "The captured request's method")
expect_equal(captured["body"].include?('"order":42'), true, "The captured body")

puts "Ruby: email, SMS and HTTP capture all work."
