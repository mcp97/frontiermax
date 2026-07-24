use clap::{Args, Parser, Subcommand, ValueEnum};
use frontier_max_cli::{
    ApplicationOutcome, Complexity, FrontierClient, OutcomeRequest, RiskClass, RouteFeatures,
    RouteRequest, route_json, validate_policy_slug,
};
use serde_json::Value;
use std::process::ExitCode;
use std::time::Duration;

#[derive(Parser)]
#[command(
    name = "frontier",
    version,
    about = "Fast, metadata-only model routing with Frontier Max",
    long_about = "Resolve certified Frontier Max policies without sending prompts, outputs, code, diffs, or provider credentials."
)]
struct Cli {
    /// Frontier Max origin. Defaults to FRONTIER_MAX_URL, then the production service.
    #[arg(long, global = true)]
    base_url: Option<String>,

    /// Request timeout in seconds.
    #[arg(long, global = true, default_value_t = 15)]
    timeout: u64,

    /// Print the full machine-readable response.
    #[arg(long, global = true)]
    json: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Resolve a certified model or external-router policy.
    Route(RouteArgs),
    /// Read the current immutable compiled policy artifact.
    Manifest {
        /// Stable policy slug.
        policy: String,
    },
    /// Report content-free operational outcome metadata.
    Outcome(OutcomeArgs),
    /// Verify local configuration without sending a request.
    Doctor,
}

#[derive(Args)]
struct RouteArgs {
    /// Stable policy slug.
    #[arg(long)]
    policy: String,

    /// Stable local session identifier for bounded route stickiness.
    #[arg(long)]
    session: Option<String>,

    #[arg(long, default_value_t = 8_000)]
    input_tokens: u64,

    #[arg(long, default_value_t = 2_000)]
    output_tokens: u64,

    #[arg(long, default_value_t = 16_000)]
    context_tokens: u64,

    #[arg(long)]
    tools: bool,

    #[arg(long)]
    structured_output: bool,

    #[arg(long, value_enum, default_value_t = CliComplexity::Medium)]
    complexity: CliComplexity,

    #[arg(long, value_enum, default_value_t = CliRisk::Standard)]
    risk: CliRisk,

    /// Print the exact metadata body without contacting Frontier Max.
    #[arg(long)]
    dry_run: bool,

    /// Print only the local OpenRouter handoff fragment.
    #[arg(long)]
    openrouter: bool,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliComplexity {
    Low,
    Medium,
    High,
}

impl From<CliComplexity> for Complexity {
    fn from(value: CliComplexity) -> Self {
        match value {
            CliComplexity::Low => Self::Low,
            CliComplexity::Medium => Self::Medium,
            CliComplexity::High => Self::High,
        }
    }
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliRisk {
    Standard,
    Sensitive,
    High,
}

impl From<CliRisk> for RiskClass {
    fn from(value: CliRisk) -> Self {
        match value {
            CliRisk::Standard => Self::Standard,
            CliRisk::Sensitive => Self::Sensitive,
            CliRisk::High => Self::High,
        }
    }
}

#[derive(Args)]
struct OutcomeArgs {
    #[arg(long)]
    route_id: String,

    #[arg(long, value_enum)]
    result: CliOutcome,

    #[arg(long)]
    actual_model: Option<String>,

    #[arg(long)]
    actual_provider: Option<String>,

    #[arg(long)]
    generation_id: Option<String>,

    #[arg(long)]
    prompt_tokens: Option<u64>,

    #[arg(long)]
    completion_tokens: Option<u64>,

    #[arg(long)]
    cached_tokens: Option<u64>,

    #[arg(long)]
    reasoning_tokens: Option<u64>,

    #[arg(long)]
    actual_cost: Option<f64>,

    #[arg(long)]
    time_to_first_token_ms: Option<u64>,

    #[arg(long)]
    total_latency_ms: Option<u64>,

    #[arg(long)]
    operational_error_type: Option<String>,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliOutcome {
    Accepted,
    Rejected,
    Retried,
    Escalated,
    Abandoned,
    Unknown,
}

impl From<CliOutcome> for ApplicationOutcome {
    fn from(value: CliOutcome) -> Self {
        match value {
            CliOutcome::Accepted => Self::Accepted,
            CliOutcome::Rejected => Self::Rejected,
            CliOutcome::Retried => Self::Retried,
            CliOutcome::Escalated => Self::Escalated,
            CliOutcome::Abandoned => Self::Abandoned,
            CliOutcome::Unknown => Self::Unknown,
        }
    }
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
    if matches!(cli.command, Command::Doctor) {
        let url = cli
            .base_url
            .or_else(|| std::env::var("FRONTIER_MAX_URL").ok())
            .unwrap_or_else(|| frontier_max_cli::DEFAULT_BASE_URL.into());
        let key_status = if std::env::var("FRONTIER_MAX_API_KEY")
            .or_else(|_| std::env::var("FRONTIER_API_KEY"))
            .is_ok()
        {
            "configured"
        } else {
            "missing"
        };
        println!("Frontier URL  {url}");
        println!("API key       {key_status}");
        println!("Privacy       metadata only");
        println!("Execution     customer calls OpenRouter");
        return Ok(());
    }

    let base_url = cli.base_url.clone();
    let timeout = cli.timeout;
    let json = cli.json;
    match cli.command {
        Command::Route(args) => {
            validate_policy_slug(&args.policy)?;
            let request = RouteRequest {
                policy: args.policy,
                session_id: args.session,
                features: RouteFeatures {
                    input_tokens_estimate: args.input_tokens,
                    output_tokens_estimate: args.output_tokens,
                    input_modalities: vec!["text".into()],
                    output_modalities: vec!["text".into()],
                    requires_tools: args.tools,
                    requires_structured_output: args.structured_output,
                    required_context_tokens: args.context_tokens,
                    complexity_hint: args.complexity.into(),
                    risk_class: args.risk.into(),
                },
            };
            if args.dry_run {
                println!("{}", route_json(&request)?);
                return Ok(());
            }
            let client = client(base_url, timeout)?;
            let decision = client.route(&request)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&decision)?);
            } else if args.openrouter {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&decision.openrouter_handoff())?
                );
            } else {
                println!(
                    "ROUTE       {}",
                    decision.selected_target().unwrap_or("policy abstained")
                );
                println!("TYPE        {}", decision.route_type);
                if !decision.fallbacks.is_empty() {
                    println!("FALLBACKS   {}", decision.fallbacks.join(", "));
                }
                println!("POLICY      {}", decision.policy_version);
                println!("EVIDENCE    {}", decision.evidence_version);
                println!("CERTIFIED   {}", decision.certification_id);
                println!("RECEIPT     {}", decision.route_id);
                println!("STICKINESS  {}", decision.selection_scope);
                for reason in &decision.reasons {
                    println!("WHY         {reason}");
                }
                println!(
                    "PRIVACY     prompt={} output={} code={} diff={} credentials={}",
                    decision.privacy.prompt_captured,
                    decision.privacy.output_captured,
                    decision.privacy.code_captured,
                    decision.privacy.diff_captured,
                    decision.privacy.credentials_captured,
                );
                println!("EXPIRES     {}", decision.expires_at);
            }
        }
        Command::Manifest { policy } => {
            let client = client(base_url, timeout)?;
            let manifest = client.manifest(&policy)?;
            print_value(&manifest, json);
        }
        Command::Outcome(args) => {
            let client = client(base_url, timeout)?;
            let outcome = OutcomeRequest {
                route_id: args.route_id,
                application_outcome: args.result.into(),
                actual_model: args.actual_model,
                actual_provider: args.actual_provider,
                generation_id: args.generation_id,
                prompt_tokens: args.prompt_tokens,
                completion_tokens: args.completion_tokens,
                cached_tokens: args.cached_tokens,
                reasoning_tokens: args.reasoning_tokens,
                actual_cost: args.actual_cost,
                time_to_first_token_ms: args.time_to_first_token_ms,
                total_latency_ms: args.total_latency_ms,
                operational_error_type: args.operational_error_type,
            };
            let result = client.report_outcome(&outcome)?;
            print_value(&result, json);
        }
        Command::Doctor => unreachable!(),
    }
    Ok(())
}

fn client(
    base_url: Option<String>,
    timeout: u64,
) -> Result<FrontierClient, frontier_max_cli::FrontierError> {
    FrontierClient::from_environment(base_url, Duration::from_secs(timeout))
}

fn print_value(value: &Value, json: bool) {
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(value).expect("serializing JSON cannot fail")
        );
    } else if let Some(object) = value.as_object() {
        for (key, value) in object {
            if value.is_string() || value.is_number() || value.is_boolean() {
                println!("{:<14} {}", key.to_uppercase(), display_scalar(value));
            }
        }
    } else {
        println!("{value}");
    }
}

fn display_scalar(value: &Value) -> String {
    value
        .as_str()
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| value.to_string())
}
