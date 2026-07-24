use reqwest::StatusCode;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fmt;
use std::time::Duration;

pub const DEFAULT_BASE_URL: &str = "https://agent-frontier.alignedai.chatgpt.site";

#[derive(Debug)]
pub enum FrontierError {
    Configuration(String),
    Transport(reqwest::Error),
    Api {
        status: StatusCode,
        code: Option<String>,
        message: String,
        request_id: Option<String>,
    },
    Json(serde_json::Error),
}

impl fmt::Display for FrontierError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Configuration(message) => write!(f, "{message}"),
            Self::Transport(error) => write!(f, "Frontier request failed: {error}"),
            Self::Api {
                status,
                code,
                message,
                request_id,
            } => {
                write!(f, "Frontier returned {status}")?;
                if let Some(code) = code {
                    write!(f, " ({code})")?;
                }
                write!(f, ": {message}")?;
                if let Some(request_id) = request_id {
                    write!(f, " [{request_id}]")?;
                }
                Ok(())
            }
            Self::Json(error) => write!(f, "Frontier returned invalid JSON: {error}"),
        }
    }
}

impl std::error::Error for FrontierError {}

impl From<reqwest::Error> for FrontierError {
    fn from(value: reqwest::Error) -> Self {
        Self::Transport(value)
    }
}

impl From<serde_json::Error> for FrontierError {
    fn from(value: serde_json::Error) -> Self {
        Self::Json(value)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RouteRequest {
    pub policy: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub features: RouteFeatures,
}

#[derive(Debug, Clone, Serialize)]
pub struct RouteFeatures {
    pub input_tokens_estimate: u64,
    pub output_tokens_estimate: u64,
    pub input_modalities: Vec<String>,
    pub output_modalities: Vec<String>,
    pub requires_tools: bool,
    pub requires_structured_output: bool,
    pub required_context_tokens: u64,
    pub complexity_hint: Complexity,
    pub risk_class: RiskClass,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Complexity {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskClass {
    Standard,
    Sensitive,
    High,
}

#[derive(Debug, Clone, Serialize)]
pub struct OutcomeRequest {
    pub route_id: String,
    pub application_outcome: ApplicationOutcome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_cost: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_to_first_token_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operational_error_type: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ApplicationOutcome {
    Accepted,
    Rejected,
    Retried,
    Escalated,
    Abandoned,
    Unknown,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RouteDecision {
    pub route_id: String,
    pub route_type: String,
    pub model: Option<String>,
    pub external_router: Option<String>,
    #[serde(default)]
    pub fallbacks: Vec<String>,
    pub provider: Value,
    pub selection_scope: String,
    pub session_assignment_expires_at: Option<String>,
    #[serde(default)]
    pub reasons: Vec<String>,
    #[serde(default)]
    pub binding_constraints: Vec<String>,
    pub policy_version: String,
    pub evidence_version: String,
    pub certification_id: String,
    pub manifest_hash: String,
    pub expires_at: String,
    #[serde(default)]
    pub receipt_persisted: bool,
    pub privacy: Privacy,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Privacy {
    pub prompt_captured: bool,
    pub output_captured: bool,
    pub code_captured: bool,
    pub diff_captured: bool,
    pub credentials_captured: bool,
}

impl RouteDecision {
    pub fn selected_target(&self) -> Option<&str> {
        self.model.as_deref().or(self.external_router.as_deref())
    }

    pub fn openrouter_handoff(&self) -> Value {
        if self.route_type == "certified_external_router" {
            serde_json::json!({
                "model": self.external_router,
                "provider": self.provider,
            })
        } else {
            let mut models = Vec::new();
            if let Some(model) = &self.model {
                models.push(model.clone());
            }
            models.extend(self.fallbacks.clone());
            serde_json::json!({
                "model": models,
                "provider": self.provider,
            })
        }
    }
}

pub struct FrontierClient {
    base_url: String,
    api_key: String,
    http: Client,
}

impl FrontierClient {
    pub fn from_environment(
        base_url: Option<String>,
        timeout: Duration,
    ) -> Result<Self, FrontierError> {
        let api_key = env::var("FRONTIER_MAX_API_KEY")
            .or_else(|_| env::var("FRONTIER_API_KEY"))
            .map_err(|_| {
                FrontierError::Configuration(
                    "Set FRONTIER_MAX_API_KEY to a scoped organization API key.".into(),
                )
            })?;
        Self::new(
            base_url
                .or_else(|| env::var("FRONTIER_MAX_URL").ok())
                .unwrap_or_else(|| DEFAULT_BASE_URL.into()),
            api_key,
            timeout,
        )
    }

    pub fn new(
        base_url: String,
        api_key: String,
        timeout: Duration,
    ) -> Result<Self, FrontierError> {
        let base_url = base_url.trim_end_matches('/').to_owned();
        if !base_url.starts_with("https://") && !base_url.starts_with("http://localhost") {
            return Err(FrontierError::Configuration(
                "Frontier URL must use HTTPS (localhost is allowed for development).".into(),
            ));
        }
        if api_key.trim().is_empty() {
            return Err(FrontierError::Configuration(
                "Frontier API key cannot be empty.".into(),
            ));
        }
        Ok(Self {
            base_url,
            api_key,
            http: Client::builder()
                .timeout(timeout)
                .user_agent(concat!("frontier-max-cli/", env!("CARGO_PKG_VERSION")))
                .build()?,
        })
    }

    pub fn route(&self, request: &RouteRequest) -> Result<RouteDecision, FrontierError> {
        self.send_json(
            self.http
                .post(format!("{}/api/v1/route", self.base_url))
                .bearer_auth(&self.api_key)
                .json(request),
        )
    }

    pub fn manifest(&self, policy: &str) -> Result<Value, FrontierError> {
        validate_policy_slug(policy)?;
        self.send_value(
            self.http
                .get(format!(
                    "{}/api/v1/manifests/{policy}/current",
                    self.base_url
                ))
                .bearer_auth(&self.api_key),
        )
    }

    pub fn report_outcome(&self, outcome: &OutcomeRequest) -> Result<Value, FrontierError> {
        self.send_value(
            self.http
                .post(format!("{}/api/v1/outcomes", self.base_url))
                .bearer_auth(&self.api_key)
                .json(outcome),
        )
    }

    fn send_json<T: for<'de> Deserialize<'de>>(
        &self,
        request: reqwest::blocking::RequestBuilder,
    ) -> Result<T, FrontierError> {
        let value = self.send_value(request)?;
        Ok(serde_json::from_value(value)?)
    }

    fn send_value(
        &self,
        request: reqwest::blocking::RequestBuilder,
    ) -> Result<Value, FrontierError> {
        let response = request.send()?;
        let status = response.status();
        let value = response.json::<Value>()?;
        if status.is_success() {
            return Ok(value);
        }
        Err(api_error(status, &value))
    }
}

fn api_error(status: StatusCode, value: &Value) -> FrontierError {
    FrontierError::Api {
        status,
        code: value
            .get("error_code")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        message: value
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Unknown API error")
            .to_owned(),
        request_id: value
            .get("request_id")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
    }
}

pub fn validate_policy_slug(policy: &str) -> Result<(), FrontierError> {
    if policy.is_empty()
        || !policy
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(FrontierError::Configuration(
            "Policy must contain only letters, numbers, dashes, or underscores.".into(),
        ));
    }
    Ok(())
}

pub fn route_json(request: &RouteRequest) -> Result<String, FrontierError> {
    validate_policy_slug(&request.policy)?;
    Ok(serde_json::to_string_pretty(request)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example_route() -> RouteRequest {
        RouteRequest {
            policy: "coding-prod".into(),
            session_id: Some("session-42".into()),
            features: RouteFeatures {
                input_tokens_estimate: 8_000,
                output_tokens_estimate: 2_000,
                input_modalities: vec!["text".into()],
                output_modalities: vec!["text".into()],
                requires_tools: true,
                requires_structured_output: false,
                required_context_tokens: 16_000,
                complexity_hint: Complexity::Medium,
                risk_class: RiskClass::Standard,
            },
        }
    }

    #[test]
    fn route_payload_is_metadata_only() {
        let body = route_json(&example_route()).unwrap();
        for forbidden in [
            "\"prompt\"",
            "\"messages\"",
            "\"code\"",
            "\"content\"",
            "\"output\"",
            "\"response\"",
            "\"credentials\"",
        ] {
            assert!(
                !body.contains(forbidden),
                "found forbidden field {forbidden}"
            );
        }
        assert!(body.contains("\"policy\": \"coding-prod\""));
        assert!(body.contains("\"session_id\": \"session-42\""));
    }

    #[test]
    fn policy_slug_cannot_escape_the_manifest_path() {
        assert!(validate_policy_slug("coding-prod").is_ok());
        assert!(validate_policy_slug("../settings").is_err());
        assert!(validate_policy_slug("coding/prod").is_err());
    }

    #[test]
    fn openrouter_handoff_preserves_concrete_fallbacks() {
        let decision = RouteDecision {
            route_id: "rt_1".into(),
            route_type: "concrete_model".into(),
            model: Some("openai/gpt".into()),
            external_router: None,
            fallbacks: vec!["anthropic/claude".into()],
            provider: serde_json::json!({"zdr": true}),
            selection_scope: "request".into(),
            session_assignment_expires_at: None,
            reasons: vec![],
            binding_constraints: vec![],
            policy_version: "coding-prod.1".into(),
            evidence_version: "ev_1".into(),
            certification_id: "cert_1".into(),
            manifest_hash: "hash".into(),
            expires_at: "2026-07-24T00:00:00Z".into(),
            receipt_persisted: true,
            privacy: Privacy {
                prompt_captured: false,
                output_captured: false,
                code_captured: false,
                diff_captured: false,
                credentials_captured: false,
            },
        };
        assert_eq!(
            decision.openrouter_handoff()["model"],
            serde_json::json!(["openai/gpt", "anthropic/claude"])
        );
    }
}
