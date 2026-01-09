

import React from 'react';
import { OfficerRole, BranchType, AppSettings } from '../types';
import { calculateMasonicYearString } from '../constants';
import { ShieldCheck } from 'lucide-react';

interface RoleEditorProps {
  roles: OfficerRole[];
  branch: BranchType;
  onChange: (roles: OfficerRole[]) => void;
  branchColor: string;
  defaultYear: number;
  appSettings?: AppSettings;
}

export const RoleEditor: React.FC<RoleEditorProps> = ({ roles, branch, onChange, branchColor, defaultYear, appSettings }) => {
  
  const getRitualForYear = (year: number): string => {
    if (branch === 'RAM') return 'RAM';
    const yearlyRituals = appSettings?.yearlyRituals?.[year];
    if (branch === 'CRAFT') return yearlyRituals?.craft || 'Emulation';
    if (branch === 'MARK' || branch === 'ARCH') return yearlyRituals?.markAndArch || 'Irlandese';
    return 'N/A';
  };
  
  const handleUpdate = (id: string, field: keyof OfficerRole, value: string) => {
    const updatedRoles = roles.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    onChange(updatedRoles);
  };

  // Sort roles by year descending (più recente in cima)
  const sortedRoles = [...roles].sort((a, b) => b.yearStart - a.yearStart);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      {sortedRoles.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nessun incarico assegnato.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Ruolo</th>
                <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Anno Massonico</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoles.map((role) => (
                <tr 
                  key={role.id} 
                  className={`border-b border-slate-100 ${role.yearStart === defaultYear ? 'bg-yellow-50/50' : 'hover:bg-slate-50'}`}
                >
                  <td className="py-1.5 px-2">
                    <div className="text-slate-800 font-medium">{role.roleName}</div>
                    <div className="text-slate-400 text-[9px] italic">{getRitualForYear(role.yearStart)}</div>
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">{calculateMasonicYearString(role.yearStart)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-[10px] text-slate-400 italic pt-2 mt-2 border-t border-slate-100">
        * L'assegnazione e rimozione dei ruoli si effettua dalla schermata "Gestione Ufficiali".
      </div>
    </div>
  );
};