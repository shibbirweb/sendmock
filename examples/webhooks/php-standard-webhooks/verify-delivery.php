<?php

// The official Standard Webhooks library for PHP verifies a native delivery from SendMock: a
// rule sends an email.received webhook to a local receiver, which checks the signature with
// the endpoint's whsec_ secret and refuses a tampered body (WH-04.1).

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use StandardWebhooks\Exception\WebhookVerificationException;
use StandardWebhooks\Webhook;

const DELIVERY_TIMEOUT_SECONDS = 30;

function callSendMock(string $sendmockUrl, string $method, string $path, ?array $requestBody = null): array
{
    $requestContext = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => "Content-Type: application/json\r\n",
            'content' => $requestBody === null ? '' : json_encode($requestBody),
            'ignore_errors' => true,
        ],
    ]);
    $responseBody = file_get_contents("{$sendmockUrl}/api/v1{$path}", false, $requestContext);
    $statusLine = $http_response_header[0] ?? '';
    if (!preg_match('/ 2\d\d /', $statusLine)) {
        throw new RuntimeException("{$method} {$path} answered {$statusLine}: {$responseBody}");
    }

    return json_decode((string) $responseBody, true) ?? [];
}

/** An endpoint for the receiver with a rule for every received email; answers its secret. */
function connectEndpoint(string $sendmockUrl, string $receiverUrl): string
{
    $endpoint = callSendMock($sendmockUrl, 'POST', '/webhooks/endpoints', [
        'name' => 'PHP verifier',
        'url' => $receiverUrl,
        'method' => 'POST',
        'headers' => new stdClass(),
        'extra_fields' => new stdClass(),
        'template_id' => 'native',
        'template_mode' => 'linked',
        'timeout_ms' => 10000,
        'retry_policy' => ['max_attempts' => 1, 'backoff_seconds' => [1], 'retry_on_client_errors' => false],
        'is_enabled' => true,
        'query_params' => [],
        'body_mode' => 'template',
        'body_fields' => [],
        'fields_encoding' => 'json',
        'raw_content_type' => 'application/json',
        'raw_body' => '',
        'render_mode' => 'strict',
    ]);
    callSendMock($sendmockUrl, 'POST', '/webhooks/rules', [
        'name' => 'Every received email',
        'endpoint_id' => $endpoint['id'],
        'events' => ['email.received'],
        'filter' => null,
        'is_enabled' => true,
    ]);

    return callSendMock($sendmockUrl, 'GET', "/webhooks/endpoints/{$endpoint['id']}/secret")['secret'];
}

/**
 * PHP has no background threads, so the script answers the webhook itself once the send has
 * returned; until then it waits in the listening socket's queue. Header names come back in
 * lowercase, as the library reads them.
 */
function receiveDelivery($receiverSocket): array
{
    $receiverConnection = @stream_socket_accept($receiverSocket, DELIVERY_TIMEOUT_SECONDS);
    if ($receiverConnection === false) {
        throw new RuntimeException('No webhook arrived');
    }
    fgets($receiverConnection);
    $headers = [];
    while (($headerLine = fgets($receiverConnection)) !== false && trim($headerLine) !== '') {
        [$headerName, $headerValue] = array_map('trim', explode(':', $headerLine, 2)) + [1 => ''];
        $headers[strtolower($headerName)] = $headerValue;
    }
    $contentLength = (int) ($headers['content-length'] ?? 0);
    $rawBody = $contentLength > 0 ? (string) stream_get_contents($receiverConnection, $contentLength) : '';
    fwrite($receiverConnection, "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n");
    fclose($receiverConnection);

    return [$rawBody, $headers];
}

$sendmockUrl = getenv('SENDMOCK_URL') ?: 'http://127.0.0.1:8025';
$receiverSocket = stream_socket_server('tcp://127.0.0.1:0');
$receiverAddress = stream_socket_get_name($receiverSocket, false);
$webhookSecret = connectEndpoint($sendmockUrl, "http://{$receiverAddress}/webhooks");
callSendMock($sendmockUrl, 'POST', '/send', [
    'from' => 'shop@example.test',
    'to' => ['sam@example.test'],
    'subject' => 'Signed by SendMock',
    'text' => 'Hello',
]);
[$rawBody, $headers] = receiveDelivery($receiverSocket);
fclose($receiverSocket);

$webhook = new Webhook($webhookSecret);
$verifiedEvent = $webhook->verify($rawBody, $headers);
if (($verifiedEvent['type'] ?? null) !== 'email.received') {
    throw new RuntimeException('Unexpected event ' . json_encode($verifiedEvent));
}
try {
    $webhook->verify($rawBody . ' ', $headers);
    throw new RuntimeException('A tampered body passed verification');
} catch (WebhookVerificationException) {
}
echo "Verified {$headers['webhook-id']} ({$verifiedEvent['type']}) with standard-webhooks; a tampered body is refused.\n";
