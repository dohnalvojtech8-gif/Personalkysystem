import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {AppError,permission,name} from './domain.js';

const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;});
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const entry=z.object({id:z.string().min(1).max(100).optional(),employeeId:z.string().min(1).max(100),date:day,shiftId:z.string().min(1).max(100),start:time,end:time}).strict();
const fail=(message,status=400)=>{throw new AppError(status,message);};

export function scheduleEmployee(state,actor,employeeId){
 const p=permission(actor,state);
 if(!p.admin&&employeeId!==actor.employeeId)fail('Kalendář patří jinému zaměstnanci.',403);
 const e=state.employees.find(e=>e.id===employeeId);
 if(!e)fail('Zaměstnanec neexistuje.',404);
 return e;
}

// Minutes on a civil calendar: overnight shifts end on the following day.
function interval(s){const minute=t=>Number(t.slice(0,2))*60+Number(t.slice(3));const base=Date.parse(s.date+'T00:00:00Z')/60000,start=minute(s.start),end=minute(s.end);return[base+start,base+end+(end<start?1440:0)];}

export function updateSchedule(state,input,actor){
 const parsed=z.object({action:z.enum(['save','delete']),employeeId:z.string().min(1).max(100),id:z.string().min(1).max(100).optional(),entry:entry.optional()}).strict().safeParse(input);
 if(!parsed.success)fail('Zkontrolujte datum, směnu a čas začátku i konce.');
 const b=parsed.data,e=scheduleEmployee(state,actor,b.employeeId),all=state.plannedShifts||[];
 const old=b.id?all.find(s=>s.id===b.id):null;
 if(b.id&&(!old||old.employeeId!==e.id))fail('Směna neexistuje.',404);
 let next;
 if(b.action==='delete'){if(!old)fail('Vyberte směnu k odstranění.');next=all.filter(s=>s.id!==old.id);}
 else{
  if(!e.active)fail('Zaměstnanec je archivovaný.');
  const s=b.entry;if(!s||s.employeeId!==e.id||s.id!==b.id)fail('Neplatný profil nebo identifikátor směny.');
  const shift=state.shifts.find(x=>x.id===s.shiftId&&(x.active||old?.shiftId===x.id));if(!shift)fail('Vyberte aktivní typ směny.');
  if(s.start===s.end)fail('Začátek a konec směny se musí lišit.');
  const [start,end]=interval(s);
  if(all.some(x=>x.employeeId===e.id&&x.id!==b.id&&(()=>{const [a,z]=interval(x);return start<z&&end>a;})()))fail('Směna se překrývá s jinou směnou v tomto profilu.',409);
  const saved={...s,id:b.id||randomUUID(),name:shift.name,code:shift.code,updatedAt:new Date().toISOString()};
  next=[...all.filter(x=>x.id!==saved.id),saved];
 }
 if(next.length>50000)fail('Kalendář obsahuje příliš mnoho směn.');
 const saved=b.action==='delete'?null:next.find(x=>!all.some(o=>o.id===x.id&&JSON.stringify(o)===JSON.stringify(x)));
 return{state:{...state,plannedShifts:next},log:{id:randomUUID(),at:new Date().toISOString(),actorId:actor.employeeId,actor:actor.displayName||name(state.employees.find(e=>e.id===actor.employeeId)),action:b.action==='delete'?'Odstranění plánované směny':old?'Úprava plánované směny':'Zapsání plánované směny',target:name(e),before:old?JSON.stringify(old):'',after:saved?JSON.stringify(saved):'Odstraněno'}};
}
