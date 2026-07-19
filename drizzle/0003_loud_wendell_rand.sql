CREATE TABLE `catalog_benchmark_membership` (
	`catalog_hash` text NOT NULL,
	`benchmark_id` text NOT NULL,
	PRIMARY KEY(`catalog_hash`, `benchmark_id`)
);
--> statement-breakpoint
CREATE INDEX `catalog_benchmark_membership_id_idx` ON `catalog_benchmark_membership` (`benchmark_id`);