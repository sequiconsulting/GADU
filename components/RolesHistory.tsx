import React, { useState } from 'react';
import { Member, BranchType, AppSettings } from '../types';
import { BRANCHES, calculateMasonicYearString, getRolesForRitual, CRAFT_EMULATION_ROLES, CRAFT_SCOZZESE_ROLES, MARCHIO_IRLANDESE_ROLES, MARCHIO_ALDERSGATE_ROLES, CAPITOLO_IRLANDESE_ROLES, CAPITOLO_ALDERSGATE_ROLES, RAM_ROLES } from '../constants';
import { Printer } from 'lucide-react';

interface RolesHistoryProps {
  members: Member[];
  selectedYear: number;
  appSettings: AppSettings;
}

export const RolesHistory: React.FC<RolesHistoryProps> = ({ members, selectedYear, appSettings }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const getRitualForYear = (year: number, branch: BranchType): string => {
    if (!appSettings.yearlyRituals || !appSettings.yearlyRituals[year]) {
      // Default rituals
      if (branch === 'CRAFT') return 'Emulation';
      if (branch === 'MARK') return 'Irlandese';
      if (branch === 'CHAPTER') return 'Irlandese';
      return '';
    }
    const ritual = appSettings.yearlyRituals[year];
    if (branch === 'CRAFT') return ritual.craft || 'Emulation';
    if (branch === 'MARK') return ritual.markAndArch || 'Irlandese';
    if (branch === 'CHAPTER') return ritual.markAndArch || 'Irlandese';
    return '';
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  // Get years: 4 previous years + current year
  const yearsToDisplay = [
    selectedYear - 4,
    selectedYear - 3,
    selectedYear - 2,
    selectedYear - 1,
    selectedYear
  ];

  const getMasonicYearLabel = (year: number) => {
    return `${year}-${year + 1}\n(A.L. ${calculateMasonicYearString(year)})`;
  };

  const getRolesByYear = (branch: BranchType, year: number) => {
    const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
    const rolesMap = new Map<string, string[]>();

    members.forEach(member => {
      const branchData = member[branchKey] as any;
      if (!branchData || !branchData.roles) return;

      branchData.roles
        .filter((role: any) => role.yearStart === year)
        .forEach((role: any) => {
          if (!rolesMap.has(role.roleName)) {
            rolesMap.set(role.roleName, []);
          }
          rolesMap.get(role.roleName)!.push(`${member.lastName} ${member.firstName}`);
        });
    });

    return rolesMap;
  };

  const getAllRolesForBranch = (branch: BranchType) => {
    // Use the template for the selected year's ritual
    const ritual = getRitualForYear(selectedYear, branch);
    const orderedRoles = getRolesForRitual(branch, ritual);
    
    // Return only roles in the current template
    // (Don't add "phantom" roles from database that aren't in the template)
    return orderedRoles;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif font-bold text-slate-800">Storico Ruoli</h2>
        <button
          onClick={handlePrint}
          className="bg-slate-600 hover:bg-slate-700 text-white px-4 md:px-6 py-2 rounded-md font-semibold shadow-md flex items-center transition-colors text-sm md:text-base print:hidden"
        >
          <Printer className="mr-2" size={18} /> Stampa Storico
        </button>
      </div>

      {/* Branch Tables */}
      {BRANCHES.map((branch) => {
        const branchRoles = getAllRolesForBranch(branch.type);

        return (
          <div
            key={branch.type}
            className={`${isPrinting ? 'print:page-break-before' : ''}`}
            data-print-section
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${branch.color}`}></div>
                Ramo {branch.label}
              </h3>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <colgroup>
                  <col style={{ width: '20%', minWidth: '120px' }} />
                  <col style={{ width: '16%', minWidth: '90px' }} />
                  <col style={{ width: '16%', minWidth: '90px' }} />
                  <col style={{ width: '16%', minWidth: '90px' }} />
                  <col style={{ width: '16%', minWidth: '90px' }} />
                  <col style={{ width: '16%', minWidth: '90px' }} />
                </colgroup>
                <thead className="bg-slate-100 border-b-2 border-slate-300">
                  <tr>
                    <th className="text-left px-2 py-2.5 font-semibold text-slate-700">Ruolo</th>
                    {yearsToDisplay.map((year) => (
                      <th
                        key={year}
                        className="text-center px-2 py-2.5 font-semibold text-slate-700 whitespace-pre-wrap text-[10px] leading-tight"
                      >
                        {getMasonicYearLabel(year)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {branchRoles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center px-2 py-3 text-slate-500">
                        Nessun ruolo assegnato in questo ramo
                      </td>
                    </tr>
                  ) : (
                    branchRoles.map((roleName) => (
                      <tr
                        key={`${branch.type}-${roleName}`}
                        className={`border-t border-slate-200 ${
                          branchRoles.indexOf(roleName) % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        } ${isPrinting ? 'print:page-break-inside-avoid' : ''}`}
                      >
                        <td className="text-left px-2 py-2 font-medium text-slate-800 border-r border-slate-200">
                          {roleName}
                        </td>
                        {yearsToDisplay.map((year) => {
                          const rolesMap = getRolesByYear(branch.type, year);
                          const assignees = rolesMap.get(roleName) || [];
                          return (
                            <td
                              key={year}
                              className="text-center px-2 py-2 text-slate-600 border-r border-slate-200 align-top break-words"
                            >
                              {assignees.length > 0 ? (
                                <div className="space-y-1">
                                  {assignees.map((name, i) => (
                                    <div key={i} className="text-[10px] leading-tight">
                                      {name}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
