<?php
// An app's test on PHP's own streams: it sends an email and reads its code, sends an SMS and
// waits for it, and captures an outgoing HTTP call, all against a running SendMock.

$sendmockUrl = getenv('SENDMOCK_URL') ?: 'http://127.0.0.1:8025';

function call(string $method, string $path, ?array $body = null): mixed
{
    global $sendmockUrl;
    $options = ['http' => ['method' => $method, 'ignore_errors' => true, 'timeout' => 30]];
    if ($body !== null) {
        $options['http']['header'] = "Content-Type: application/json\r\n";
        $options['http']['content'] = json_encode($body);
    }
    $answer = file_get_contents($sendmockUrl . $path, false, stream_context_create($options));
    $statusLine = $http_response_header[0] ?? '';
    if (!preg_match('/ 2\d\d /', $statusLine)) {
        fwrite(STDERR, "$method $path answered $statusLine: $answer\n");
        exit(1);
    }
    return json_decode($answer, true);
}

function expectEqual(mixed $actual, mixed $expected, string $what): void
{
    if ($actual !== $expected) {
        fwrite(STDERR, "$what: expected " . var_export($expected, true) . ', got ' . var_export($actual, true) . "\n");
        exit(1);
    }
}

call('POST', '/api/v1/send', ['from' => 'app@shop.test', 'to' => ['php@example.test'], 'subject' => 'Your code', 'text' => 'Your code is 482913']);
$otp = call('GET', '/api/v1/otp?' . http_build_query(['to' => 'php@example.test', 'timeout' => '10s']));
expectEqual($otp['code'], '482913', 'The code in the email');

call('POST', '/api/v1/sms', ['from' => '+15550001111', 'to' => '+15550002222', 'body' => 'Hello from PHP']);
$sms = call('GET', '/api/v1/wait/sms?' . http_build_query(['to' => '+15550002222', 'timeout' => '10s']));
expectEqual($sms['body'], 'Hello from PHP', 'The SMS body');

call('POST', '/catch/php-orders/orders', ['order' => 42]);
$captured = call('GET', '/api/v1/wait/http?' . http_build_query(['bin' => 'php-orders', 'timeout' => '10s']));
expectEqual($captured['method'], 'POST', "The captured request's method");
expectEqual(str_contains($captured['body'], '"order":42'), true, 'The captured body');

echo "PHP: email, SMS and HTTP capture all work.\n";
