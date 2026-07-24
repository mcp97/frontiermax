import assert from "node:assert/strict";
import test from "node:test";

import {
  hasExpectedVercelClockDeployment,
  resolveVercelClockIdentity,
  verifyVercelClockToken,
} from "../lib/vercel-clock-oidc.ts";

test("resolves the public production workload identity without shipping opaque IDs", () => {
  assert.deepEqual(resolveVercelClockIdentity(), {
    teamSlug: "monilpats-projects",
    teamId: null,
    projectName: "agent-frontier-clock",
    projectId: null,
    audience:
      "https://agent-frontier.alignedai.chatgpt.site/api/benchmarklist/clock",
    subject:
      "owner:monilpats-projects:project:agent-frontier-clock:environment:production",
    issuers: [
      "https://oidc.vercel.com/monilpats-projects",
      "https://oidc.vercel.com",
    ],
  });
});

test("supports explicit deployment identity overrides", () => {
  assert.deepEqual(
    resolveVercelClockIdentity({
      teamSlug: "frontier-lab",
      teamId: "team_frontierlab123",
      projectName: "frontier-clock-canary",
      projectId: "prj_frontierclock123",
    }),
    {
      teamSlug: "frontier-lab",
      teamId: "team_frontierlab123",
      projectName: "frontier-clock-canary",
      projectId: "prj_frontierclock123",
      audience:
        "https://agent-frontier.alignedai.chatgpt.site/api/benchmarklist/clock",
      subject:
        "owner:frontier-lab:project:frontier-clock-canary:environment:production",
      issuers: [
        "https://oidc.vercel.com/frontier-lab",
        "https://oidc.vercel.com",
      ],
    },
  );
});

test("rejects invalid deployment names and empty bearer tokens without a network call", async () => {
  assert.equal(
    resolveVercelClockIdentity({ teamSlug: "https://example.com" }),
    null,
  );
  assert.equal(
    resolveVercelClockIdentity({ projectName: "" }),
    null,
  );
  assert.equal(
    resolveVercelClockIdentity({ projectId: "frontier-clock" }),
    null,
  );
  assert.equal(
    resolveVercelClockIdentity({ teamId: "team_frontierlab123" }),
    null,
  );
  assert.equal(await verifyVercelClockToken(""), false);
});

test("requires the public identity and production deployment claims", () => {
  const identity = resolveVercelClockIdentity();
  assert.ok(identity);
  const valid = {
    owner: identity.teamSlug,
    project: identity.projectName,
    environment: "production",
  };

  assert.equal(hasExpectedVercelClockDeployment(valid, identity), true);
  for (const [claim, value] of [
    ["owner", "another-team"],
    ["project", "another-project"],
    ["environment", "preview"],
  ]) {
    assert.equal(
      hasExpectedVercelClockDeployment({ ...valid, [claim]: value }, identity),
      false,
      `expected ${claim} mismatch to fail`,
    );
  }
});

test("checks immutable IDs when a deployment config supplies both", () => {
  const identity = resolveVercelClockIdentity({
    teamSlug: "frontier-lab",
    teamId: "team_frontierlab123",
    projectName: "frontier-clock-canary",
    projectId: "prj_frontierclock123",
  });
  assert.ok(identity);
  const valid = {
    owner: identity.teamSlug,
    owner_id: identity.teamId,
    project: identity.projectName,
    project_id: identity.projectId,
    environment: "production",
  };
  assert.equal(hasExpectedVercelClockDeployment(valid, identity), true);
  assert.equal(hasExpectedVercelClockDeployment({ ...valid, owner_id: "team_wrong" }, identity), false);
  assert.equal(hasExpectedVercelClockDeployment({ ...valid, project_id: "prj_wrong" }, identity), false);
});
