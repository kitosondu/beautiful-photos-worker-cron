-- ./node_modules/.bin/wrangler d1 execute unsplash_photos --local --command "CREATE TABLE "photos" ("photo_id" varchar PRIMARY KEY NOT NULL, "data_json" text NOT NULL, "created_ts" integer NOT NULL);"

-- ./node_modules/.bin/wrangler d1 execute unsplash_photos --local --command "CREATE TABLE "access_tokens" ( "token" varchar PRIMARY KEY NOT NULL, "created_ts" integer NOT NULL);"

-- ./node_modules/.bin/wrangler d1 execute unsplash_photos --local --command "CREATE TABLE "rate_limits" ("ip" TEXT NOT NULL, "user_id" TEXT NOT NULL, "endpoint" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "reset_time" INTEGER NOT NULL, PRIMARY KEY (ip, endpoint));"

-- ./node_modules/.bin/wrangler d1 execute unsplash_photos --local --command "CREATE INDEX idx_rate_limits_reset_time ON rate_limits(reset_time);"

-- ./node_modules/.bin/wrangler d1 execute unsplash_photos --local --command "CREATE INDEX idx_rate_limits_ip_reset_time ON rate_limits(ip, reset_time);"

CREATE TABLE photos (
    photo_id varchar PRIMARY KEY NOT NULL,
    data_json text NOT NULL,
    created_ts integer NOT NULL
);

CREATE TABLE access_tokens (
    token varchar PRIMARY KEY NOT NULL,
    created_ts integer NOT NULL
);

CREATE TABLE rate_limits (
    ip TEXT NOT NULL,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    reset_time INTEGER NOT NULL,
    PRIMARY KEY (ip, endpoint)
);

CREATE INDEX idx_rate_limits_reset_time ON rate_limits(reset_time);
CREATE INDEX idx_rate_limits_ip_reset_time ON rate_limits(ip, reset_time);
