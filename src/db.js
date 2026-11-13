import pg from 'pg';
export function createPool(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL není nastaveno.');const url=new URL(process.env.DATABASE_URL);for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);return new pg.Pool({connectionString:url.toString(),max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,...(process.env.DATABASE_SSL==='false'?{}:{ssl:{rejectUnauthorized:true}})});}
export async function migrate(pool){const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(8120842001)");await c.query(`CREATE SCHEMA IF NOT EXISTS perso;
CREATE TABLE IF NOT EXISTS perso.state (id integer PRIMARY KEY CHECK(id=1), data jsonb NOT NULL, revision integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS perso.accounts (id uuid PRIMARY KEY, employee_id text NOT NULL UNIQUE, username text NOT NULL, display_name text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS perso_accounts_username ON perso.accounts(lower(username));
CREATE TABLE IF NOT EXISTS perso.sessions (token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES perso.accounts(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS perso_sessions_expiry ON perso.sessions(expires_at);
CREATE TABLE IF NOT EXISTS perso.audit (id uuid PRIMARY KEY, at timestamptz NOT NULL, actor_id text NOT NULL, actor text NOT NULL, action text NOT NULL, target text NOT NULL, before_value text NOT NULL DEFAULT '', after_value text NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS perso_audit_time ON perso.audit(at DESC);
CREATE TABLE IF NOT EXISTS perso.login_attempts (bucket text PRIMARY KEY, failures integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL);
ALTER TABLE perso.state ENABLE ROW LEVEL SECURITY;
ALTER TABLE perso.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE perso.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE perso.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE perso.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA perso FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA perso FROM PUBLIC;
CREATE OR REPLACE FUNCTION perso.immutable_audit() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN RAISE EXCEPTION 'Audit history is append only'; END; $$;
DROP TRIGGER IF EXISTS perso_audit_immutable ON perso.audit;
CREATE TRIGGER perso_audit_immutable BEFORE UPDATE OR DELETE ON perso.audit FOR EACH ROW EXECUTE FUNCTION perso.immutable_audit();`);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function transaction(pool,fn){const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function writeAudit(c,l){await c.query('INSERT INTO perso.audit(id,at,actor_id,actor,action,target,before_value,after_value) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[l.id,l.at,l.actorId,l.actor,l.action,l.target,l.before||'',l.after||'']);}
