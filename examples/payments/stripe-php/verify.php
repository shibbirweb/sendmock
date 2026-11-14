<?php

// AC: PY-04.3
// Verifies every Stripe webhook the Node example received with the official PHP SDK's
// \Stripe\Webhook::constructEvent, over the exact bytes SendMock sent.

require __DIR__ . '/vendor/autoload.php';

$deliveriesPath = getenv('STRIPE_DELIVERIES_PATH') ?: __DIR__ . '/../stripe-deliveries.json';
$deliveryFile = json_decode(file_get_contents($deliveriesPath), true, 512, JSON_THROW_ON_ERROR);
$deliveries = $deliveryFile['deliveries'] ?? [];

if (count($deliveries) === 0) {
    fwrite(STDERR, "No deliveries to verify\n");
    exit(1);
}

$verifiedTypes = [];
foreach ($deliveries as $delivery) {
    $stripeEvent = \Stripe\Webhook::constructEvent(
        $delivery['payload'],
        $delivery['signature'],
        $deliveryFile['webhook_secret'],
    );
    $verifiedTypes[] = $stripeEvent->type;
}

echo 'Done: the PHP SDK verified ' . count($verifiedTypes) . ' events (' . implode(', ', $verifiedTypes) . ").\n";
