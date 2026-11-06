<?php

// The official Twilio PHP SDK against SendMock: an SMS with status callbacks to a local
// handler, then a Verify login with the code read from SendMock's API (SM-02.4).

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Twilio\AuthStrategy\AuthStrategy;
use Twilio\Http\CurlClient;
use Twilio\Http\Response;
use Twilio\Rest\Client;

const RECIPIENT_NUMBER = '+14155550102';
const EXPECTED_STATUSES = ['queued', 'sent', 'delivered'];
const CALLBACK_TIMEOUT_SECONDS = 60;

/** Sends every Twilio request to SendMock's provider port, keeping its path and query. */
final class SendMockCurlClient extends CurlClient
{
    public function __construct(private readonly string $providerUrl)
    {
        parent::__construct();
    }

    public function request(
        string $method,
        string $url,
        array $params = [],
        array $data = [],
        array $headers = [],
        ?string $user = null,
        ?string $password = null,
        ?int $timeout = null,
        ?AuthStrategy $authStrategy = null,
    ): Response {
        $twilioUrl = parse_url($url);
        $pathAndQuery = ($twilioUrl['path'] ?? '/');
        if (isset($twilioUrl['query'])) {
            $pathAndQuery .= '?' . $twilioUrl['query'];
        }

        return parent::request(
            $method,
            rtrim($this->providerUrl, '/') . $pathAndQuery,
            $params,
            $data,
            $headers,
            $user,
            $password,
            $timeout,
            $authStrategy,
        );
    }
}

/** Reads one status callback request and returns its `MessageStatus`. */
function readMessageStatus($callbackConnection): string
{
    $contentLength = 0;
    while (($headerLine = fgets($callbackConnection)) !== false && trim($headerLine) !== '') {
        if (stripos($headerLine, 'content-length:') === 0) {
            $contentLength = (int) trim(substr($headerLine, strlen('content-length:')));
        }
    }
    $requestBody = $contentLength > 0 ? stream_get_contents($callbackConnection, $contentLength) : '';
    parse_str((string) $requestBody, $callbackFields);

    return (string) ($callbackFields['MessageStatus'] ?? '');
}

/**
 * PHP has no background threads, so the script answers the callbacks itself once the send has
 * returned; until then they wait in the listening socket's queue.
 */
function waitForStatuses($callbackServer): array
{
    $receivedStatuses = [];
    $deadline = microtime(true) + CALLBACK_TIMEOUT_SECONDS;
    while (count($receivedStatuses) < count(EXPECTED_STATUSES)) {
        $remainingSeconds = $deadline - microtime(true);
        if ($remainingSeconds <= 0) {
            throw new RuntimeException('Callbacks so far: ' . implode(', ', $receivedStatuses));
        }
        $callbackConnection = @stream_socket_accept($callbackServer, $remainingSeconds);
        if ($callbackConnection === false) {
            continue;
        }
        $receivedStatuses[] = readMessageStatus($callbackConnection);
        fwrite($callbackConnection, "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n");
        fclose($callbackConnection);
    }
    if ($receivedStatuses !== EXPECTED_STATUSES) {
        throw new RuntimeException('Callbacks out of order: ' . implode(', ', $receivedStatuses));
    }

    return $receivedStatuses;
}

function readVerifyCode(string $sendmockUrl, string $phoneNumber): string
{
    $query = http_build_query(['to' => $phoneNumber, 'channel' => 'verify']);
    $otpResponse = file_get_contents("{$sendmockUrl}/api/v1/otp?{$query}");
    $verifyCode = json_decode((string) $otpResponse, true)['code'] ?? null;
    if ($verifyCode === null) {
        throw new RuntimeException("No Verify code for {$phoneNumber}");
    }

    return $verifyCode;
}

$providerUrl = getenv('SENDMOCK_PROVIDER_URL') ?: 'http://127.0.0.1:8026';
$sendmockUrl = getenv('SENDMOCK_URL') ?: 'http://127.0.0.1:8025';
$client = new Client(
    'AC00000000000000000000000000000003',
    'any-auth-token',
    null,
    null,
    new SendMockCurlClient($providerUrl),
);

$callbackServer = stream_socket_server('tcp://127.0.0.1:0');
$callbackAddress = stream_socket_get_name($callbackServer, false);
$message = $client->messages->create(RECIPIENT_NUMBER, [
    'from' => '+15005550006',
    'body' => 'Your order has shipped',
    'statusCallback' => "http://{$callbackAddress}/status",
]);
echo "Sent {$message->sid} ({$message->status})\n";
$receivedStatuses = waitForStatuses($callbackServer);
echo 'Status callbacks: ' . implode(', ', $receivedStatuses) . "\n";
fclose($callbackServer);

$verifyService = $client->verify->v2->services->create('PHP shop');
$verification = $client->verify->v2->services($verifyService->sid)
    ->verifications->create(RECIPIENT_NUMBER, 'sms');
$verifyCode = readVerifyCode($sendmockUrl, RECIPIENT_NUMBER);
$verificationCheck = $client->verify->v2->services($verifyService->sid)
    ->verificationChecks->create(['to' => RECIPIENT_NUMBER, 'code' => $verifyCode]);
if ($verificationCheck->status !== 'approved') {
    throw new RuntimeException("Verify login ended {$verificationCheck->status}");
}
echo "Verify login {$verification->sid} approved with {$verifyCode}\n";
