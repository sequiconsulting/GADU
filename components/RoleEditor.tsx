
import React, { useState, useEffect } from 'react';
import { OfficerRole, BranchType } from '../types';
import { COMMON_ROLES, calculateMasonicYearString } from '../constants';
import { Plus, Trash2, ShieldCheck, Calendar } from 'lucide-react';

interface RoleEditorProps {
  roles: OfficerRole[];
  branch: BranchType;
  onChange: (roles: OfficerRole[]) => void;
  branchColor: string;
  defaultYear: number;
}

export const RoleEditor: React.FC<RoleEditorProps> = ({ roles, branch, onChange, branchColor, defaultYear }) => {
  const [newRole, setNewRole] = useState<OfficerRole>({
    id: '',
    yearStart: defaultYear,
    roleName: COMMON_ROLES[branch][0],
    branch: branch,
    startDate: '',
    endDate: ''
  });

  // Update internal state if defaultYear changes (e.g. user changes year in top bar)
  useEffect(() => {
    setNewRole(prev => ({ ...prev, yearStart: defaultYear }));
  }, [defaultYear]);

  const handleAdd = () => {
    if (newRole.roleName) {
      // Add new role allowing duplicates of year (multi-role support)
      onChange([...roles, { ...newRole, id: Date.now().toString() }]);
      // Reset logic, keeping year but clearing dates
      setNewRole(prev => ({ ...prev, startDate: '', endDate: '' }));
    }
  };

  const handleDelete = (id: string) => {
    onChange(roles.filter(r => r.id !== id));
  };

  // Sort roles by year descending
  const sortedRoles = [...roles].sort((a, b) => b.yearStart - a.yearStart);

  const formatDate = (date?: string) => {
    if (!date) return '';
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className={`w-5 h-5 ${branchColor.replace('bg-', 'text-')}`} />
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ruoli e Incarichi</h3>
      </div>
      
      {/* Existing Roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
        {sortedRoles.map((role, idx) => (
          <div key={role.id} className={`flex items-center justify-between p-3 rounded-md border ${role.yearStart === defaultYear ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex-1">
              <div className="font-bold text-slate-800 text-sm">{role.roleName}</div>
              <div className="text-xs text-slate-500">
                Anno {role.yearStart}-{role.yearStart + 1} ({calculateMasonicYearString(role.yearStart)})
              </div>
              {(role.startDate || role.endDate) && (
                <div className="text-xs text-slate-400 mt-1 italic flex gap-2">
                   {role.startDate && <span>Dal: {formatDate(role.startDate)}</span>}
                   {role.endDate && <span>Al: {formatDate(role.endDate)}</span>}
                </div>
              )}
            </div>
            <button 
              onClick={() => handleDelete(role.id)}
              className="text-slate-400 hover:text-red-500 transition-colors ml-2"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {roles.length === 0 && <p className="text-sm text-slate-400 italic md:col-span-2">Nessun incarico registrato.</p>}
      </div>

      {/* Add New Role */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end pt-4 border-t border-slate-100">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Anno</label>
          <input 
            type="number" 
            value={newRole.yearStart}
            onChange={(e) => setNewRole({...newRole, yearStart: parseInt(e.target.value)})}
            className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-2 border"
          />
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Ruolo</label>
          <div className="relative">
            <input 
                type="text" 
                list={`roles-${branch}`}
                value={newRole.roleName}
                onChange={(e) => setNewRole({...newRole, roleName: e.target.value})}
                className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-2 border"
                placeholder="Seleziona..."
            />
            <datalist id={`roles-${branch}`}>
                {COMMON_ROLES[branch].map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
        </div>
        <div className="md:col-span-3">
             <label className="block text-xs font-medium text-slate-500 mb-1">Dal (Opz.)</label>
             <input 
                type="date"
                value={newRole.startDate || ''}
                onChange={(e) => setNewRole({...newRole, startDate: e.target.value})}
                className="w-full text-sm border-slate-300 rounded-md p-2 border text-slate-600"
             />
        </div>
        <div className="md:col-span-2">
             <label className="block text-xs font-medium text-slate-500 mb-1">Al (Opz.)</label>
             <input 
                type="date"
                value={newRole.endDate || ''}
                onChange={(e) => setNewRole({...newRole, endDate: e.target.value})}
                className="w-full text-sm border-slate-300 rounded-md p-2 border text-slate-600"
             />
        </div>
        <div className="md:col-span-1">
          <button 
            onClick={handleAdd}
            className={`w-full p-2 flex justify-center items-center rounded-md text-white transition-colors bg-slate-600 hover:bg-slate-700 h-[38px]`}
            title="Aggiungi Incarico"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
