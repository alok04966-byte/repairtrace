import { useState } from 'react';
import { repairs } from '../api.js';
import { Quality } from './QualityChecks.jsx';

export default function StaffWorkflow({repair,act,busy}){
  const [diagnosis,setDiagnosis]=useState(repair.diagnosis||''),[item,setItem]=useState({description:'',quantity:1,unitPrice:''}),[lines,setLines]=useState([]);
  const status=(s,extra={})=>act(()=>repairs.status(repair.id,{status:s,...extra}));
  const attempt=repair.qualityAttempts?.at(-1);
  const priceValid=/^\d+(\.\d{1,2})?$/.test(item.unitPrice)&&Number(item.unitPrice)>=0;
  function addLine(){if(!item.description.trim()||item.description.trim().length>300||!Number.isInteger(Number(item.quantity))||Number(item.quantity)<1||Number(item.quantity)>1000||!priceValid)return;setLines([...lines,{description:item.description.trim(),quantity:Number(item.quantity),unitPrice:item.unitPrice}]);setItem({description:'',quantity:1,unitPrice:''});}
  return <>
    <section className="card"><h2>Diagnosis</h2><textarea value={diagnosis} onChange={e=>setDiagnosis(e.target.value)}/><button disabled={busy||!diagnosis.trim()} onClick={()=>act(()=>repairs.diagnosis(repair.id,{diagnosis}))}>Save diagnosis</button></section>
    <section className="card"><h2>Create quotation</h2><div className="row"><input aria-label="Item description" placeholder="Description" value={item.description} onChange={e=>setItem({...item,description:e.target.value})}/><input aria-label="Quantity" type="number" min="1" max="1000" value={item.quantity} onChange={e=>setItem({...item,quantity:e.target.value})}/><input aria-label="Unit price in INR" inputMode="decimal" placeholder="INR" value={item.unitPrice} onChange={e=>setItem({...item,unitPrice:e.target.value})}/><button type="button" disabled={busy||!item.description.trim()||!priceValid||!Number.isInteger(Number(item.quantity))||Number(item.quantity)<1} onClick={addLine}>Add</button></div>{lines.map((x,i)=><div className="row draft-line" key={i}><span>{x.description} &times; {x.quantity} &mdash; &#8377;{(x.quantity*Number(x.unitPrice)).toFixed(2)}</span><button type="button" className="danger" disabled={busy} onClick={()=>setLines(lines.filter((_,index)=>index!==i))}>Remove</button></div>)}<p>Draft total: &#8377;{lines.reduce((sum,x)=>sum+x.quantity*Number(x.unitPrice),0).toFixed(2)}</p><button disabled={busy||!lines.length} onClick={()=>act(()=>repairs.quote(repair.id,{items:lines}).then(()=>setLines([])))}>Create quotation</button></section>
    <section className="card"><h2>Workflow</h2><div className="workflow-content"><div className="workflow-actions">
      {repair.status==='in_progress'&&<><button disabled={busy} onClick={()=>{const reason=prompt('Parts blocker reason');if(reason)status('awaiting_parts',{reason})}}>Awaiting parts</button><button disabled={busy} onClick={()=>status('quality_check')}>Start quality check</button></>}
      {repair.status==='awaiting_parts'&&<button disabled={busy} onClick={()=>{const resolutionNote=prompt('Resolution note');if(resolutionNote)status('in_progress',{resolutionNote})}}>Resume work</button>}
      {repair.status==='ready_for_collection'&&<button disabled={busy} onClick={()=>{const recipientName=prompt('Recipient name');if(recipientName)act(()=>repairs.handover(repair.id,{recipientName}))}}>Record handover</button>}
    </div>{repair.status==='quality_check'&&<Quality repair={repair} attempt={attempt} act={act} busy={busy} ready={()=>status('ready_for_collection')} rework={()=>{const resolutionNote=prompt('Rework note');if(resolutionNote)status('in_progress',{resolutionNote})}}/>}</div></section>
  </>;
}
