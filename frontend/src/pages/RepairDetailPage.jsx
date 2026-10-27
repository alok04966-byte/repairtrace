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
  if(!repair)return <p className="center">{error||'Loading repair…'}</p>;
  const latest=repair.quotes?.at(-1);
  return <>
    <div className="repair-top-nav">
      <button type="button" className="back-button btn-back" onClick={goBack}>← Back</button>
      <div className="repair-ref-bar">
        <span className="repair-ref-prefix">Repair reference:</span>
        <span className="repair-ref-code">{repair.repairReference}</span>
      </div>
    </div>

    <div className="repair-hero-header">
      <div className="repair-hero-info">
        <h1 className="repair-device-name">{repair.device.brand} {repair.device.model}</h1>
        <p className="repair-reported-issue">{repair.reportedIssue}</p>
      </div>
      <div className="repair-hero-badge">
        <Badge value={repair.status}/>
      </div>
    </div>

    <div className="feedback-slot" aria-live="polite">
      {error&&<p className="alert">{error}</p>}
      {refreshWarning&&<p className="refresh-warning">{refreshWarning}</p>}
    </div>

    <section className="card intake-card">
      <h2>Device and intake</h2>
      <div className="intake-field">
        <span className="intake-field-label">Reported condition & intake notes</span>
        <p className="intake-field-value">{repair.intakeCondition || 'No visible condition recorded.'}</p>
      </div>
    </section>

    {user.role==='staff'?<StaffWorkflow repair={repair} act={act} busy={busy}/>:<CustomerRepairActions repair={repair} latest={latest} act={act} busy={busy}/>}

    <section className="card">
      <h2>Quotation history</h2>
      {repair.quotes?.length?repair.quotes.map(q=><div className="quote" key={q.version}>
        <div className="quote-version-header">
          <span className="quote-version-title">Version {q.version}</span>
          <Badge value={q.status}/>
          <span className="quote-version-total">₹{q.total}</span>
        </div>
        <ul>{q.items.map((i,n)=><li key={n}>{i.description} × {i.quantity} — ₹{i.lineTotal}</li>)}</ul>
      </div>):<p className="empty-state">No quotations yet.</p>}
    </section>
  </>;
}
