
import React, { useState } from 'react';
import { Member, BranchType, AppSettings } from '../types';
import { BRANCHES, isMemberActiveInYear, RITUAL_LABELS, getRolesForRitual } from '../constants';
import { dataService } from '../services/dataService';
import { UserCog, ArrowLeftRight, Lock, Unlock } from 'lucide-react';

interface RoleAssignmentProps {
  members: Member[];
  selectedYear: number;
  onUpdate: () => void;
  settings?: AppSettings;
}

export const RoleAssignment: React.FC<RoleAssignmentProps> = ({ members, selectedYear, onUpdate, settings }) => {
  const [activeBranch, setActiveBranch] = useState<BranchType>('CRAFT');
  const [loading, setLoading] = useState(false);
  const [unlockingRitual, setUnlockingRitual] = useState<BranchType | null>(null);
  const [confirmingRitualChange, setConfirmingRitualChange] = useState<{ branch: BranchType; newRitual: string } | null>(null);
  const prevYear = selectedYear - 1;

  const getRitualForYear = (year: number, branch: BranchType): string => {
    if (branch === 'RAM') return 'RAM';
    const yearlyRituals = settings?.yearlyRituals?.[year];
    if (branch === 'CRAFT') return yearlyRituals?.craft || 'Emulation';
    if (branch === 'MARK' || branch === 'CHAPTER') return yearlyRituals?.markAndArch || 'Irlandese';
    return 'Irlandese';
  };

  const currentRitual = getRitualForYear(selectedYear, activeBranch);
  const prevRitual = getRitualForYear(prevYear, activeBranch);

  const handleRitualChange = async (newRitual: string) => {
    if (!settings) return;
    setLoading(true);
    try {
      const updatedRituals = { ...settings.yearlyRituals } || {};
      if (!updatedRituals[selectedYear]) {
        updatedRituals[selectedYear] = {
          craft: getRitualForYear(selectedYear, 'CRAFT') as any,
          markAndArch: getRitualForYear(selectedYear, 'MARK') as any
        };
      }
      if (activeBranch === 'CRAFT') {
        updatedRituals[selectedYear].craft = newRitual as any;
      } else if (activeBranch === 'MARK' || activeBranch === 'CHAPTER') {
        updatedRituals[selectedYear].markAndArch = newRitual as any;
      }
      
      // Delete all roles for this branch and year
      const updatedMembers = members.map(member => {
        const branchKey = activeBranch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
        const branchData = member[branchKey];
        const filteredRoles = branchData.roles.filter((r: any) => !(r.yearStart === selectedYear && r.branch === activeBranch));
        return {
          ...member,
          [branchKey]: { ...branchData, roles: filteredRoles }
        };
      });

      // Save all members
      await Promise.all(updatedMembers.map(m => dataService.saveMember(m)));
      
      // Update settings with new ritual
      const updatedSettings = { ...settings, yearlyRituals: updatedRituals };
      await dataService.saveSettings(updatedSettings);
      
      setConfirmingRitualChange(null);
      setUnlockingRitual(null);
      await onUpdate();
    } catch (e) {
      console.error("Error changing ritual", e);
    } finally {
      setLoading(false);
    }
  };

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
  
  // Filter members: Must be active in the specific year to hold office AND have at least one degree in that branch
  const eligibleMembers = members
    .filter(m => {
        const branchLower = activeBranch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
        const branchData = m[branchLower];
        // @ts-ignore
        const isActive = isMemberActiveInYear(branchData, selectedYear);
        const hasDegree = branchData.degrees && branchData.degrees.length > 0;
        return isActive && hasDegree;
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn">
      <div className="bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-3 mb-2"><UserCog size={24} className="text-masonic-gold"/><h2 className="text-xl font-serif font-bold">Gestione Ufficiali - Anno {selectedYear}</h2></div>
        <p className="text-slate-400 text-sm">Assegna rapidamente i ruoli confrontando con l'anno precedente ({prevYear}-{prevYear+1}).</p>
      </div>
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto scrollbar-hide">
          {BRANCHES.map(b => (
            <button key={b.type} onClick={() => setActiveBranch(b.type)} className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${activeBranch === b.type ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <div className={`w-2 h-2 rounded-full ${b.color}`} /> {b.label}
            </button>
          ))}
      </div>
      
      {/* Ritual Selector */}
      {(activeBranch === 'CRAFT' || activeBranch === 'MARK' || activeBranch === 'CHAPTER') && (
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Rituale {selectedYear}-{selectedYear+1}:</span>
            <span className="px-3 py-1 bg-white border border-slate-300 rounded text-sm font-semibold text-slate-800">{currentRitual}</span>
          </div>
          
          {unlockingRitual === activeBranch ? (
            <div className="flex items-center gap-2">
              <select 
                value={currentRitual}
                onChange={(e) => setConfirmingRitualChange({ branch: activeBranch, newRitual: e.target.value })}
                disabled={loading}
                className="px-3 py-1 border border-slate-300 rounded text-sm"
              >
                {activeBranch === 'CRAFT' ? (
                  <>
                    <option value="Emulation">Emulation</option>
                    <option value="Scozzese">Scozzese</option>
                  </>
                ) : (
                  <>
                    <option value="Irlandese">Irlandese</option>
                    <option value="Aldersgate">Aldersgate</option>
                  </>
                )}
              </select>
              <button 
                onClick={() => setUnlockingRitual(null)}
                disabled={loading}
                className="px-2 py-1 bg-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-400 transition-colors"
              >
                Annulla
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setUnlockingRitual(activeBranch)}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1 bg-yellow-400 text-slate-900 rounded text-xs font-medium hover:bg-yellow-500 transition-colors"
            >
              <Unlock size={14} /> Modifica Rituale
            </button>
          )}
        </div>
      )}

      {/* Confirmation Modal for Ritual Change */}
      {confirmingRitualChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Cambio Rituale</h3>
            <p className="text-sm text-slate-700 mb-4">
              Stai per cambiare il rituale di <strong>{BRANCHES.find(b => b.type === confirmingRitualChange.branch)?.label}</strong> da <strong>{currentRitual}</strong> a <strong>{confirmingRitualChange.newRitual}</strong>.
            </p>
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-xs text-red-800 font-semibold">⚠️ ATTENZIONE</p>
              <p className="text-xs text-red-700 mt-1">
                Questo cambio cancellerà tutti i ruoli assegnati per questo ramo nell'anno {selectedYear}.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingRitualChange(null)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded font-medium hover:bg-slate-300 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => handleRitualChange(confirmingRitualChange.newRitual)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors"
              >
                {loading ? 'Salvataggio...' : 'Conferma Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-4 md:p-6 overflow-x-auto">
        {loading && <div className="text-center py-2 text-masonic-gold font-medium">Salvataggio in corso...</div>}
        <table className="w-full text-sm min-w-[600px]">
            <thead>
                <tr className="border-b-2 border-slate-100 text-left">
                    <th className="py-3 pl-2 font-serif text-slate-700 w-1/4">Ruolo / Ufficiale</th>
                    <th className="py-3 text-slate-500 w-1/4"><div className="flex items-center gap-1"><span>Riferimento Anno {prevYear}</span></div></th>
                    <th className="py-3 text-slate-500 w-1/4"><div className="flex items-center gap-1"><span>Assegnato {selectedYear}-{selectedYear+1}</span></div></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {getRolesForRitual(activeBranch, currentRitual).map((roleName) => {
                    const prevMember = getMemberForRole(prevYear, activeBranch, roleName);
                    const currentMember = getMemberForRole(selectedYear, activeBranch, roleName);
                    
                    // Determine reference column content
                    let referenceContent = null;
                    if (prevMember) {
                      referenceContent = (
                        <span className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-xs flex items-center justify-center font-bold text-slate-600 shrink-0">
                            {prevMember.firstName[0]}{prevMember.lastName[0]}
                          </div>
                          <span className="truncate">{prevMember.lastName} {prevMember.firstName}</span>
                        </span>
                      );
                    } else if (prevRitual !== currentRitual) {
                      referenceContent = <span className="text-slate-400 italic text-xs">Rituale {prevRitual} utilizzato</span>;
                    } else {
                      referenceContent = <span className="text-slate-300 italic">- Vacante -</span>;
                    }
                    
                    return (
                        <tr key={roleName} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 pl-2 font-medium text-slate-700">{roleName}</td>
                            <td className="py-3 text-slate-500">
                                {referenceContent}
                            </td>
                            <td className="py-3">
                                <select value={currentMember ? currentMember.id : ''} onChange={(e) => handleAssignment(roleName, e.target.value)} disabled={loading} className={`w-full p-2 border rounded-md text-sm outline-none transition-all ${currentMember ? 'border-green-300 bg-green-50 text-green-900 font-medium' : 'border-slate-300 bg-white text-slate-600 hover:border-masonic-gold'}`}>
                                    <option value="">-- Seleziona o Vacante --</option>
                                    {eligibleMembers.map(m => <option key={m.id} value={m.id}>{m.lastName} {m.firstName}</option>)}
                                </select>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {eligibleMembers.length === 0 && <div className="text-center p-8 text-slate-500 italic bg-slate-50 rounded-lg mt-4">Nessun fratello attivo trovato in {branchConfig?.label} per l'anno {selectedYear}.</div>}
      </div>
    </div>
  );
};
