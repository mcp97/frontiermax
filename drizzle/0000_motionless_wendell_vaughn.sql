CREATE TABLE `benchmark_details` (
	`benchmark_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text,
	`description` text,
	`date_published` text,
	`date_modified` text,
	`source_url` text NOT NULL,
	`parsed_r2_key` text NOT NULL,
	`source_hash` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `refresh_state` (
	`name` text PRIMARY KEY NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`last_success_at` integer,
	`lease_until` integer,
	`last_error` text,
	`catalog_r2_key` text,
	`catalog_hash` text
);
--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`discovered_count` integer DEFAULT 0 NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`source_url` text NOT NULL,
	`content_hash` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`etag` text,
	`last_modified` text,
	`http_status` integer NOT NULL,
	`parser_version` text NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`previous_hash` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_documents_url_hash_idx` ON `source_documents` (`source_url`,`content_hash`);