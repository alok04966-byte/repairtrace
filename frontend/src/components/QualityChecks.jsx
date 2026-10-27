import { useState } from 'react';
import { repairs } from '../api.js';

export function Quality({repair,attempt,act,busy,ready,rework}){
  const [values,setValues]=useState({});
  if(!attempt)return null;
  const pending=attempt.checks.filter(c=>c.result==='pending');
  return <div className="quality-panel"><h3>Quality attempt {attempt.attempt}</h3><div className="quality-checks">{pending.map(c=><div className="row quality-check-row" key={c.id}><span>{c.label}</span><select onChange={e=>setValues({...values,[c.id]:{...values[c.id],result:e.target.value}})}><option value="">Choose</option><option value="pass">Pass</option><option value="fail">Fail</option></select><input placeholder="Failure note if needed" onChange={e=>setValues({...values,[c.id]:{...values[c.id],notes:e.target.value}})}/></div>)}{attempt.checks.filter(c=>c.result!=='pending').map(c=><div className="quality-result" key={c.id}><strong>{c.label}: {c.result}</strong>{c.notes&&<p>{c.notes}</p>}</div>)}</div><div className="workflow-actions quality-actions">{pending.length>0&&<button disabled={busy||!Object.keys(values).length} onClick={()=>act(()=>repairs.checks(repair.id,Object.entries(values).map(([id,v])=>({id,...v}))))}>Submit results</button>}{attempt.checks.some(c=>c.result==='fail')&&<button className="danger" disabled={busy} onClick={rework}>Return for rework</button>}{attempt.checks.every(c=>c.result==='pass')&&<button disabled={busy} onClick={ready}>Mark ready for collection</button>}</div></div>;
}
