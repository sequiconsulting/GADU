

import React from 'react';
import { OfficerRole, BranchType } from '../types';
import { calculateMasonicYearString } from '../constants';
import { ShieldCheck } from 'lucide-react';

interface RoleEditorProps {
  roles: OfficerRole[];
  branch: BranchType;
  onChange: (roles: OfficerRole[]) => void;
  branchColor: string;
  defaultYear: number;
}

export const RoleEditor: React.FC<RoleEditorProps> = ({ roles, branch, onChange, branchColor, defaultYear }) => {
  
  const handleUpdate = (id: string, field: keyof OfficerRole, value: string) => {
    const updatedRoles = roles.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    onChange(updatedRoles);
  };

  // Sort roles by year descending
  const sortedRoles = [...roles].sort((a, b) => b.yearStart - a.yearStart);

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className={`w-5 h-5 ${branchColor.replace('bg-', 'text-')}`} />
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ruoli e Incarichi</h3>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {sortedRoles.length === 0 && <p className="text-xs text-slate-400 italic">Nessun incarico assegnato.</p>}
        {sortedRoles.map((role) => (
          <div key={role.id} className={`p-3 rounded-md border ${role.yearStart === defaultYear ? 'bg-yellow-50/50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                 <div className="font-bold text-slate-800 text-xs">{role.roleName}</div>
                 <div className="text-[10px] text-slate-500">
                    Anno {role.yearStart}-{role.yearStart + 1} ({calculateMasonicYearString(role.yearStart)})
                 </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-semibold mb-0.5">Data Inizio</label>
                    <input 
                        type="date" 
                        value={role.startDate || ''} 
                        onChange={(e) => handleUpdate(role.id, 'startDate', e.target.value)}
                        className="w-full text-[10px] md:text-xs border-slate-300 rounded border p-1 h-7 bg-white focus:ring-1 focus:ring-slate-400 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-semibold mb-0.5">N. Tornata</label>
                    <input 
                        type="text" 
                        placeholder="N."
                        value={role.installationMeeting || ''} 
                        onChange={(e) => handleUpdate(role.id, 'installationMeeting', e.target.value)}
                        className="w-full text-[10px] md:text-xs border-slate-300 rounded border p-1 h-7 bg-white focus:ring-1 focus:ring-slate-400 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-semibold mb-0.5">Data Fine</label>
                    <input 
                        type="date" 
                        value={role.endDate || ''} 
                        onChange={(e) => handleUpdate(role.id, 'endDate', e.target.value)}
                        className="w-full text-[10px] md:text-xs border-slate-300 rounded border p-1 h-7 bg-white focus:ring-1 focus:ring-slate-400 outline-none"
                    />
                </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
        * L'assegnazione e rimozione dei ruoli si effettua dalla schermata "Gestione Ufficiali". Qui puoi modificare i dettagli (date e tornata).
      </div>
    </div>
  );
};