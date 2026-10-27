import { createContext,useContext } from 'react';

export const SessionContext=createContext();
export const useSession=()=>useContext(SessionContext);
