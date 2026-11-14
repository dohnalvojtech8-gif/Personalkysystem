import {z} from 'zod';
import {randomUUID} from 'node:crypto';
const id=z.string().min(1).max(100),text=z.string().trim().min(1).max(120),price=z.number().min(0).max(100000).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-6,'Částka může mít nejvýše dvě desetinná místa.');
const employee=z.object({id,first:text,last:text,position:text,username:z.string().regex(/^[a-zA-Z0-9._-]{1,50}$/),writer:z.boolean(),active:z.boolean()});
const food=z.object({id,name:text,price,category:text,favorite:z.boolean(),active:z.boolean()});
const pack=z.object({id,name:text,price,payer:z.enum(['company','employee','budget']),active:z.boolean()});
const shift=z.object({id,name:text,code:z.string().min(1).max(8),limit:price,active:z.boolean()});
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;});
const qty=z.number().int().min(1).max(1000);
const record=z.object({id,employeeId:id,date:day,shift,items:z.array(food.extend({qty})).max(100),packs:z.array(pack.extend({qty})).max(100),paid:z.boolean(),createdBy:z.string().max(150),updatedAt:z.string().datetime()});
const schema=z.object({employees:z.array(employee).max(1000),foods:z.array(food).max(2000),packs:z.array(pack).max(100),shifts:z.array(shift).max(100),categories:z.array(text).max(100),positions:z.array(text).max(100),records:z.array(record).max(50000)});
export class AppError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(m,status=400)=>{throw new AppError(status,m);};
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const eq=(a,b)=>canonical(a)===canonical(b);
export const name=e=>e?e.first+' '+e.last:'Archivovaný zaměstnanec';
export const cents=v=>Math.round((v+Number.EPSILON)*100)/100;
export function calculate(r){const total=a=>cents(a.reduce((s,i)=>s+i.price*i.qty,0)),meals=total(r.items),own=total(r.packs.filter(p=>p.payer==='employee')),budget=total(r.packs.filter(p=>p.payer==='budget')),company=total(r.packs.filter(p=>p.payer==='company'));return{meals,own,budget,company,packs:cents(own+budget+company),covered:cents(Math.min(r.shift.limit,meals+budget)),due:cents(Math.max(0,cents(meals+budget)-r.shift.limit)+own)};}
export function initialState(){return{records:[],employees:[],foods:[],packs:[{id:randomUUID(),name:'Krabička',price:15,payer:'employee',active:true},{id:randomUUID(),name:'Kelímek na polévku',price:10,payer:'company',active:true}],shifts:[{id:randomUUID(),name:'Ranní',code:'R',limit:250,active:true},{id:randomUUID(),name:'Celodenní',code:'CD',limit:500,active:true}],categories:['Polévky','Předkrmy','Hlavní chody','Pizzy','Burgery','Dezerty'],positions:['Obsluha','Kuchař','Šéfkuchař','Barista']};}
export function permission(actor,state){if(actor.role==='superadmin'||actor.role==='owner'||(!actor.role&&actor.employeeId==='admin'))return{admin:true,write:true};const e=state.employees.find(e=>e.id===actor.employeeId&&e.active);if(!e)fail('Účet je neaktivní.',401);return{admin:false,write:e.writer};}
export function filteredState(s,actor){const p=permission(actor,s);return{...s,employees:p.admin||p.write?s.employees:s.employees.filter(e=>e.id===actor.employeeId),records:p.admin||p.write?s.records:s.records.filter(r=>r.employeeId===actor.employeeId)};}
function unique(arr,key){const seen=new Set();for(const x of arr){const k=key(x);if(seen.has(k))fail('Záznamy musí mít jedinečné identifikátory a názvy.');seen.add(k);}}
const props=['employees','foods','packs','shifts','categories','positions','records'];
export function parseState(s){const r=schema.safeParse(s);if(!r.success)fail('Neplatná data: '+r.error.issues[0].message);const n=r.data;for(const k of ['employees','foods','packs','shifts','records'])unique(n[k],x=>x.id);unique(n.employees,x=>x.username.toLowerCase());unique(n.categories,x=>x.toLocaleLowerCase('cs'));unique(n.positions,x=>x.toLocaleLowerCase('cs'));unique(n.records,r=>r.employeeId+'|'+r.date);if(n.employees.some(e=>e.username.toLowerCase()==='admin'))fail('Uživatelské jméno admin je rezervované.');if(!n.shifts.some(s=>s.active))fail('Musí zůstat alespoň jedna aktivní směna.');return n;}
function snapshot(item){const {qty,...rest}=item;return rest;}
function signature(i){return canonical(snapshot(i));}
function quantities(items){const q=new Map();for(const i of items){const k=signature(i);q.set(k,(q.get(k)||0)+i.qty);}return q;}
function validateItems(items,oldItems,catalog,allowNew){const oq=quantities(oldItems),nq=quantities(items);if(nq.size!==items.length)fail('Stejná položka nemůže být v zápisu dvakrát.');for(const i of items){const sig=signature(i);if(oq.has(sig))continue;const f=catalog.find(f=>f.id===i.id&&f.active);if(!allowNew||!f||!eq(snapshot(i),f))fail('Položka musí odpovídat platnému jídelníčku nebo původnímu zápisu.');}return{decreased:[...oq].some(([k,q])=>(nq.get(k)||0)<q),increased:[...nq].some(([k,q])=>q>(oq.get(k)||0))};}
const desc=r=>{if(!r)return'Žádný zápis';const c=calculate(r);return`${r.date} · ${r.shift.code} · limit ${r.shift.limit} Kč · ${r.items.map(i=>i.qty+'× '+i.name+' ('+i.price+' Kč)').join(', ')}${r.packs.length?' · Obaly: '+r.packs.map(i=>i.qty+'× '+i.name+' ('+i.price+' Kč, '+{employee:'hradí zaměstnanec',budget:'z limitu',company:'hradí podnik'}[i.payer]+')').join(', '):''} · Doplatek ${c.due} Kč · ${r.paid?'Uhrazeno':'Neuhrazeno'}`;};
export function applyUpdate(old,candidate,actor){const p=permission(actor,old);if(!p.write)fail('Nemáte oprávnění k zápisu.',403);const next=parseState(candidate);const logs=[];const actorName=p.admin?actor.displayName:name(old.employees.find(e=>e.id===actor.employeeId));const log=(action,target,before,after)=>logs.push({id:randomUUID(),at:new Date().toISOString(),actor:actorName,actorId:actor.employeeId,action,target,before,after});
 for(const key of props.filter(k=>k!=='records')){
  if(eq(old[key],next[key]))continue;if(!p.admin)fail('Správu zaměstnanců, cen a nastavení může měnit pouze administrátor.',403);
  if(['employees','foods','packs','shifts'].includes(key)){
   for(const x of old[key])if(!next[key].some(y=>x.id===y.id))fail('Použijte archivaci, aby zůstala zachovaná historie.');
   for(const x of next[key]){const before=old[key].find(y=>y.id===x.id);if(eq(before,x))continue;const target=key==='employees'?name(x):x.name;const action={employees:'Úprava zaměstnance a oprávnění',foods:'Úprava jídelníčku',packs:'Úprava obalu',shifts:'Úprava směny'}[key];log(before?action:'Vytvoření: '+target,target,before?JSON.stringify(before):'',JSON.stringify(x));}
  }else log(key==='categories'?'Změna kategorií':'Změna pracovních pozic','Nastavení',old[key].join(', '),next[key].join(', '));
 }
 // Disallow state/catalog inconsistency; archived historical categories and positions may remain.
 for(const f of next.foods.filter(f=>f.active))if(!next.categories.includes(f.category))fail('Aktivní jídlo musí patřit do existující kategorie.');
 for(const e of next.employees.filter(e=>e.active))if(!next.positions.includes(e.position))fail('Zaměstnanec musí mít existující pracovní pozici.');
 for(const r of old.records){if(next.records.some(n=>n.id===r.id))continue;if(!p.admin)fail('Mazat zápisy může pouze administrátor.',403);if(r.paid)fail('Uhrazený zápis nelze odstranit.');log('Odstranění zápisu',name(old.employees.find(e=>e.id===r.employeeId)),desc(r),'Odstraněno');}
 for(const r of next.records){const before=old.records.find(x=>x.id===r.id);if(eq(before,r))continue;
  const e=next.employees.find(e=>e.id===r.employeeId);if(!e)fail('Zaměstnanec neexistuje.');
  if(!before){if(!e.active)fail('Zaměstnanec je archivovaný.');if(r.paid)fail('Nový zápis nemůže být označený jako uhrazený.');const s=old.shifts.find(x=>x.id===r.shift.id&&x.active);if(!s||!eq(s,r.shift))fail('Směna musí odpovídat platnému nastavení.');if(old.records.some(x=>x.employeeId===r.employeeId&&x.date===r.date))fail('Denní zápis už existuje. Obnovte data.',409);
  }else{
   if(before.employeeId!==r.employeeId||before.date!==r.date||!eq(before.shift,r.shift))fail('Zaměstnance, den a původní příspěvek uloženého zápisu nelze měnit.');
   const changedContent=!eq(before.items,r.items)||!eq(before.packs,r.packs);
   if(before.paid&&changedContent)fail('Uhrazený zápis je uzamčený.');
   if(before.paid!==r.paid){if(!p.admin)fail('Úhrady spravuje pouze administrátor.',403);if(changedContent)fail('Změnu úhrady uložte odděleně od změny jídel.');if(r.paid&&!calculate(r).due)fail('Zápis nemá doplatek.');}
  }
  if(!r.items.length&&!r.packs.length)fail('Zápis musí obsahovat alespoň jednu položku.');
  validateItems(r.items,before?.items||[],old.foods,true);validateItems(r.packs,before?.packs||[],old.packs,true);
  r.createdBy=before?.createdBy||actorName;r.updatedAt=new Date().toISOString();
  log(before?(before.paid!==r.paid?(r.paid?'Označení úhrady':'Zrušení úhrady'):'Úprava denního zápisu'):'Vytvoření zápisu',name(e),before?desc(before):'Žádný zápis',desc(r));
 }
 return{state:next,logs};
}
