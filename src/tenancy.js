import {randomUUID,randomBytes} from 'node:crypto';
import {AppError,initialState} from './domain.js';
import {hashPassword} from './auth.js';
import {writeAudit} from './db.js';
export const LEGACY_VENUE='00000000-0000-0000-0000-000000000001';
export const isSuper=a=>a.role==='superadmin';
export const tenantMigration=`
CREATE TABLE IF NOT EXISTS perso.venues (id uuid PRIMARY KEY, name text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO perso.venues(id,name) VALUES ('${LEGACY_VENUE}','Moje restaurace') ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS perso.venue_states (venue_id uuid PRIMARY KEY REFERENCES perso.venues(id), data jsonb NOT NULL, revision integer NOT NULL DEFAULT 0);
ALTER TABLE perso.accounts ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'employee' CHECK(role IN ('superadmin','owner','employee'));
ALTER TABLE perso.accounts ADD COLUMN IF NOT EXISTS venue_id uuid DEFAULT '${LEGACY_VENUE}' REFERENCES perso.venues(id);
ALTER TABLE perso.accounts ADD COLUMN IF NOT EXISTS must_change_credentials boolean NOT NULL DEFAULT false;
ALTER TABLE perso.accounts ADD COLUMN IF NOT EXISTS temporary_expires_at timestamptz;
UPDATE perso.accounts SET role='superadmin',venue_id=NULL WHERE employee_id='admin' AND role='employee';
CREATE UNIQUE INDEX IF NOT EXISTS perso_one_owner_per_venue ON perso.accounts(venue_id) WHERE role='owner';
CREATE INDEX IF NOT EXISTS perso_accounts_venue ON perso.accounts(venue_id);
ALTER TABLE perso.audit ADD COLUMN IF NOT EXISTS venue_id uuid NOT NULL DEFAULT '${LEGACY_VENUE}' REFERENCES perso.venues(id);
CREATE INDEX IF NOT EXISTS perso_audit_venue_time ON perso.audit(venue_id,at DESC);
ALTER TABLE perso.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE perso.venue_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON perso.venues,perso.venue_states FROM PUBLIC;
`;
export function requireSuper(actor){if(!isSuper(actor))throw new AppError(403,'Provozy může vytvářet a spravovat pouze hlavní administrátor.');}
export async function scopeActor(c,actor,requested){const venueId=requested||actor.venueId||LEGACY_VENUE;if(!/^[0-9a-f-]{36}$/i.test(venueId))throw new AppError(400,'Neplatný provoz.');if(!isSuper(actor)&&venueId!==actor.venueId)throw new AppError(403,'K tomuto provozu nemáte přístup.');const v=(await c.query('SELECT id,name,active FROM perso.venues WHERE id=$1',[venueId])).rows[0];if(!v)throw new AppError(404,'Provoz neexistuje.');if(!v.active&&!isSuper(actor))throw new AppError(403,'Provoz je pozastavený. Kontaktujte administrátora.');return{...actor,venueId:v.id,venueName:v.name};}
export async function readVenueState(c,venueId,lock=false){const q=venueId===LEGACY_VENUE?'SELECT data,revision FROM perso.state WHERE id=1':'SELECT data,revision FROM perso.venue_states WHERE venue_id=$1';const r=await c.query(q+(lock?' FOR UPDATE':''),venueId===LEGACY_VENUE?[]:[venueId]);if(!r.rows.length)throw new AppError(503,'Provoz ještě není připraven.');return r.rows[0];}
export async function updateVenueState(c,venueId,data){if(venueId===LEGACY_VENUE)return c.query('UPDATE perso.state SET data=$1,revision=revision+1 WHERE id=1',[JSON.stringify(data)]);return c.query('UPDATE perso.venue_states SET data=$1,revision=revision+1 WHERE venue_id=$2',[JSON.stringify(data),venueId]);}
export async function listVenues(c){return(await c.query(`SELECT v.id,v.name,v.active,v.created_at AS "createdAt", a.username AS "ownerUsername",a.display_name AS "ownerName",a.must_change_credentials AS "pendingActivation",a.temporary_expires_at AS "temporaryExpiresAt" FROM perso.venues v LEFT JOIN perso.accounts a ON a.venue_id=v.id AND a.role='owner' ORDER BY v.created_at,v.id`)).rows;}
export function temporaryCredentials(){return{username:'majitel-'+randomBytes(6).toString('hex'),password:randomBytes(18).toString('base64url')};}
export async function provisionOwner(c,{venueId,venueName,ownerName,actor,reset=false}){const credentials=temporaryCredentials(),hash=await hashPassword(credentials.password),expiresAt=new Date(Date.now()+72*3600000).toISOString();const ownerId='owner:'+venueId;
 if(reset){const r=await c.query("UPDATE perso.accounts SET username=$1,password_hash=$2,must_change_credentials=true,temporary_expires_at=$3 WHERE venue_id=$4 AND role='owner' RETURNING id",[credentials.username,hash,expiresAt,venueId]);if(!r.rows.length)throw new AppError(404,'Tento provoz nemá samostatného majitele.');await c.query('DELETE FROM perso.sessions WHERE account_id=$1',[r.rows[0].id]);}
 else{await c.query('INSERT INTO perso.venues(id,name) VALUES($1,$2)',[venueId,venueName]);await c.query('INSERT INTO perso.venue_states(venue_id,data) VALUES($1,$2)',[venueId,JSON.stringify(initialState())]);await c.query("INSERT INTO perso.accounts(id,employee_id,username,display_name,password_hash,role,venue_id,must_change_credentials,temporary_expires_at) VALUES($1,$2,$3,$4,$5,'owner',$6,true,$7)",[randomUUID(),ownerId,credentials.username,ownerName,hash,venueId,expiresAt]);}
 await writeAudit(c,{id:randomUUID(),at:new Date().toISOString(),actorId:actor.employeeId,actor:actor.displayName,action:reset?'Obnovení dočasného přístupu majitele':'Vytvoření provozu a účtu majitele',target:venueName,after:'Dočasné přihlášení platí 72 hodin; vyžaduje nové jméno a heslo.',venueId});return{...credentials,expiresAt};}
