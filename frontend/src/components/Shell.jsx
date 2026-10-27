import { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { dashboardForRole } from '../routing.js';

export default function Shell({children}){const {user,signOut}=useSession(),nav=useNavigate(),[error,setError]=useState(''),[busy,setBusy]=useState(false);async function out(){setBusy(true);setError('');try{await signOut();nav('/login',{replace:true})}catch(e){setError(e.message||'Could not sign out. Please try again.')}finally{setBusy(false)}}return <><header><Link to={dashboardForRole(user)} className="brand">RepairTrace</Link><span>{user.name} · {user.role}</span><button className="quiet" disabled={busy} onClick={out}>{busy?'Signing out…':'Log out'}</button></header>{error&&<main><p className="alert">{error}</p></main>}<main>{children}</main></>}
