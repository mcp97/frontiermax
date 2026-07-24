CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`salt` text NOT NULL,
	`secret_hash` text NOT NULL,
	`scopes_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_prefix_idx` ON `api_keys` (`prefix`);--> statement-breakpoint
CREATE INDEX `api_keys_org_created_idx` ON `api_keys` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `certifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`policy_version_id` text NOT NULL,
	`workload_key` text NOT NULL,
	`candidate_type` text NOT NULL,
	`candidate_id` text NOT NULL,
	`eval_set_id` text NOT NULL,
	`posterior_mean` real NOT NULL,
	`quality_lower_bound` real NOT NULL,
	`case_count` integer NOT NULL,
	`average_cost` real,
	`p95_latency_ms` real,
	`status` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`limitations` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`revocation_reason` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`policy_version_id`) REFERENCES `policy_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`eval_set_id`) REFERENCES `eval_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `certifications_org_created_idx` ON `certifications` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `eval_results` (
	`id` text PRIMARY KEY NOT NULL,
	`eval_set_id` text NOT NULL,
	`candidate_type` text NOT NULL,
	`candidate_id` text NOT NULL,
	`case_count` integer NOT NULL,
	`successes` integer NOT NULL,
	`failures` integer NOT NULL,
	`mean_rubric_score` real,
	`average_cost` real,
	`p50_latency_ms` real,
	`p95_latency_ms` real,
	`input_token_average` real,
	`output_token_average` real,
	`evaluator_version` text NOT NULL,
	`scaffold_version` text NOT NULL,
	`evaluated_at` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`eval_set_id`) REFERENCES `eval_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eval_results_set_candidate_idx` ON `eval_results` (`eval_set_id`,`candidate_type`,`candidate_id`);--> statement-breakpoint
CREATE INDEX `eval_results_set_idx` ON `eval_results` (`eval_set_id`);--> statement-breakpoint
CREATE TABLE `eval_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`workload_key` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`designation` text NOT NULL,
	`outcome_definition` text NOT NULL,
	`grader_version` text NOT NULL,
	`scaffold_version` text NOT NULL,
	`evaluated_at` text NOT NULL,
	`notes` text,
	`status` text NOT NULL,
	`source_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eval_sets_org_name_version_idx` ON `eval_sets` (`organization_id`,`name`,`version`);--> statement-breakpoint
CREATE INDEX `eval_sets_org_created_idx` ON `eval_sets` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `execution_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`actual_model` text,
	`actual_provider` text,
	`generation_id` text,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`cached_tokens` integer,
	`reasoning_tokens` integer,
	`actual_cost` real,
	`time_to_first_token_ms` real,
	`total_latency_ms` real,
	`operational_error_type` text,
	`application_outcome` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `route_decisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `execution_outcomes_route_idx` ON `execution_outcomes` (`route_id`);--> statement-breakpoint
CREATE INDEX `execution_outcomes_org_created_idx` ON `execution_outcomes` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stable_slug` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policies_org_slug_idx` ON `policies` (`organization_id`,`stable_slug`);--> statement-breakpoint
CREATE TABLE `policy_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`version` integer NOT NULL,
	`workload_key` text NOT NULL,
	`eval_set_id` text NOT NULL,
	`objective` text NOT NULL,
	`quality_floor` real NOT NULL,
	`confidence` real NOT NULL,
	`minimum_cases` integer NOT NULL,
	`maximum_cost` real,
	`maximum_p95_latency_ms` real,
	`allow_public_only` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`artifact_json` text NOT NULL,
	`evidence_version` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`eval_set_id`) REFERENCES `eval_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policy_versions_policy_version_idx` ON `policy_versions` (`policy_id`,`version`);--> statement-breakpoint
CREATE INDEX `policy_versions_org_published_idx` ON `policy_versions` (`organization_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `session_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`policy_version_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`candidate_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`policy_version_id`) REFERENCES `policy_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_assignments_policy_session_idx` ON `session_assignments` (`policy_version_id`,`session_hash`);