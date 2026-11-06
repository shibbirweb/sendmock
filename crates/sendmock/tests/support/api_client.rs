use std::time::Duration;

use reqwest::Method;
use serde_json::Value;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// What the server answered: the status and the body as text, headers left out.
pub struct ApiAnswer {
    pub status: u16,
    pub body_text: String,
}

impl ApiAnswer {
    pub fn json(&self) -> Value {
        serde_json::from_str(&self.body_text).unwrap_or_default()
    }
}

/// Calls a running server over HTTP, with the API token on every `/api` request.
pub struct ApiClient {
    http_client: reqwest::Client,
    base_url: String,
    api_token: String,
}

impl ApiClient {
    pub fn new(http_addr: &str, api_token: &str) -> Self {
        let _ = rustls::crypto::ring::default_provider().install_default();
        Self {
            http_client: reqwest::Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .build()
                .unwrap_or_else(|build_error| panic!("an HTTP client: {build_error}")),
            base_url: format!("http://{http_addr}"),
            api_token: api_token.to_owned(),
        }
    }

    pub async fn send_json(
        &self,
        method: Method,
        path: &str,
        json_body: Option<&Value>,
    ) -> ApiAnswer {
        let mut request = self
            .http_client
            .request(method, format!("{}{path}", self.base_url))
            .bearer_auth(&self.api_token);
        if let Some(json_body) = json_body {
            request = request.json(json_body);
        }
        Self::read_answer(request).await
    }

    pub async fn get(&self, path: &str) -> ApiAnswer {
        self.send_json(Method::GET, path, None).await
    }

    /// A provider API call as an SDK makes it: its own authorization and a form body.
    pub async fn post_provider_form(
        &self,
        path: &str,
        authorization: &str,
        form_body: &str,
    ) -> ApiAnswer {
        let request = self
            .http_client
            .post(format!("{}{path}", self.base_url))
            .header("authorization", authorization)
            .header("content-type", "application/x-www-form-urlencoded")
            .body(form_body.to_owned());
        Self::read_answer(request).await
    }

    /// A provider API call with its own authorization and a JSON body.
    pub async fn post_provider_json(
        &self,
        path: &str,
        authorization: &str,
        json_body: &Value,
    ) -> ApiAnswer {
        let request = self
            .http_client
            .post(format!("{}{path}", self.base_url))
            .header("authorization", authorization)
            .json(json_body);
        Self::read_answer(request).await
    }

    async fn read_answer(request: reqwest::RequestBuilder) -> ApiAnswer {
        match request.send().await {
            Ok(response) => ApiAnswer {
                status: response.status().as_u16(),
                body_text: response.text().await.unwrap_or_default(),
            },
            Err(request_error) => ApiAnswer {
                status: 0,
                body_text: format!("the request failed: {request_error}"),
            },
        }
    }
}
