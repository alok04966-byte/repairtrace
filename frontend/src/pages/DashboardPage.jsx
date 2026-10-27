import { useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { repairs } from '../api.js';
import { dashboardForRole } from '../routing.js';
import { useSession } from '../context/SessionContext.jsx';
import Badge from '../components/Badge.jsx';
import CreateRepairForm from '../components/CreateRepairForm.jsx';

export default function DashboardPage(){
  const {user}=useSession(),nav=useNavigate(),[list,setList]=useState([]),[error,setError]=useState(''),[newOpen,setNewOpen]=useState(false);
  const home=dashboardForRole(user);
  useEffect(()=>{
    repairs.list().then(r=>setList(r.repairs)).catch(e=>setError(e.message));
  },[]);
  return <>
    <div className="title">
      <div>
        <h1>{user.role==='staff'?'Repair queue':'My repairs'}</h1>
        <p className="subtitle">{list.length} repair{list.length===1?'':'s'}</p>
      </div>
      {user.role==='staff'&&<button className="btn-create" onClick={()=>setNewOpen(!newOpen)}>
        {newOpen?'Cancel':'+ Create repair'}
      </button>}
    </div>
    {newOpen&&<CreateRepairForm onDone={r=>nav(`/repairs/${r.id}`,{state:{from:home}})}/>}
    {error&&<p className="alert">{error}</p>}
    <div className="card table table-card">
      {list.length?<div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Device</th>
              <th>Issue</th>
              <th>Status</th>
              <th className="col-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r=><tr key={r.id}>
              <td className="cell-ref">{r.repairReference}</td>
              <td className="cell-device">{r.device.brand} {r.device.model}</td>
              <td className="cell-issue">{r.reportedIssue}</td>
              <td className="cell-status"><Badge value={r.status}/></td>
              <td className="cell-action">
                <Link to={`/repairs/${r.id}`} state={{from:home}} className="btn-open">Open</Link>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>:<p className="empty-state">{error?'Repairs could not be loaded.':'No repairs yet.'}</p>}
    </div>
  </>;
}
