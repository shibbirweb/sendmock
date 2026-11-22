<?php

// The official Mailgun PHP SDK against SendMock's provider port: send an email, read its
// events, then add, read and delete a complaint, as a Laravel app with Mailgun does.
// AC: EM-23.6

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Mailgun\Mailgun;

const SENDING_DOMAIN = 'mg.shop.test';
const RECIPIENT = 'ana@example.test';
const EVENT_TIMEOUT_SECONDS = 30;

$providerUrl = getenv('SENDMOCK_PROVIDER_URL') ?: 'http://127.0.0.1:8026';
$mailgun = Mailgun::create('key-sendmock-example', $providerUrl);

$sent = $mailgun->messages()->send(SENDING_DOMAIN, [
    'from' => 'Shop <orders@' . SENDING_DOMAIN . '>',
    'to' => RECIPIENT,
    'subject' => 'Your order has shipped',
    'text' => 'It is on its way.',
]);
echo "Sent {$sent->getId()}\n";

$deadline = microtime(true) + EVENT_TIMEOUT_SECONDS;
do {
    $events = $mailgun->events()->get(SENDING_DOMAIN, ['recipient' => RECIPIENT]);
    $acceptedEvents = array_filter(
        $events->getItems(),
        static fn ($event) => $event->getEvent() === 'accepted',
    );
    if ($acceptedEvents !== []) {
        break;
    }
    usleep(250_000);
} while (microtime(true) < $deadline);
if ($acceptedEvents === []) {
    throw new RuntimeException('No accepted event for ' . RECIPIENT);
}
echo 'Events: ' . count($events->getItems()) . "\n";

$complaints = $mailgun->suppressions()->complaints();
$complaints->create(SENDING_DOMAIN, RECIPIENT);
$complaint = $complaints->show(SENDING_DOMAIN, RECIPIENT);
if ($complaint->getAddress() !== RECIPIENT) {
    throw new RuntimeException("Read the complaint of {$complaint->getAddress()}");
}
$complaints->delete(SENDING_DOMAIN, RECIPIENT);
try {
    $complaints->show(SENDING_DOMAIN, RECIPIENT);
    throw new RuntimeException('The complaint is still listed after its delete');
} catch (\Mailgun\Exception\HttpClientException $notFound) {
    if ($notFound->getResponseCode() !== 404) {
        throw $notFound;
    }
}
echo 'Complaint added, read and deleted for ' . RECIPIENT . "\n";
