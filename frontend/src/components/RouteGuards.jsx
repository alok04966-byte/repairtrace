import { Navigate,useLocation } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';
import { dashboardForRole } from '../routing.js';
import Shell from './Shell.jsx';

export function HomeRedirect(){const {user,authState}=useSession();if(authState==='unauthenticated')return <Navigate to="/login" replace/>;return <Navigate to={dashboardForRole(user)||'/login'} replace/>}

export function PublicOnly({children}){const {user,authState}=useSession();return authState==='authenticated'?<Navigate to={dashboardForRole(user)||'/login'} replace/>:children}

export function RequireAuth({role,children}){const {user,authState}=useSession(),location=useLocation();if(authState!=='authenticated')return <Navigate to="/login" replace state={{from:{pathname:location.pathname,search:location.search,hash:location.hash}}}/>;if(role&&user.role!==role)return <Navigate to={dashboardForRole(user)||'/login'} replace/>;return <Shell>{children}</Shell>}
