import { useEffect,useRef,useState } from 'react';
import { useLocation,useNavigate,useParams } from 'react-router-dom';
import { repairs } from '../api.js';
import { dashboardForRole,hasSafeRepairOrigin } from '../routing.js';
import { useSession } from '../context/SessionContext.jsx';
import Badge from '../components/Badge.jsx';
import CustomerRepairActions from '../components/CustomerRepairActions.jsx';
import StaffWorkflow from '../components/StaffWorkflow.jsx';

export default function RepairDetailPage(){
  const {id}=useParams(),location=useLocation(),nav=useNavigate(),{user}=useSession();
  const [repair,setRepair]=useState(null),[error,setError]=useState(''),[refreshWarning,setRefreshWarning]=useState(''),[busy,setBusy]=useState(false);
  const refreshRef=useRef(null),mutationInProgress=useRef(false);
  useEffect(()=>{
    let active=true,loaded=false,currentRequest=null,generation=0;
    setRepair(null);setError('');setRefreshWarning('');
    const refresh=async(background=false)=>{
      if(!active)return;
      if(background&&currentRequest)return;
      while(currentRequest&&active){const pending=currentRequest;await pending;if(currentRequest===pending)currentRequest=null;}
      if(!active)return;
      const requestGeneration=generation;
      const pending=(async()=>{
        try{
          const response=await repairs.get(id);
          if(active&&requestGeneration===generation){setRepair(response.repair);setError('');setRefreshWarning('');loaded=true;}
        }catch(fetchError){
          if(active&&requestGeneration===generation&&fetchError.status!==401){
            if(background&&loaded)setRefreshWarning('Could not refresh this repair. Your current details are still shown; retrying automatically.');
            else setError(fetchError.message);
          }
        }
      })();
      currentRequest=pending;
      await pending;
      if(currentRequest===pending)currentRequest=null;
    };
    const controls={refresh,invalidate:()=>{generation+=1;}};
    refreshRef.current=controls;
    refresh(false);
    const timer=window.setInterval(()=>{if(!mutationInProgress.current)refresh(true);},15000);
    return()=>{active=false;window.clearInterval(timer);if(refreshRef.current===controls)refreshRef.current=null;};
  },[id]);
  async function act(fn){setBusy(true);mutationInProgress.current=true;setError('');refreshRef.current?.invalidate();try{await fn();mutationInProgress.current=false;await refreshRef.current?.refresh(false)}catch(e){setError(e.message)}finally{mutationInProgress.current=false;setBusy(false)}}
  function goBack(){if(hasSafeRepairOrigin(location.state?.from,user))nav(-1);else nav(dashboardForRole(user)||'/customer',{replace:true});}
  if(!repair)return <p>{error||'Loading repair…'}</p>;
  const latest=repair.quotes?.at(-1);
  return <>
    <button type="button" className="back-button quiet" onClick={goBack}>← Back</button>
    <div className="title"><div><h1>{repair.repairReference}</h1><p>{repair.device.brand} {repair.device.model} · {repair.reportedIssue}</p></div><Badge value={repair.status}/></div>
    <div className="feedback-slot" aria-live="polite">{error&&<p className="alert">{error}</p>}{refreshWarning&&<p className="refresh-warning">{refreshWarning}</p>}</div>
    <section className="card"><h2>Device and intake</h2><p>{repair.intakeCondition}</p></section>
    {user.role==='staff'?<StaffWorkflow repair={repair} act={act} busy={busy}/>:<CustomerRepairActions repair={repair} latest={latest} act={act} busy={busy}/>}
    <section className="card"><h2>Quotation history</h2>{repair.quotes?.map(q=><div className="quote" key={q.version}><b>Version {q.version}</b> <Badge value={q.status}/><span> ₹{q.total}</span><ul>{q.items.map((i,n)=><li key={n}>{i.description} × {i.quantity} — ₹{i.lineTotal}</li>)}</ul></div>)}</section>
  </>;
}
