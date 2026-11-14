# The official Twilio Ruby SDK against SendMock: an SMS with status callbacks to a local
# handler, then a Verify login with the code read from SendMock's API (SM-02.4).
require "json"
require "net/http"
require "socket"
require "uri"
require "twilio-ruby"

PROVIDER_URL = ENV.fetch("SENDMOCK_PROVIDER_URL", "http://127.0.0.1:8026")
SENDMOCK_URL = ENV.fetch("SENDMOCK_URL", "http://127.0.0.1:8025")
RECIPIENT_NUMBER = "+14155550106".freeze
EXPECTED_STATUSES = %w[queued sent delivered].freeze
CALLBACK_TIMEOUT_SECONDS = 60

# Sends every Twilio request to SendMock's provider port, keeping its path and query.
class SendMockHttpClient < Twilio::HTTP::Client
  def initialize(provider_url)
    super()
    @provider_url = URI(provider_url)
  end

  def request(_host, _port, method, url, *other_arguments)
    twilio_url = URI(url)
    sendmock_url = @provider_url.dup
    sendmock_url.path = twilio_url.path
    sendmock_url.query = twilio_url.query
    provider_origin = "#{@provider_url.scheme}://#{@provider_url.host}"
    super(provider_origin, @provider_url.port, method, sendmock_url.to_s, *other_arguments)
  end
end

# A local status callback handler that records each `MessageStatus` it receives.
class StatusCallbackHandler
  attr_reader :callback_url

  def initialize
    @server = TCPServer.new("127.0.0.1", 0)
    @callback_url = "http://127.0.0.1:#{@server.addr[1]}/status"
    @received_statuses = []
    @mutex = Mutex.new
    @thread = Thread.new { serve_callbacks }
  end

  def received_statuses
    @mutex.synchronize { @received_statuses.dup }
  end

  def wait_for_statuses
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + CALLBACK_TIMEOUT_SECONDS
    while received_statuses.length < EXPECTED_STATUSES.length
      if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
        raise "Callbacks so far: #{received_statuses.join(', ')}"
      end

      sleep 0.25
    end
    if received_statuses != EXPECTED_STATUSES
      raise "Callbacks out of order: #{received_statuses.join(', ')}"
    end
  end

  def stop
    @thread.kill
    @server.close
  end

  private

  def serve_callbacks
    loop do
      callback_connection = @server.accept
      message_status = read_message_status(callback_connection)
      @mutex.synchronize { @received_statuses << message_status }
      callback_connection.write("HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n")
      callback_connection.close
    end
  end

  def read_message_status(callback_connection)
    content_length = 0
    while (header_line = callback_connection.gets) && header_line.strip != ""
      if header_line.downcase.start_with?("content-length:")
        content_length = header_line.split(":", 2).last.strip.to_i
      end
    end
    request_body = content_length.positive? ? callback_connection.read(content_length) : ""
    URI.decode_www_form(request_body.to_s).to_h.fetch("MessageStatus", "")
  end
end

def read_verify_code(phone_number)
  otp_url = URI("#{SENDMOCK_URL}/api/v1/otp")
  otp_url.query = URI.encode_www_form(to: phone_number, channel: "verify")
  otp_response = Net::HTTP.get_response(otp_url)
  unless otp_response.is_a?(Net::HTTPSuccess)
    raise "No Verify code for #{phone_number}: #{otp_response.code}"
  end

  JSON.parse(otp_response.body).fetch("code")
end

client = Twilio::REST::Client.new(
  "AC00000000000000000000000000000007",
  "any-auth-token",
  nil,
  nil,
  SendMockHttpClient.new(PROVIDER_URL)
)

status_callback_handler = StatusCallbackHandler.new
message = client.messages.create(
  from: "+15005550006",
  to: RECIPIENT_NUMBER,
  body: "Your order has shipped",
  status_callback: status_callback_handler.callback_url
)
puts "Sent #{message.sid} (#{message.status})"
status_callback_handler.wait_for_statuses
puts "Status callbacks: #{status_callback_handler.received_statuses.join(', ')}"
status_callback_handler.stop

verify_service = client.verify.v2.services.create(friendly_name: "Ruby shop")
verification = client.verify.v2.services(verify_service.sid)
                     .verifications.create(to: RECIPIENT_NUMBER, channel: "sms")
verify_code = read_verify_code(RECIPIENT_NUMBER)
verification_check = client.verify.v2.services(verify_service.sid)
                           .verification_checks.create(to: RECIPIENT_NUMBER, code: verify_code)
if verification_check.status != "approved"
  raise "Verify login ended #{verification_check.status}"
end

puts "Verify login #{verification.sid} approved with #{verify_code}"
