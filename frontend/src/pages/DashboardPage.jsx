import { useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { repairs } from '../api.js';
import { dashboardForRole } from '../routing.js';
import { useSession } from '../context/SessionContext.jsx';
import Badge from '../components/Badge.jsx';
import CreateRepairForm from '../components/CreateRepairForm.jsx';

export default function DashboardPage(){const {user}=useSession(),nav=useNavigate(),[list,setList]=useState([]),[error,setError]=useState(''),[newOpen,setNewOpen]=useState(false);const home=dashboardForRole(user);useEffect(()=>{repairs.list().then(r=>setList(r.repairs)).catch(e=>setError(e.message))},[]);return <><div className="title"><div><h1>{user.role==='staff'?'Repair queue':'My repairs'}</h1><p>{list.length} repair{list.length===1?'':'s'}</p></div>{user.role==='staff'&&<button onClick={()=>setNewOpen(!newOpen)}>Create repair</button>}</div>{newOpen&&<CreateRepairForm onDone={r=>nav(`/repairs/${r.id}`,{state:{from:home}})}/>} {error&&<p className="alert">{error}</p>}<div className="card table">{list.length?<table><thead><tr><th>Reference</th><th>Device</th><th>Issue</th><th>Status</th><th/></tr></thead><tbody>{list.map(r=><tr key={r.id}><td>{r.repairReference}</td><td>{r.device.brand} {r.device.model}</td><td>{r.reportedIssue}</td><td><Badge value={r.status}/></td><td><Link to={`/repairs/${r.id}`} state={{from:home}}>Open</Link></td></tr>)}</tbody></table>:<p>{error?'Repairs could not be loaded.':'No repairs yet.'}</p>}</div></>}
