CREATE TABLE `api_key_rate_limits` (
	`api_key_id` text NOT NULL,
	`hour_bucket` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`api_key_id`, `hour_bucket`),
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
