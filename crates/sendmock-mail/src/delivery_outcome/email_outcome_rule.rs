use sendmock_core::matches_wildcard_pattern;

use super::{EmailDeliveryEvent, EmailOutcome, OutcomeAction, OutcomeStep};

/// What a custom outcome address does to a matching email.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailRuleOutcome {
    Delivered,
    HardBounce,
    SoftBounce,
    Complaint,
    Unsubscribe,
    /// The recipient is refused at SMTP `RCPT` and on the HTTP send, so nothing is stored.
    Reject,
}

impl EmailRuleOutcome {
    pub fn parse(outcome_name: &str) -> Option<Self> {
        match outcome_name {
            "delivered" => Some(Self::Delivered),
            "hard_bounce" => Some(Self::HardBounce),
            "soft_bounce" => Some(Self::SoftBounce),
            "complaint" => Some(Self::Complaint),
            "unsubscribe" => Some(Self::Unsubscribe),
            "reject" => Some(Self::Reject),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Delivered => "delivered",
            Self::HardBounce => "hard_bounce",
            Self::SoftBounce => "soft_bounce",
            Self::Complaint => "complaint",
            Self::Unsubscribe => "unsubscribe",
            Self::Reject => "reject",
        }
    }

    /// Bounces and rejects answer with an SMTP code and diagnostic; the others have none.
    pub fn uses_smtp_reply(self) -> bool {
        matches!(self, Self::HardBounce | Self::SoftBounce | Self::Reject)
    }

    /// How the Settings list names it.
    pub fn label(self) -> &'static str {
        match self {
            Self::Delivered => "Delivered",
            Self::HardBounce => "Hard bounce",
            Self::SoftBounce => "Soft bounce (deferred)",
            Self::Complaint => "Spam complaint",
            Self::Unsubscribe => "Unsubscribe",
            Self::Reject => "Reject the recipient",
        }
    }
}

/// A custom outcome address as the planner needs it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailOutcomeRule {
    pub rule_id: String,
    /// One-based; lower positions are checked first.
    pub position: u32,
    pub pattern: String,
    pub outcome: EmailRuleOutcome,
    pub smtp_code: Option<String>,
    pub diagnostic: Option<String>,
    pub is_enabled: bool,
}

/// An SMTP refusal of one recipient, e.g. `550` with `5.7.1 recipient rejected`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecipientRefusal {
    pub reply_code: u16,
    pub reply_text: String,
    /// The position of the `reject` rule that refused the recipient.
    pub rule_position: u32,
}

const DEFAULT_REJECT_CODE: &str = "550 5.7.1";
const DEFAULT_REJECT_DIAGNOSTIC: &str = "recipient rejected";

impl EmailOutcomeRule {
    /// Addresses compare without case.
    pub fn matches_address(&self, recipient_address: &str) -> bool {
        matches_wildcard_pattern(
            &self.pattern.trim().to_lowercase(),
            &recipient_address.trim().to_lowercase(),
        )
    }

    /// "Hard bounce, 550 5.1.1", as the Settings list and "Test an address" show it.
    pub fn describe(&self) -> String {
        match &self.smtp_code {
            Some(smtp_code) => format!("{}, {smtp_code}", self.outcome.label()),
            None => self.outcome.label().to_owned(),
        }
    }

    /// The SMTP refusal for a `reject` rule; `None` for every other outcome.
    pub fn refusal(&self) -> Option<RecipientRefusal> {
        if self.outcome != EmailRuleOutcome::Reject {
            return None;
        }
        let smtp_code = self.smtp_code.as_deref().unwrap_or(DEFAULT_REJECT_CODE);
        let (reply_code_text, enhanced_code) = smtp_code
            .split_once(' ')
            .map_or((smtp_code, None), |(reply_code_text, enhanced_code)| {
                (reply_code_text, Some(enhanced_code))
            });
        let diagnostic = self
            .diagnostic
            .as_deref()
            .unwrap_or(DEFAULT_REJECT_DIAGNOSTIC);
        Some(RecipientRefusal {
            reply_code: reply_code_text.parse().unwrap_or(550),
            reply_text: match enhanced_code {
                Some(enhanced_code) => format!("{enhanced_code} {diagnostic}"),
                None => diagnostic.to_owned(),
            },
            rule_position: self.position,
        })
    }

    /// The outcome this rule plays; `None` for `reject`, whose recipient was refused before
    /// anything was stored.
    pub fn email_outcome(&self) -> Option<EmailOutcome> {
        match self.outcome {
            EmailRuleOutcome::Delivered => Some(EmailOutcome::Delivered),
            EmailRuleOutcome::HardBounce => Some(EmailOutcome::HardBounce),
            EmailRuleOutcome::SoftBounce => Some(EmailOutcome::SoftBounce),
            EmailRuleOutcome::Complaint => Some(EmailOutcome::Complaint),
            EmailRuleOutcome::Unsubscribe => Some(EmailOutcome::Unsubscribe),
            EmailRuleOutcome::Reject => None,
        }
    }

    /// The reports this rule plays from the moment the email is stored; `None` for `reject`.
    pub fn plan_steps(&self) -> Option<Vec<OutcomeStep>> {
        let outcome_steps = self.email_outcome()?.plan_steps(0);
        Some(
            outcome_steps
                .into_iter()
                .map(|outcome_step| self.with_rule_bounce_reply(outcome_step))
                .collect(),
        )
    }

    /// A bounce keeps its type but carries the rule's SMTP code and diagnostic when it has them.
    fn with_rule_bounce_reply(&self, outcome_step: OutcomeStep) -> OutcomeStep {
        let OutcomeAction::Report(EmailDeliveryEvent::Bounced {
            bounce_type,
            smtp_code,
            diagnostic,
        }) = outcome_step.action
        else {
            return outcome_step;
        };
        OutcomeStep {
            after_ms: outcome_step.after_ms,
            action: OutcomeAction::Report(EmailDeliveryEvent::Bounced {
                bounce_type,
                smtp_code: self.smtp_code.clone().unwrap_or(smtp_code),
                diagnostic: self.diagnostic.clone().unwrap_or(diagnostic),
            }),
        }
    }
}

/// An address like `qa@app.test`, or one with `*` wildcards such as `*@bounce.qa.test`.
pub fn is_valid_address_pattern(pattern: &str) -> bool {
    let Some((local_part, domain)) = pattern.trim().split_once('@') else {
        return false;
    };
    let is_valid_part = |address_part: &str| {
        !address_part.is_empty()
            && !address_part
                .chars()
                .any(|character| character.is_whitespace() || character == '@')
    };
    is_valid_part(local_part) && is_valid_part(domain)
}

/// A refusing SMTP reply, `550` or `550 5.1.1`: a 4 or 5 class, the same in both parts.
pub fn is_valid_refusal_code(smtp_code: &str) -> bool {
    let (reply_code, enhanced_code) = smtp_code
        .split_once(' ')
        .map_or((smtp_code, None), |(reply_code, enhanced_code)| {
            (reply_code, Some(enhanced_code))
        });
    let is_refusal_class =
        |code_text: &str| code_text.starts_with('4') || code_text.starts_with('5');
    let is_valid_reply_code = reply_code.len() == 3
        && reply_code
            .chars()
            .all(|character| character.is_ascii_digit())
        && is_refusal_class(reply_code);
    let is_valid_enhanced_code = enhanced_code.is_none_or(|enhanced_code| {
        let code_parts: Vec<&str> = enhanced_code.split('.').collect();
        code_parts.len() == 3
            && code_parts.first().copied() == reply_code.get(..1)
            && code_parts.iter().skip(1).all(|code_part| {
                (1..=3).contains(&code_part.len())
                    && code_part
                        .chars()
                        .all(|character| character.is_ascii_digit())
            })
    });
    is_valid_reply_code && is_valid_enhanced_code
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(
        outcome: EmailRuleOutcome,
        smtp_code: Option<&str>,
        diagnostic: Option<&str>,
    ) -> EmailOutcomeRule {
        EmailOutcomeRule {
            rule_id: "rule-1".to_owned(),
            position: 1,
            pattern: "*@Bounce.QA.test".to_owned(),
            outcome,
            smtp_code: smtp_code.map(str::to_owned),
            diagnostic: diagnostic.map(str::to_owned),
            is_enabled: true,
        }
    }

    // AC: EM-10.5
    #[test]
    fn patterns_match_exact_addresses_or_wildcards_without_case() {
        let wildcard_rule = rule(EmailRuleOutcome::HardBounce, None, None);

        assert!(wildcard_rule.matches_address("sam@bounce.qa.test"));
        assert!(wildcard_rule.matches_address(" SAM@BOUNCE.QA.TEST "));
        assert!(!wildcard_rule.matches_address("sam@bounce.qa.test.org"));
    }

    // AC: EM-10.5
    #[test]
    fn a_bounce_rule_reports_its_own_code_and_diagnostic() {
        let soft_bounce_rule = rule(
            EmailRuleOutcome::SoftBounce,
            Some("421 4.4.2"),
            Some("connection dropped"),
        );

        let outcome_steps = soft_bounce_rule.plan_steps();

        let reported_events: Vec<OutcomeAction> = outcome_steps
            .unwrap_or_default()
            .into_iter()
            .map(|outcome_step| outcome_step.action)
            .collect();
        assert_eq!(
            reported_events,
            vec![
                OutcomeAction::Report(EmailDeliveryEvent::Deferred),
                OutcomeAction::Report(EmailDeliveryEvent::Bounced {
                    bounce_type: crate::BounceType::Soft,
                    smtp_code: "421 4.4.2".to_owned(),
                    diagnostic: "connection dropped".to_owned(),
                }),
            ]
        );
    }

    #[test]
    fn a_bounce_rule_without_a_code_keeps_the_usual_reply() {
        let hard_bounce_rule = rule(EmailRuleOutcome::HardBounce, None, None);

        let outcome_steps = hard_bounce_rule.plan_steps().unwrap_or_default();

        assert_eq!(
            outcome_steps[0].action,
            OutcomeAction::Report(EmailDeliveryEvent::hard_bounce("user unknown"))
        );
        assert_eq!(hard_bounce_rule.describe(), "Hard bounce");
    }

    // AC: EM-10.5
    #[test]
    fn a_reject_rule_refuses_with_its_code_and_plays_nothing() {
        let reject_rule = rule(
            EmailRuleOutcome::Reject,
            Some("554 5.7.1"),
            Some("relay denied"),
        );
        let default_reject_rule = rule(EmailRuleOutcome::Reject, None, None);
        let plain_code_rule = rule(EmailRuleOutcome::Reject, Some("450"), Some("try later"));

        assert_eq!(reject_rule.plan_steps(), None);
        assert_eq!(
            reject_rule.refusal(),
            Some(RecipientRefusal {
                reply_code: 554,
                reply_text: "5.7.1 relay denied".to_owned(),
                rule_position: 1,
            })
        );
        assert_eq!(
            default_reject_rule.refusal(),
            Some(RecipientRefusal {
                reply_code: 550,
                reply_text: "5.7.1 recipient rejected".to_owned(),
                rule_position: 1,
            })
        );
        assert_eq!(
            plain_code_rule.refusal().map(|refusal| refusal.reply_text),
            Some("try later".to_owned())
        );
        assert_eq!(
            rule(EmailRuleOutcome::Delivered, None, None).refusal(),
            None
        );
    }

    #[test]
    fn address_patterns_need_a_local_part_and_a_domain() {
        assert!(is_valid_address_pattern("qa@app.test"));
        assert!(is_valid_address_pattern("*@bounce.qa.test"));
        assert!(!is_valid_address_pattern("qa.app.test"));
        assert!(!is_valid_address_pattern("qa@"));
        assert!(!is_valid_address_pattern("q a@app.test"));
        assert!(!is_valid_address_pattern("a@b@c"));
    }

    #[test]
    fn refusal_codes_are_4xx_or_5xx_with_a_matching_enhanced_code() {
        assert!(is_valid_refusal_code("550"));
        assert!(is_valid_refusal_code("550 5.1.1"));
        assert!(is_valid_refusal_code("452 4.22.100"));
        assert!(!is_valid_refusal_code("250 2.0.0"));
        assert!(!is_valid_refusal_code("550 4.1.1"));
        assert!(!is_valid_refusal_code("55"));
        assert!(!is_valid_refusal_code("550 5.1"));
        assert!(!is_valid_refusal_code(" 5.1.1"));
        assert!(!is_valid_refusal_code(""));
    }
}
