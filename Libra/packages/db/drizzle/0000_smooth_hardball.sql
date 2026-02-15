CREATE TABLE "components" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"component_slug" text NOT NULL,
	"code" text,
	"compiled_css" text,
	"component_names" json NOT NULL,
	"demo_code" text,
	"demo_dependencies" json,
	"demo_direct_registry_dependencies" json,
	"dependencies" json,
	"direct_registry_dependencies" json,
	"description" text,
	"global_css_extension" text,
	"tailwind_config_extension" text,
	"downloads_count" integer DEFAULT 0,
	"likes_count" integer DEFAULT 0,
	"is_public" boolean DEFAULT false,
	"is_paid" boolean DEFAULT false,
	"payment_url" text,
	"preview_url" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "components_component_slug_unique" UNIQUE("component_slug")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"template_type" text NOT NULL,
	"url" text,
	"git_url" text,
	"git_branch" text,
	"preview_image_url" text,
	"production_deploy_url" text,
	"workflow_id" text,
	"deployment_status" varchar,
	"custom_domain" text,
	"custom_domain_status" varchar,
	"custom_domain_verified_at" timestamp with time zone,
	"custom_hostname_id" text,
	"ownership_verification" text,
	"ssl_status" varchar,
	"visibility" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"container_id" text,
	"initial_message" text,
	"knowledge" text,
	"message_history" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "project_ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"total_ai_message_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"attachment_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_customer_id" text,
	"plan_name" text NOT NULL,
	"plan_id" text NOT NULL,
	"ai_nums" integer NOT NULL,
	"enhance_nums" integer NOT NULL,
	"upload_limit" integer NOT NULL,
	"deploy_limit" integer NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"project_nums" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_ai_usage" ADD CONSTRAINT "project_ai_usage_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset" ADD CONSTRAINT "project_asset_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_limit_org_plan_active_idx" ON "subscription_limit" USING btree ("organization_id","plan_name") WHERE "subscription_limit"."is_active" = true;