//! The Mailgun and Twilio settings for a stack: the provider port, the trust step for HTTPS-only
//! SDKs and where the signing keys come from, word for word as Settings > Connection shows
//! them (`web/src/lib/settings/build-provider-snippets.ts`).

/// Where the provider APIs are reached from the app.
pub struct ProviderSnippetTarget<'target> {
    pub host: &'target str,
    pub provider_port: u16,
    pub provider_tls_port: u16,
}

const MAILGUN_SIGNING_LINE: &str =
    "# Webhook signing key: the mailgun_signing_key webhook variable (sendmock webhook var list).";
const TWILIO_SIGNING_LINE: &str = "# Webhooks are signed with the auth token; a subaccount's number signs with the subaccount's token.";
const TWILIO_RECIPE_LINE: &str = "(see Connect your app, SDKs without a base URL setting)";

pub fn build_mailgun_snippet(language: &str, target: &ProviderSnippetTarget<'_>) -> String {
    let ProviderSnippetTarget {
        host,
        provider_port,
        provider_tls_port,
    } = target;
    let api_base = format!("http://{host}:{provider_port}");
    match language {
        "laravel" => format!(
            "MAIL_MAILER=mailgun\nMAILGUN_DOMAIN=mg.example.test\nMAILGUN_SECRET=key-sendmock\nMAILGUN_ENDPOINT={host}:{provider_tls_port}\nMAILGUN_SCHEME=https\n# Laravel's mailgun mailer only speaks HTTPS: start SendMock with --provider-tls-addr and run `sendmock trust` once.\n{MAILGUN_SIGNING_LINE}"
        ),
        "node" => format!(
            "new Mailgun(FormData).client({{ username: \"api\", key: \"key-sendmock\", url: \"{api_base}\" }});\n{MAILGUN_SIGNING_LINE}"
        ),
        "curl" => format!(
            "curl -s --user \"api:key-sendmock\" {api_base}/v3/mg.example.test/messages \\\n  -F from=app@mg.example.test -F to=user@example.com -F subject=Hello -F text=Hi"
        ),
        _ => format!(
            "# Send to Mailgun's API at {api_base} instead of https://api.mailgun.net (the SDK's base URL or endpoint setting).\n{MAILGUN_SIGNING_LINE}"
        ),
    }
}

pub fn build_twilio_snippet(language: &str, target: &ProviderSnippetTarget<'_>) -> String {
    let api_base = format!("http://{}:{}", target.host, target.provider_port);
    let credential_lines = "TWILIO_ACCOUNT_SID=<Account SID in SMS > Providers > Twilio>\nTWILIO_AUTH_TOKEN=<Auth Token in SMS > Providers > Twilio>";
    let client_line = match language {
        "laravel" => format!(
            "# The Twilio PHP SDK has no base URL setting: give the Client a CurlClient that sends to {api_base} {TWILIO_RECIPE_LINE}."
        ),
        "node" => format!(
            "# Give twilio() an httpClient, a RequestClient that sends to {api_base} {TWILIO_RECIPE_LINE}."
        ),
        "python" => format!(
            "# Give Client an http_client, a TwilioHttpClient that sends to {api_base} {TWILIO_RECIPE_LINE}."
        ),
        "curl" => {
            return format!(
                "curl -s -u \"$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN\" {api_base}/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json \\\n  -d To=+15550002222 -d From=+15005550006 -d Body=Hello"
            );
        }
        _ => format!(
            "# Send to Twilio's API at {api_base} instead of https://api.twilio.com (the SDK's HTTP client setting)."
        ),
    };
    format!("{credential_lines}\n{client_line}\n{TWILIO_SIGNING_LINE}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOCAL_TARGET: ProviderSnippetTarget<'static> = ProviderSnippetTarget {
        host: "127.0.0.1",
        provider_port: 8026,
        provider_tls_port: 8027,
    };

    // AC: AI-08.2
    #[test]
    fn laravel_gets_mailgun_over_https_with_the_trust_step_and_twilio_with_the_recipe() {
        let mailgun = build_mailgun_snippet("laravel", &LOCAL_TARGET);
        let twilio = build_twilio_snippet("laravel", &LOCAL_TARGET);

        assert!(
            mailgun.contains("MAILGUN_ENDPOINT=127.0.0.1:8027"),
            "{mailgun}"
        );
        assert!(mailgun.contains("sendmock trust"), "{mailgun}");
        assert!(mailgun.contains("mailgun_signing_key"), "{mailgun}");
        assert!(
            twilio.contains("CurlClient that sends to http://127.0.0.1:8026"),
            "{twilio}"
        );
        assert!(twilio.contains("signed with the auth token"), "{twilio}");
    }

    #[test]
    fn curl_gets_a_request_to_the_provider_port() {
        assert!(
            build_mailgun_snippet("curl", &LOCAL_TARGET)
                .contains("http://127.0.0.1:8026/v3/mg.example.test/messages")
        );
        assert!(
            build_twilio_snippet("curl", &LOCAL_TARGET)
                .contains("http://127.0.0.1:8026/2010-04-01/Accounts/")
        );
    }
}
