<?php

// The official Twilio PHP SDK against SendMock's number APIs: buy a number, put it in a new
// Messaging Service and send through the service, so SendMock picks the number.
// AC: SM-20.5

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Twilio\AuthStrategy\AuthStrategy;
use Twilio\Http\CurlClient;
use Twilio\Http\Response;
use Twilio\Rest\Client;

const POOL_NUMBER = '+15557770124';

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

$providerUrl = getenv('SENDMOCK_PROVIDER_URL') ?: 'http://127.0.0.1:8026';
$client = new Client(
    'ACtest00000000000000000000000000',
    'twilio-test-token',
    null,
    null,
    new SendMockCurlClient($providerUrl),
);

$incomingNumber = $client->incomingPhoneNumbers->create([
    'phoneNumber' => POOL_NUMBER,
    'friendlyName' => 'Clinic line',
]);
$messagingService = $client->messaging->v1->services->create('Clinic reminders');
$serviceNumber = $client->messaging->v1->services($messagingService->sid)
    ->phoneNumbers->create($incomingNumber->sid);
if ($serviceNumber->sid !== $incomingNumber->sid) {
    throw new RuntimeException("The service holds {$serviceNumber->sid}");
}

$message = $client->messages->create('+14155550121', [
    'messagingServiceSid' => $messagingService->sid,
    'body' => 'Your appointment is tomorrow at 10:00',
]);
if ($message->from !== POOL_NUMBER) {
    throw new RuntimeException("Sent from {$message->from}, not the pool's " . POOL_NUMBER);
}
echo "Number {$incomingNumber->sid} in {$messagingService->sid} sent {$message->sid} from {$message->from}\n";
