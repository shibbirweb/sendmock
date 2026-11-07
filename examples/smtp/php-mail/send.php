<?php

// PHP's mail(), with sendmail_path pointing at `sendmock sendmail -t -i` (EM-06.2).
$subject = getenv('SUBJECT') ?: 'From PHP mail()';
$headers = "From: App <app@php.test>\r\nContent-Type: text/plain; charset=utf-8";
if (!mail('user@example.test', $subject, 'Your code is 482913', $headers)) {
    fwrite(STDERR, "mail() returned false\n");
    exit(1);
}
