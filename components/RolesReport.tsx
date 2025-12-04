import React from 'react';
import { Member, BranchType } from '../types';
import { BRANCHES, COMMON_ROLES, calculateMasonicYearString } from '../constants';
import { ShieldCheck, Printer } from 'lucide-react';

interface RolesReportProps {
  members: Member[];
  selectedYear: number;
}

export const RolesReport: React.FC<RolesReportProps> = ({ members, selectedYear }) => {
  
  // Helper to find roles for a specific branch in the selected year
  // Supports Multi-Role: A member can appear multiple times if they have multiple roles
  const getRolesForBranch = (branch: BranchType) => {
    const roleMap: { roleName: string; memberName: string; sortIndex: number }[] = [];
    
    members.forEach(member => {
      const branchData = member[branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>];
      
      // Filter for roles matching the selected year and branch
      // @ts-ignore
      const activeRoles = branchData.roles.filter(r => r.yearStart === selectedYear && r.branch === branch);
      
      activeRoles.forEach((role: any) => {
        // Find index in common roles for sorting hierarchy
        let sortIdx = COMMON_ROLES[branch].indexOf(role.roleName);
        if (sortIdx === -1) sortIdx = 999; // Custom roles go to bottom

        roleMap.push({
          roleName: role.roleName,
          memberName: `${member.lastName} ${member.firstName}`,
          sortIndex: sortIdx
        });
      });
    });

    // Sort by hierarchy
    return roleMap.sort((a, b) => a.sortIndex - b.sortIndex);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="flex justify-between items-end mb-4 print:hidden">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">Organigramma e Ruoli</h2>
          <p className="text-slate-500">Anno {selectedYear}-{selectedYear+1} - Anno Massonico {calculateMasonicYearString(selectedYear)}</p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
        >
          <Printer size={18} /> Stampa Report
        </button>
      </div>

      {/* Print Header only visible when printing */}
      <div className="hidden print:block mb-8 text-center">
          <h1 className="text-3xl font-serif font-bold">G.A.D.U.</h1>
          <h2 className="text-xl mt-2">Organigramma - Anno {selectedYear}-{selectedYear+1}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-8">
        {BRANCHES.map(branch => {
          const roles = getRolesForBranch(branch.type);
          
          return (
            <div key={branch.type} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col break-inside-avoid">
              <div className={`${branch.color} text-white p-4 flex items-center gap-3`}>
                <ShieldCheck size={24} />
                <h3 className="font-serif font-bold text-lg">{branch.label}</h3>
              </div>
              
              <div className="p-4 flex-1">
                {roles.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase">
                        <th className="pb-2 pl-2">Ufficiale</th>
                        <th className="pb-2 text-right pr-2">Fratello</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {roles.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 pl-2 font-medium text-slate-700">{item.roleName}</td>
                          <td className="py-3 text-right pr-2 font-serif text-slate-900">{item.memberName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8 italic text-sm">
                    Nessun ufficiale registrato per l'anno {selectedYear}-{selectedYear+1}.
                  </div>
                )}
              </div>
              <div className="bg-slate-50 p-2 text-center text-xs text-slate-400 border-t border-slate-100">
                {roles.length} Incarichi assegnati
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};