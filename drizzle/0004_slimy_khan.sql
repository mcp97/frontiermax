CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_events_org_created_idx` ON `audit_events` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`spend_range` text,
	`provider_summary` text,
	`workload_count` text,
	`private_evals` text,
	`primary_concern` text,
	`description` text,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lead_requests_created_idx` ON `lead_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `lead_requests_email_idx` ON `lead_requests` (`email`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`organization_id`, `email`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `organization_members_email_idx` ON `organization_members` (`email`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `public_api_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`source_url` text NOT NULL,
	`body` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `route_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`policy_version` text NOT NULL,
	`evidence_version` text NOT NULL,
	`engine_version` text NOT NULL,
	`request_features_json` text NOT NULL,
	`candidate_set_json` text NOT NULL,
	`selected_candidate` text,
	`manifest_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `route_decisions_org_created_idx` ON `route_decisions` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `workload_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`stable_key` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`objective` text NOT NULL,
	`config_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workload_profiles_org_key_idx` ON `workload_profiles` (`organization_id`,`stable_key`);