-- Passage en multi-utilisateur : comptes, espaces, passkeys, et isolation des données par espace.
-- Les données existantes sont rattachées à un « espace historique » (chiffré avec la clé maîtresse),
-- que son propriétaire réclame ensuite avec `node scripts/enroll.ts --email …`.

-- ---------------------------------------------------------------- Comptes
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_key" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"public_key" "bytea" NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"challenge" text NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"email_token_hash" text,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

-- ---------------------------------------------------------------- Sessions : les anciennes (sans compte) sont invalidées
DELETE FROM "sessions";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint

-- ---------------------------------------------------------------- Données existantes → espace historique
INSERT INTO "workspaces" ("id", "data_key") VALUES ('00000000-0000-4000-8000-000000000001', NULL);--> statement-breakpoint

ALTER TABLE "settings" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "invoice_files" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "workspace_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint

-- Désormais, l'espace vient du contexte de la requête (SET LOCAL app.workspace_id)
ALTER TABLE "settings" ALTER COLUMN "workspace_id" SET DEFAULT nullif(current_setting('app.workspace_id', true), '')::uuid;--> statement-breakpoint
ALTER TABLE "platforms" ALTER COLUMN "workspace_id" SET DEFAULT nullif(current_setting('app.workspace_id', true), '')::uuid;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "workspace_id" SET DEFAULT nullif(current_setting('app.workspace_id', true), '')::uuid;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "workspace_id" SET DEFAULT nullif(current_setting('app.workspace_id', true), '')::uuid;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "workspace_id" SET DEFAULT nullif(current_setting('app.workspace_id', true), '')::uuid;--> statement-breakpoint
ALTER TABLE "invoice_files" ALTER COLUMN "workspace_id" SET DEFAULT nullif(current_setting('app.workspace_id', true), '')::uuid;--> statement-breakpoint
ALTER TABLE "deadlines" ALTER COLUMN "workspace_id" SET DEFAULT nullif(current_setting('app.workspace_id', true), '')::uuid;--> statement-breakpoint

ALTER TABLE "settings" ADD CONSTRAINT "settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "invoice_files" ADD CONSTRAINT "invoice_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;--> statement-breakpoint
CREATE INDEX "payments_workspace_idx" ON "payments" USING btree ("workspace_id");--> statement-breakpoint

-- Unicités désormais par espace
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_workspace_id_key_pk" PRIMARY KEY("workspace_id","key");--> statement-breakpoint
ALTER TABLE "deadlines" DROP CONSTRAINT "deadlines_auto_key_unique";--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_workspace_auto_key" UNIQUE("workspace_id","auto_key");--> statement-breakpoint

-- ---------------------------------------------------------------- Row-Level Security
-- Chaque table métier n'expose que les lignes de l'espace de la requête ; sans contexte, aucune ligne.
-- FORCE : la règle s'applique aussi au propriétaire des tables.
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "settings" USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "platforms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platforms" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "platforms" USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "clients" USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "services" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "services" USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "payments" USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "invoice_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "invoice_files" USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "deadlines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deadlines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "deadlines" USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);--> statement-breakpoint

-- ---------------------------------------------------------------- Rôle applicatif sans privilège
-- Les requêtes métier s'exécutent sous ce rôle (SET LOCAL ROLE), qui ne peut pas contourner la RLS,
-- même si la connexion utilise un compte administrateur. Création ignorée si le droit manque :
-- le serveur vérifie au démarrage qu'il ne contourne pas la RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'invoom_app') THEN
    CREATE ROLE invoom_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT invoom_app TO %I', current_user);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Rôle invoom_app non créé (droits insuffisants)';
END
$$;
