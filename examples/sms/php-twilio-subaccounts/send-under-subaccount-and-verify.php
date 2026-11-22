<?php

// The official Twilio PHP SDK against SendMock with a subaccount, as a Laravel app with one
// subaccount per customer works: create it with the main account, read its token with the
// account fetch, send under it, and check every status callback with that token.
// AC: SM-19.8

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Twilio\AuthStrategy\AuthStrategy;
use Twilio\Http\CurlClient;
use Twilio\Http\Response;
use Twilio\Rest\Client;
use Twilio\Security\RequestValidator;

// The shipped Twilio provider's main account; the Accounts API checks it.
const MAIN_ACCOUNT_SID = 'ACtest00000000000000000000000000';
const MAIN_AUTH_TOKEN = 'twilio-test-token';
const EXPECTED_CALLBACK_COUNT = 3;
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

/** Reads one callback request: its `X-Twilio-Signature` and its form fields. */
function readCallback($callbackConnection): array
{
    $contentLength = 0;
    $signature = '';
    while (($headerLine = fgets($callbackConnection)) !== false && trim($headerLine) !== '') {
        if (stripos($headerLine, 'content-length:') === 0) {
            $contentLength = (int) trim(substr($headerLine, strlen('content-length:')));
        }
        if (stripos($headerLine, 'x-twilio-signature:') === 0) {
            $signature = trim(substr($headerLine, strlen('x-twilio-signature:')));
        }
    }
    $requestBody = $contentLength > 0 ? stream_get_contents($callbackConnection, $contentLength) : '';
    parse_str((string) $requestBody, $callbackFields);

    return ['signature' => $signature, 'fields' => $callbackFields];
}

/**
 * PHP has no background threads, so the script answers the callbacks itself once the send has
 * returned; until then they wait in the listening socket's queue.
 */
function waitForCallbacks($callbackServer): array
{
    $receivedCallbacks = [];
    $deadline = microtime(true) + CALLBACK_TIMEOUT_SECONDS;
    while (count($receivedCallbacks) < EXPECTED_CALLBACK_COUNT) {
        $remainingSeconds = $deadline - microtime(true);
        if ($remainingSeconds <= 0) {
            throw new RuntimeException('Callbacks so far: ' . count($receivedCallbacks));
        }
        $callbackConnection = @stream_socket_accept($callbackServer, $remainingSeconds);
        if ($callbackConnection === false) {
            continue;
        }
        $receivedCallbacks[] = readCallback($callbackConnection);
        fwrite($callbackConnection, "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n");
        fclose($callbackConnection);
    }

    return $receivedCallbacks;
}

$providerUrl = getenv('SENDMOCK_PROVIDER_URL') ?: 'http://127.0.0.1:8026';
$httpClient = new SendMockCurlClient($providerUrl);
$mainClient = new Client(MAIN_ACCOUNT_SID, MAIN_AUTH_TOKEN, null, null, $httpClient);

$createdSubaccount = $mainClient->api->v2010->accounts->create(['friendlyName' => 'Acme Clinic']);
$fetchedSubaccount = $mainClient->api->v2010->accounts($createdSubaccount->sid)->fetch();
if ($fetchedSubaccount->authToken !== $createdSubaccount->authToken) {
    throw new RuntimeException('The account fetch answered another token');
}
echo "Subaccount {$fetchedSubaccount->sid} ({$fetchedSubaccount->status})\n";

$subaccountClient = new Client(
    $fetchedSubaccount->sid,
    $fetchedSubaccount->authToken,
    null,
    null,
    $httpClient,
);
$callbackServer = stream_socket_server('tcp://127.0.0.1:0');
$callbackAddress = stream_socket_get_name($callbackServer, false);
$callbackUrl = "http://{$callbackAddress}/status";
$message = $subaccountClient->messages->create('+14155550111', [
    'from' => '+15005550006',
    'body' => 'Your appointment is confirmed',
    'statusCallback' => $callbackUrl,
]);
if ($message->accountSid !== $fetchedSubaccount->sid) {
    throw new RuntimeException("Sent under {$message->accountSid}");
}
$receivedCallbacks = waitForCallbacks($callbackServer);
fclose($callbackServer);

$subaccountValidator = new RequestValidator($fetchedSubaccount->authToken);
$mainAccountValidator = new RequestValidator(MAIN_AUTH_TOKEN);
foreach ($receivedCallbacks as $receivedCallback) {
    $isSignedBySubaccount = $subaccountValidator->validate(
        $receivedCallback['signature'],
        $callbackUrl,
        $receivedCallback['fields'],
    );
    $isSignedByMainAccount = $mainAccountValidator->validate(
        $receivedCallback['signature'],
        $callbackUrl,
        $receivedCallback['fields'],
    );
    if (!$isSignedBySubaccount || $isSignedByMainAccount) {
        $status = $receivedCallback['fields']['MessageStatus'] ?? '';
        throw new RuntimeException("The {$status} callback is not signed with the subaccount's token");
    }
}
echo 'Status callbacks signed with the subaccount\'s token: ' . count($receivedCallbacks) . "\n";
