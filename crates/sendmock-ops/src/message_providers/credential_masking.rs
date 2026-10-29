use crate::providers::ProviderCredential;

const MASK_PREFIX: &str = "••••";
const VISIBLE_SECRET_CHARACTERS: usize = 4;

/// `••••` and the last four characters, as the UI shows a secret.
pub fn mask_secret_value(secret_value: &str) -> String {
    let character_count = secret_value.chars().count();
    let visible_part: String = secret_value
        .chars()
        .skip(character_count.saturating_sub(VISIBLE_SECRET_CHARACTERS))
        .collect();
    format!("{MASK_PREFIX}{visible_part}")
}

pub fn mask_secret_credentials(credentials: &[ProviderCredential]) -> Vec<ProviderCredential> {
    credentials
        .iter()
        .map(|credential| ProviderCredential {
            value: if credential.is_secret {
                mask_secret_value(&credential.value)
            } else {
                credential.value.clone()
            },
            ..credential.clone()
        })
        .collect()
}

/// The credentials as sent, except that a secret sent back masked or empty keeps the stored
/// value, so saving a form that never revealed a secret does not overwrite it.
pub fn merge_credentials(
    stored_credentials: &[ProviderCredential],
    input_credentials: Vec<ProviderCredential>,
) -> Vec<ProviderCredential> {
    input_credentials
        .into_iter()
        .map(|input_credential| {
            let unchanged_secret = stored_credentials.iter().find(|stored_credential| {
                input_credential.is_secret
                    && stored_credential.name == input_credential.name
                    && (input_credential.value.is_empty()
                        || input_credential.value == mask_secret_value(&stored_credential.value))
            });
            match unchanged_secret {
                Some(stored_credential) => ProviderCredential {
                    value: stored_credential.value.clone(),
                    ..input_credential
                },
                None => input_credential,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn auth_token(value: &str) -> ProviderCredential {
        ProviderCredential {
            name: "auth_token".to_owned(),
            value: value.to_owned(),
            is_secret: true,
        }
    }

    // AC: SM-16.6
    #[test]
    fn secrets_are_masked_to_their_last_four_characters() {
        let account_sid = ProviderCredential {
            name: "account_sid".to_owned(),
            value: "AC123".to_owned(),
            is_secret: false,
        };

        let masked =
            mask_secret_credentials(&[auth_token("test_auth_token_9f2c"), account_sid.clone()]);

        assert_eq!(masked, vec![auth_token("••••9f2c"), account_sid]);
        assert_eq!(mask_secret_value("ab"), "••••ab");
    }

    #[test]
    fn a_masked_or_empty_secret_keeps_the_stored_value_and_a_new_one_replaces_it() {
        let stored = vec![auth_token("test_auth_token_9f2c")];

        assert_eq!(
            merge_credentials(&stored, vec![auth_token("••••9f2c")]),
            stored
        );
        assert_eq!(merge_credentials(&stored, vec![auth_token("")]), stored);
        assert_eq!(
            merge_credentials(&stored, vec![auth_token("new_token")]),
            vec![auth_token("new_token")]
        );
    }
}
