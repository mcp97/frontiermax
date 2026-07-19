CREATE TABLE `benchmark_fetch_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`trigger` text NOT NULL,
	`benchmark_id` text NOT NULL,
	`source_url` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`http_status` integer,
	`outcome` text NOT NULL,
	`duration_ms` integer,
	`content_hash` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `benchmark_fetch_attempts_benchmark_idx` ON `benchmark_fetch_attempts` (`benchmark_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `benchmark_fetch_attempts_run_idx` ON `benchmark_fetch_attempts` (`run_id`);--> statement-breakpoint
CREATE TABLE `benchmark_refresh_status` (
	`benchmark_id` text PRIMARY KEY NOT NULL,
	`last_attempt_at` integer DEFAULT 0 NOT NULL,
	`last_success_at` integer,
	`next_attempt_at` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `benchmark_refresh_status_due_idx` ON `benchmark_refresh_status` (`next_attempt_at`,`last_success_at`);--> statement-breakpoint
ALTER TABLE `benchmark_details` ADD `last_checked_at` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `benchmark_details`
SET `last_checked_at` = `fetched_at`
WHERE `last_checked_at` = 0;
--> statement-breakpoint
INSERT OR IGNORE INTO `benchmark_refresh_status`
  (`benchmark_id`, `last_attempt_at`, `last_success_at`, `next_attempt_at`, `failure_count`, `last_error`)
SELECT `benchmark_id`, `last_checked_at`, `last_checked_at`, 0, 0, NULL
FROM `benchmark_details`;
