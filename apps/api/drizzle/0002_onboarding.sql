-- First-run setup: new workspaces must go through it before using the app. Workspaces that already exist were set
-- up through the settings pages, so they count as done.
ALTER TABLE "workspaces" ADD COLUMN "onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "workspaces" SET "onboarded" = true;
