use sendmock_mail::{BounceType, EmailDeliveryEvent};
use serde_json::{Value, json};

/// A bounce as templates read it, under `data.bounce`: its type, the basic SMTP code as a
/// number (452), the enhanced code (`4.2.2`), the receiving server's message and Mailgun's
/// severity (`temporary` for a soft bounce, `permanent` for a hard one).
pub fn build_bounce_data(delivery_event: &EmailDeliveryEvent) -> Option<Value> {
    let EmailDeliveryEvent::Bounced {
        bounce_type,
        smtp_code,
        diagnostic,
    } = delivery_event
    else {
        return None;
    };
    let (basic_code, enhanced_code) = smtp_code
        .split_once(' ')
        .map_or((smtp_code.as_str(), None), |(basic, enhanced)| {
            (basic, Some(enhanced))
        });
    let severity = match bounce_type {
        BounceType::Hard => "permanent",
        BounceType::Soft => "temporary",
    };
    Some(json!({
        "type": bounce_type.as_str(),
        "code": basic_code.parse::<u16>().ok(),
        "enhanced_code": enhanced_code,
        "message": diagnostic,
        "severity": severity,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-25.2
    #[test]
    fn a_soft_bounce_is_temporary_and_a_hard_one_permanent_with_their_codes() {
        assert_eq!(
            build_bounce_data(&EmailDeliveryEvent::soft_bounce()),
            Some(json!({
                "type": "soft",
                "code": 452,
                "enhanced_code": "4.2.2",
                "message": "mailbox full",
                "severity": "temporary",
            }))
        );
        let hard_bounce = build_bounce_data(&EmailDeliveryEvent::hard_bounce("user unknown"));
        assert_eq!(
            hard_bounce.as_ref().map(|bounce| &bounce["severity"]),
            Some(&json!("permanent"))
        );
        assert_eq!(
            hard_bounce.as_ref().map(|bounce| &bounce["code"]),
            Some(&json!(550))
        );
        assert_eq!(build_bounce_data(&EmailDeliveryEvent::Delivered), None);
    }
}
