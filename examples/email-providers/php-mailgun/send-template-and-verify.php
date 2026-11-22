<?php

// The official Mailgun PHP SDK sends with a stored template and with `v:` variables, as a
// Laravel app tags its mail with its own ids; a simulated delivery's `mailgun.events` webhook must
// then carry those variables and the message id the SDK got back.
// AC: EM-24.5

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Mailgun\Mailgun;

const SENDING_DOMAIN = 'mg.shop.test';
const WEBHOOK_TIMEOUT_SECONDS = 30;

$sendmockUrl = getenv('SENDMOCK_URL') ?: 'http://127.0.0.1:8025';
$providerUrl = getenv('SENDMOCK_PROVIDER_URL') ?: 'http://127.0.0.1:8026';

/** Calls SendMock's REST API with a JSON body; answers the decoded answer. */
function callSendMock(string $sendmockUrl, string $method, string $path, ?array $requestBody = null): mixed
{
    $answer = file_get_contents("{$sendmockUrl}/api/v1{$path}", false, stream_context_create([
        'http' => [
            'method' => $method,
            'header' => "Content-Type: application/json\r\n",
            'content' => $requestBody === null ? '' : json_encode($requestBody),
            'ignore_errors' => true,
        ],
    ]));
    $statusLine = $http_response_header[0] ?? '';
    if ($answer === false || !preg_match('/ 2\d\d /', $statusLine)) {
        throw new RuntimeException("{$method} {$path} answered {$statusLine}: {$answer}");
    }

    return $answer === '' ? null : json_decode($answer, true);
}

/** Reads one webhook request's body from the listening socket and answers 200. */
function receiveWebhook($webhookServer): array
{
    $webhookConnection = @stream_socket_accept($webhookServer, WEBHOOK_TIMEOUT_SECONDS);
    if ($webhookConnection === false) {
        throw new RuntimeException('No webhook arrived');
    }
    $contentLength = 0;
    while (($headerLine = fgets($webhookConnection)) !== false && trim($headerLine) !== '') {
        if (stripos($headerLine, 'content-length:') === 0) {
            $contentLength = (int) trim(substr($headerLine, strlen('content-length:')));
        }
    }
    $webhookBody = $contentLength > 0 ? stream_get_contents($webhookConnection, $contentLength) : '';
    fwrite($webhookConnection, "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    fclose($webhookConnection);

    return json_decode((string) $webhookBody, true) ?? [];
}

function stripBrackets(string $messageId): string
{
    return trim($messageId, '<>');
}

callSendMock($sendmockUrl, 'POST', '/emails/templates', [
    'id' => 'order-delivered',
    'subject' => 'Order {{ order_id }} delivered',
    'text' => 'Hi {{ name }}, your order arrived.',
    'html' => null,
]);
$variables = callSendMock($sendmockUrl, 'GET', '/webhooks/variables');
$variableNames = array_column($variables['items'] ?? $variables, 'name');
if (!in_array('mailgun_signing_key', $variableNames, true)) {
    callSendMock($sendmockUrl, 'POST', '/webhooks/variables', [
        'name' => 'mailgun_signing_key',
        'kind' => 'secret',
        'scope' => 'global',
        'value' => 'key-sendmock-example',
        'description' => "Signs SendMock's Mailgun webhooks for the SDK check",
    ]);
}
$webhookServer = stream_socket_server('tcp://127.0.0.1:0');
$webhookUrl = 'http://' . stream_socket_get_name($webhookServer, false) . '/mailgun';
$endpoint = callSendMock($sendmockUrl, 'POST', '/webhooks/endpoints', [
    'name' => 'Mailgun variables from PHP',
    'url' => $webhookUrl,
    'is_enabled' => true,
    'method' => 'POST',
    'headers' => new stdClass(),
    'extra_fields' => new stdClass(),
    'template_id' => 'mailgun.events',
    'template_mode' => 'linked',
    'timeout_ms' => 10000,
    'retry_policy' => ['max_attempts' => 2, 'backoff_seconds' => [1], 'retry_on_client_errors' => false],
    'query_params' => [],
    'body_mode' => 'template',
    'body_fields' => [],
    'fields_encoding' => 'json',
    'raw_content_type' => 'application/json',
    'raw_body' => '',
    'render_mode' => 'strict',
]);

$mailgun = Mailgun::create('key-sendmock-example', $providerUrl);
$sent = $mailgun->messages()->send(SENDING_DOMAIN, [
    'from' => 'Shop <orders@' . SENDING_DOMAIN . '>',
    'to' => 'ana@example.test',
    'template' => 'order-delivered',
    't:variables' => json_encode(['order_id' => 'A-2002', 'name' => 'Ana']),
    'v:order-id' => 'A-2002',
    'h:X-Mailgun-Variables' => json_encode(['customer_id' => 7]),
]);
$emailPage = callSendMock($sendmockUrl, 'GET', '/emails?limit=1');
$emailId = $emailPage['items'][0]['id'];
callSendMock($sendmockUrl, 'POST', "/emails/{$emailId}/simulate", [
    'event' => 'delivered',
    'webhook_endpoint_ids' => [$endpoint['id']],
]);
$webhook = receiveWebhook($webhookServer);
fclose($webhookServer);

$eventData = $webhook['event-data'] ?? [];
$userVariables = $eventData['user-variables'] ?? [];
if (($userVariables['order-id'] ?? null) !== 'A-2002' || ($userVariables['customer_id'] ?? null) !== 7) {
    throw new RuntimeException('user-variables: ' . json_encode($userVariables));
}
$webhookMessageId = $eventData['message']['headers']['message-id'] ?? '';
if ($webhookMessageId !== stripBrackets($sent->getId())) {
    throw new RuntimeException("message-id {$webhookMessageId}, sent {$sent->getId()}");
}
echo "Template send {$sent->getId()}: its webhook carries the variables and the id\n";
