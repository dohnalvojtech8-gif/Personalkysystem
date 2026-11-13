import {scrypt as scryptCb,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {AppError} from './domain.js';
const scrypt=promisify(scryptCb);
export const digest=s=>createHash('sha256').update(s).digest('hex');
export function validatePassword(p){if(typeof p!=='string'||p.length<12||p.length>128)throw new AppError(400,'Heslo musí mít 12 až 128 znaků.');}
export async function hashPassword(p){validatePassword(p);const salt=randomBytes(16).toString('hex'),hash=await scrypt(p,salt,64);return`scrypt:${salt}:${hash.toString('hex')}`;}
const dummySalt='00000000000000000000000000000000';
export async function verifyPassword(p,stored){if(typeof p!=='string'||p.length>128)return false;const [,salt,hex]=(stored||'scrypt:'+dummySalt+':'+('0'.repeat(128))).split(':');const actual=await scrypt(p,salt,64),expected=Buffer.from(hex,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)&&!!stored;}
export const token=()=>randomBytes(32).toString('base64url');
export function secureEqual(a,b){const aa=Buffer.from(digest(a||'')),bb=Buffer.from(digest(b||''));return timingSafeEqual(aa,bb);}
