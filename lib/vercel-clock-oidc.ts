import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const DEFAULT_TEAM_SLUG = "monilpats-projects";
const DEFAULT_PROJECT_NAME = "agent-frontier-clock";
const CLOCK_AUDIENCE =
  "https://agent-frontier.monilpat.chatgpt.site/api/benchmarklist/clock";
const VERCEL_ISSUER = "https://oidc.vercel.com";
const DEPLOYMENT_NAME = /^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?$/;
const TEAM_ID = /^team_[A-Za-z0-9]+$/;
const PROJECT_ID = /^prj_[A-Za-z0-9]+$/;
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export interface VercelClockIdentityOptions {
  teamSlug?: string;
  teamId?: string;
  projectName?: string;
  projectId?: string;
}

export interface VercelClockIdentity {
  teamSlug: string;
  teamId: string | null;
  projectName: string;
  projectId: string | null;
  audience: string;
  subject: string;
  issuers: string[];
}

export function resolveVercelClockIdentity(
  options: VercelClockIdentityOptions = {},
): VercelClockIdentity | null {
  const teamSlug = (options.teamSlug ?? DEFAULT_TEAM_SLUG).trim();
  const projectName = (options.projectName ?? DEFAULT_PROJECT_NAME).trim();
  const teamId = options.teamId?.trim() || null;
  const projectId = options.projectId?.trim() || null;
  const hasOneImmutableId = Boolean(teamId) !== Boolean(projectId);

  if (
    !DEPLOYMENT_NAME.test(teamSlug)
    || !DEPLOYMENT_NAME.test(projectName)
    || hasOneImmutableId
    || (teamId !== null && !TEAM_ID.test(teamId))
    || (projectId !== null && !PROJECT_ID.test(projectId))
  ) {
    return null;
  }

  return {
    teamSlug,
    teamId,
    projectName,
    projectId,
    audience: CLOCK_AUDIENCE,
    subject:
      `owner:${teamSlug}:project:${projectName}:environment:production`,
    issuers: [`${VERCEL_ISSUER}/${teamSlug}`, VERCEL_ISSUER],
  };
}

function jwksForIssuer(issuer: string) {
  const existing = jwksByIssuer.get(issuer);
  if (existing) return existing;

  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
}

export function hasExpectedVercelClockDeployment(
  payload: JWTPayload,
  identity: VercelClockIdentity,
) {
  return payload.owner === identity.teamSlug
    && payload.project === identity.projectName
    && (identity.teamId === null || payload.owner_id === identity.teamId)
    && (identity.projectId === null || payload.project_id === identity.projectId)
    && payload.environment === "production";
}

export async function verifyVercelClockToken(
  token: string,
  options: VercelClockIdentityOptions = {},
) {
  if (!token) return false;
  const identity = resolveVercelClockIdentity(options);
  if (!identity) return false;

  for (const issuer of identity.issuers) {
    try {
      const { payload } = await jwtVerify(token, jwksForIssuer(issuer), {
        issuer,
        audience: identity.audience,
        subject: identity.subject,
        algorithms: ["RS256"],
        typ: "jwt",
      });
      if (hasExpectedVercelClockDeployment(payload, identity)) return true;
    } catch {
      // Try the other supported Vercel issuer mode, then fail closed.
    }
  }

  return false;
}
