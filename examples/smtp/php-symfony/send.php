<?php

// Symfony Mailer, which Symfony apps and Laravel both send with.
require __DIR__ . '/vendor/autoload.php';

use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mime\Email;

$smtpHost = getenv('SMTP_HOST') ?: '127.0.0.1';
$smtpPort = getenv('SMTP_PORT') ?: '1025';
$mailer = new Mailer(Transport::fromDsn("smtp://{$smtpHost}:{$smtpPort}"));
$mailer->send(
    (new Email())
        ->from('App <app@symfony.test>')
        ->to('user@example.test')
        ->subject(getenv('SUBJECT') ?: 'From Symfony Mailer')
        ->text('Your code is 482913')
        ->html('<p>Your code is <b>482913</b></p>')
);
