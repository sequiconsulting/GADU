
import React, { useState } from 'react';
import { Member, BranchType } from '../types';
import { BRANCHES, COMMON_ROLES, isMemberActiveInYear } from '../constants';
import { dataService } from '../services/dataService';
import { UserCog, ArrowLeftRight } from 'lucide-react';

interface RoleAssignmentProps {
  members: Member[];
  selectedYear: number;
  onUpdate: () => void;
}

export const RoleAssignment: React.FC<RoleAssignmentProps> = ({ members, selectedYear, onUpdate }) => {
  const [activeBranch, setActiveBranch] = useState<BranchType>('CRAFT');
  const [loading, setLoading] = useState(false);
  const prevYear = selectedYear - 1;

  const getMemberForRole = (year: number, branch: BranchType, roleName: string): Member | undefined => {
    return members.find(member => {
      const branchData = member[branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>];
      // @ts-ignore
      return branchData.roles.some(r => r.yearStart === year && r.roleName === roleName && r.branch === branch);
    });
  };

  const handleAssignment = async (roleName: string, memberId: string) => {
    setLoading(true);
    try {
      const currentHolder = getMemberForRole(selectedYear, activeBranch, roleName);
      if (currentHolder) {
        if (currentHolder.id === memberId) { setLoading(false); return; }
        const branchKey = activeBranch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
        const updatedRoles = currentHolder[branchKey].roles.filter(r => 
            !(r.yearStart === selectedYear && r.roleName === roleName && r.branch === activeBranch)
        );
        const updatedHolder = { ...currentHolder, [branchKey]: { ...currentHolder[branchKey], roles: updatedRoles } };
        await dataService.saveMember(updatedHolder);
      }

      if (memberId) {
        const newHolder = members.find(m => m.id === memberId);
        if (newHolder) {
            const branchKey = activeBranch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
            const newRoleEntry = { id: Date.now().toString(), yearStart: selectedYear, roleName: roleName, branch: activeBranch };
            const updatedRoles = [...newHolder[branchKey].roles, newRoleEntry];
            const updatedMember = { ...newHolder, [branchKey]: { ...newHolder[branchKey], roles: updatedRoles } };
            await dataService.saveMember(updatedMember);
        }
      }
      await onUpdate();
    } catch (e) {
      console.error("Error updating role", e);
    } finally {
      setLoading(false);
    }
  };

  const branchConfig = BRANCHES.find(b => b.type === activeBranch);
  
  // Filter members: Must be active in the specific year to hold office
  const eligibleMembers = members
    .filter(m => {
        // @ts-ignore
        return isMemberActiveInYear(m[activeBranch.toLowerCase()], selectedYear);
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn">
      <div className="bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-3 mb-2"><UserCog size={24} className="text-masonic-gold"/><h2 className="text-xl font-serif font-bold">Gestione Ufficiali - Anno {selectedYear}-{selectedYear+1}</h2></div>
        <p className="text-slate-400 text-sm">Assegna rapidamente i ruoli confrontando con l'anno precedente ({prevYear}-{prevYear+1}).</p>
      </div>
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto scrollbar-hide">
          {BRANCHES.map(b => (
            <button key={b.type} onClick={() => setActiveBranch(b.type)} className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${activeBranch === b.type ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <div className={`w-2 h-2 rounded-full ${b.color}`} /> {b.label}
            </button>
          ))}
      </div>
      <div className="p-4 md:p-6 overflow-x-auto">
        {loading && <div className="text-center py-2 text-masonic-gold font-medium">Salvataggio in corso...</div>}
        <table className="w-full text-sm min-w-[600px]">
            <thead>
                <tr className="border-b-2 border-slate-100 text-left">
                    <th className="py-3 pl-2 font-serif text-slate-700 w-1/3">Ruolo / Ufficiale</th>
                    <th className="py-3 text-slate-500 w-1/3"><div className="flex items-center gap-1"><span>Anno {prevYear}-{prevYear+1}</span><ArrowLeftRight size={14} className="text-slate-300"/></div></th>
                    <th className="py-3 font-bold text-slate-800 w-1/3">Assegnato Anno {selectedYear}-{selectedYear+1}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {COMMON_ROLES[activeBranch].map((roleName) => {
                    const prevMember = getMemberForRole(prevYear, activeBranch, roleName);
                    const currentMember = getMemberForRole(selectedYear, activeBranch, roleName);
                    return (
                        <tr key={roleName} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 pl-2 font-medium text-slate-700">{roleName}</td>
                            <td className="py-3 text-slate-500">
                                {prevMember ? (<span className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-slate-200 text-xs flex items-center justify-center font-bold text-slate-600 shrink-0">{prevMember.firstName[0]}{prevMember.lastName[0]}</div><span className="truncate">{prevMember.lastName} {prevMember.firstName}</span></span>) : (<span className="text-slate-300 italic">- Vacante -</span>)}
                            </td>
                            <td className="py-3">
                                <select value={currentMember ? currentMember.id : ''} onChange={(e) => handleAssignment(roleName, e.target.value)} className={`w-full p-2 border rounded-md text-sm outline-none transition-all ${currentMember ? 'border-green-300 bg-green-50 text-green-900 font-medium' : 'border-slate-300 bg-white text-slate-600 hover:border-masonic-gold'}`}>
                                    <option value="">-- Seleziona o Vacante --</option>
                                    {eligibleMembers.map(m => <option key={m.id} value={m.id}>{m.lastName} {m.firstName}</option>)}
                                </select>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {eligibleMembers.length === 0 && <div className="text-center p-8 text-slate-500 italic bg-slate-50 rounded-lg mt-4">Nessun fratello attivo trovato in {branchConfig?.label} per l'anno {selectedYear}-{selectedYear+1}.</div>}
      </div>
    </div>
  );
};
