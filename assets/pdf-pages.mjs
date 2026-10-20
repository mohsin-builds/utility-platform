export function parsePages(value,total,{allIfBlank=false}={}){
 if(!Number.isInteger(total)||total<1||total>500)throw Error('Maximum 500 pages.');
 const s=String(value??'').trim();
 if(!s){if(allIfBlank)return Array.from({length:total},(_,i)=>i);throw Error('Enter page numbers.');}
 const result=[],seen=new Set();
 for(const part of s.split(',')){
  const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if(!m)throw Error('Use 1,3-5 format.');
  const a=Number(m[1]),b=m[2]?Number(m[2]):a;
  if(a<1||b>total||b<a)throw Error('Page range invalid for this document.');
  for(let n=a;n<=b;n++){if(seen.has(n))throw Error('Repeated page: '+n);seen.add(n);result.push(n-1);}
 }
 return result;
}
export function parseGroups(value,total){
 const groups=String(value??'').split(';').map(s=>s.trim());
 if(groups.length>20||groups.some(s=>!s))throw Error('Enter 1–20 valid ranges separated by semicolons.');
 return groups.map(s=>parsePages(s,total));
}
export function validateReorder(sequence,total){
 if(sequence.length!==total||new Set(sequence).size!==total)throw Error('Include each page exactly once in the new order.');
 return sequence;
}