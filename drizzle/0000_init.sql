CREATE TYPE "public"."currency" AS ENUM('INR', 'USD', 'EUR', 'GBP');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('open', 'joining_closed', 'drawn');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"group_id" text NOT NULL,
	"santa_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_group_id_santa_id_pk" PRIMARY KEY("group_id","santa_id"),
	CONSTRAINT "assignment_group_receiver_uq" UNIQUE("group_id","receiver_id")
);
--> statement-breakpoint
CREATE TABLE "exclusion" (
	"group_id" text NOT NULL,
	"member_a" text NOT NULL,
	"member_b" text NOT NULL,
	CONSTRAINT "exclusion_group_id_member_a_member_b_pk" PRIMARY KEY("group_id","member_a","member_b")
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"organizer_id" text NOT NULL,
	"status" "group_status" DEFAULT 'open' NOT NULL,
	"invite_code" varchar(16) NOT NULL,
	"currency" "currency" DEFAULT 'INR' NOT NULL,
	"budget_min" integer,
	"budget_max" integer,
	"exchange_date" date,
	"drawn_at" timestamp,
	"needs_redraw" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"participates" boolean DEFAULT true NOT NULL,
	"picture_override_url" text,
	"bio_hidden" boolean DEFAULT false NOT NULL,
	"revealed_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"bio" varchar(150),
	"song_track_id" text,
	"song_title" text,
	"song_artist" text,
	"song_artwork_url" text,
	"song_explicit" boolean,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_santa_id_user_id_fk" FOREIGN KEY ("santa_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_receiver_id_user_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusion" ADD CONSTRAINT "exclusion_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusion" ADD CONSTRAINT "exclusion_member_a_user_id_fk" FOREIGN KEY ("member_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusion" ADD CONSTRAINT "exclusion_member_b_user_id_fk" FOREIGN KEY ("member_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_organizer_id_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_organizer_id_idx" ON "group" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "group_member_user_id_idx" ON "group_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");