// Attribute the shared allowance proportionally. Integer cents and largest
// remainders keep the per-item estimate equal to the exact payroll deduction.
export function insights(records){
 const rows=new Map();
 for(const r of records){
  const items=[...r.items.map(i=>({...i,kind:'food'})),...r.packs.map(i=>({...i,kind:'pack'}))].map(i=>({...i,cost:Math.round(i.price*100)*i.qty}));
  const budget=items.filter(i=>i.kind==='food'||i.payer==='budget'),total=budget.reduce((s,i)=>s+i.cost,0),excess=Math.max(0,total-Math.round(r.shift.limit*100));
  const shares=budget.map(i=>({i,exact:total?excess*i.cost/total:0}));
  shares.forEach(x=>x.due=Math.floor(x.exact));let left=excess-shares.reduce((s,x)=>s+x.due,0);
  shares.slice().sort((a,b)=>(b.exact-b.due)-(a.exact-a.due)).forEach(x=>{if(left>0){x.due++;left--;}});
  for(const i of items){const key=i.kind+':'+i.id;const row=rows.get(key)||{id:key,name:i.name,kind:i.kind,qty:0,cost:0,due:0};row.qty+=i.qty;row.cost+=i.cost;row.due+=i.kind==='pack'&&i.payer==='employee'?i.cost:shares.find(x=>x.i===i)?.due||0;rows.set(key,row);}
 }
 return [...rows.values()].map(r=>({...r,cost:r.cost/100,due:r.due/100}));
}
