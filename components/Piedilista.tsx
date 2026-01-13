
import React, { useState } from 'react';
import { Member, BranchType } from '../types';
import { BRANCHES, getDegreeAbbreviation, isMemberActiveInYear } from '../constants';
import { Printer, Layout, AlertTriangle, Star, Download, Link2, Crown, Users } from 'lucide-react';
import { dataService } from '../services/dataService';

interface PiedilistaProps {
  members: Member[];
  selectedYear: number;
  onMemberClick: (id: string) => void;
  lodgeName?: string;
  lodgeNumber?: string;
}

export const Piedilista: React.FC<PiedilistaProps> = ({ members, selectedYear, onMemberClick, lodgeName, lodgeNumber }) => {
  const [viewMode, setViewMode] = useState<BranchType | 'ALL'>('ALL');
  
  const sortedMembers = [...members].sort((a, b) => a.lastName.localeCompare(b.lastName));

  const getMembersForBranch = (branch: BranchType) => {
    return sortedMembers.filter(m => {
        const branchKey = branch.toLowerCase() as keyof Member;
        return isMemberActiveInYear(m[branchKey] as any, selectedYear);
    });
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `GADU - ${lodgeName || 'Loggia'} - Piedilista ${selectedYear}`;
    window.print();
    document.title = originalTitle;
  };

  const handleExportExcel = () => {
    const exportData: any[] = [];
    
    if (viewMode === 'ALL') {
      BRANCHES.forEach(branch => {
        const branchMembers = getMembersForBranch(branch.type);
        branchMembers.forEach(m => {
          const branchKey = branch.type.toLowerCase() as keyof Member;
          const branchData = m[branchKey] as any;
          const roleObj = getActiveRoleObj(m, branch.type);
          const highestDegree = branchData?.degrees?.[branchData.degrees.length - 1];
          let provenance = '';
          if(branch.type !== 'CRAFT') {
            if (branchData.isMotherLodgeMember) provenance = 'Membro Ordinario';
            else provenance = `da ${branchData.otherLodgeName || 'Altra Loggia'}`;
            if (branchData.isFounder) provenance += ' (Fondatore)';
            if (branchData.isHonorary) provenance += ' (Onorario)';
            if (branchData.isDualAppartenance) provenance += ' (Doppia Appartenenza)';
          } else { provenance = m.city; }
          
          exportData.push({
            'Ramo': branch.label,
            'Matricola': m.matricula,
            'Cognome': m.lastName,
            'Nome': m.firstName,
            'Grado': highestDegree ? getDegreeAbbreviation(highestDegree.degreeName) : '-',
            'Incarico': roleObj ? roleObj.roleName : '-',
            'Provenienza/Città': provenance,
            'Email': m.email,
            'Telefono': m.phone
          });
        });
      });
    } else {
      const branchMembers = getMembersForBranch(viewMode);
      const branch = BRANCHES.find(b => b.type === viewMode);
      const isCraft = viewMode === 'CRAFT';
      
      branchMembers.forEach(m => {
        const branchKey = viewMode.toLowerCase() as keyof Member;
        const branchData = m[branchKey] as any;
        const roleObj = getActiveRoleObj(m, viewMode);
        const highestDegree = branchData?.degrees?.[branchData.degrees.length - 1];
        let provenance = '';
        if(!isCraft) {
          if (branchData.isMotherLodgeMember) provenance = 'Membro Ordinario';
          else provenance = `da ${branchData.otherLodgeName || 'Altra Loggia'}`;
          if (branchData.isFounder) provenance += ' (Fondatore)';
          if (branchData.isHonorary) provenance += ' (Onorario)';
          if (branchData.isDualAppartenance) provenance += ' (Doppia Appartenenza)';
        } else { provenance = m.city; }
        
        exportData.push({
          'Matricola': m.matricula,
          'Cognome': m.lastName,
          'Nome': m.firstName,
          'Grado': highestDegree ? getDegreeAbbreviation(highestDegree.degreeName) : '-',
          'Incarico': roleObj ? roleObj.roleName : '-',
          'Provenienza/Città': provenance,
          'Email': m.email,
          'Telefono': m.phone
        });
      });
    }
    
    const viewLabel = viewMode === 'ALL' ? 'Tutti' : BRANCHES.find(b => b.type === viewMode)?.label || viewMode;
    dataService.exportToExcel(exportData, `GADU_${lodgeName || 'Loggia'}_Piedilista_${viewLabel}_${selectedYear}`);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const [y, m, d] = isoString.split('-');
    return `${d}/${m}/${y}`;
  }

  const getActiveRoleObj = (member: Member, branch: BranchType) => {
    const branchKey = branch.toLowerCase() as keyof Member;
    const branchData = member[branchKey];
    if (!branchData || typeof branchData !== 'object' || !('roles' in branchData)) return undefined;
    const roles = (branchData as any).roles;
    return roles.find((r: any) => r.yearStart === selectedYear && r.branch === branch);
  };

  const getRoleText = (role: any, isDuplicate: boolean) => {
    if (!role) return <span className="text-slate-300">-</span>;
    let extraInfo = '';
    if (role.startDate) extraInfo = `(dal ${formatDate(role.startDate)})`;
    else if (role.endDate) extraInfo = `(fino al ${formatDate(role.endDate)})`;

    return (
        <span className="flex flex-col">
            <span className={`font-medium flex items-center gap-2 ${isDuplicate ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                {role.roleName}
                {isDuplicate && (<span title="Ruolo duplicato"><AlertTriangle size={14} className="text-red-500" /></span>)}
            </span>
            {extraInfo && <span className="text-xs text-slate-500 italic">{extraInfo}</span>}
        </span>
    );
  };

  const renderTable = (branch: typeof BRANCHES[0]) => {
      const branchMembers = getMembersForBranch(branch.type);
      if (branchMembers.length === 0) return <div className="p-4 text-slate-400 italic">Nessun membro attivo in {branch.label}.</div>;

      const isCraft = branch.type === 'CRAFT';
      const roleFrequency: Record<string, number> = {};
      branchMembers.forEach(m => {
        const role = getActiveRoleObj(m, branch.type);
        if (role) roleFrequency[role.roleName] = (roleFrequency[role.roleName] || 0) + 1;
      });

      return (
        <div style={{ pageBreakInside: 'auto' }} className="mb-10">
            <div className={`flex items-center gap-3 border-b-2 ${branch.color.replace('bg-', 'border-')} pb-2 mb-0`} style={{ pageBreakAfter: 'avoid' }}>
                <div className={`w-4 h-4 rounded-full ${branch.color} print:border print:border-slate-800`}></div>
                <h3 className="text-xl md:text-2xl font-serif font-bold text-slate-800 uppercase tracking-wide">{branch.label}</h3>
                <span className="ml-auto text-sm font-medium bg-slate-100 px-3 py-1 rounded-full text-slate-600 whitespace-nowrap print:bg-transparent print:border print:border-slate-300">{branchMembers.length} Fratelli</span>
            </div>
            
            <div className="overflow-x-auto" style={{ pageBreakInside: 'auto' }}>
                <table className="w-full text-sm min-w-[600px] print:min-w-0">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wider text-left border-y border-slate-200 print:bg-transparent print:text-slate-700 print:border-black">
                            {isCraft && <th className="py-3 pl-4 w-20">Matr.</th>}
                            <th className="py-3 pl-2">Cognome e Nome</th>
                            <th className="py-3">Grado</th>
                            <th className="py-3">Incarico {selectedYear}-{selectedYear+1}</th>
                            <th className="py-3">{isCraft ? 'Città' : 'Provenienza'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                        {branchMembers.map(m => {
                            const roleObj = getActiveRoleObj(m, branch.type);
                            const isDuplicate = roleObj && roleFrequency[roleObj.roleName] > 1;
                            const branchKey = branch.type.toLowerCase() as keyof Member;
                            const branchData = m[branchKey] as any;
                            let provenance = '';
                            if(!isCraft) {
                                if (branchData.isMotherLodgeMember) provenance = 'Membro Ordinario';
                                else provenance = `da ${branchData.otherLodgeName || 'Altra Loggia'}`;
                                if (branchData.isFounder) provenance += ' (Fondatore)';
                                if (branchData.isDualAppartenance) provenance += ' (Doppia App.)';
                            } else { provenance = m.city; }

                            const highestDegree = branchData?.degrees?.[branchData.degrees.length - 1];

                            return (
                                <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${isDuplicate ? 'bg-red-50/50' : ''} break-inside-avoid`}>
                                    {isCraft && <td className="py-2.5 pl-4 font-mono text-slate-600">{m.matricula}</td>}
                                    <td className="py-2.5 pl-2 font-serif flex items-center gap-1">
                                        <button onClick={() => onMemberClick(m.id)} className="font-bold text-slate-800 hover:text-masonic-blue hover:underline decoration-dotted underline-offset-4 cursor-pointer text-left">
                                            {m.lastName} {m.firstName}
                                        </button>
                                        {branchData.isFounder && <Crown size={14} className="text-yellow-600 shrink-0" title="Socio Fondatore" />}
                                        {branchData.isHonorary && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" title="Onorario" />}
                                        {branchData.isDualAppartenance && <Users size={14} className="text-blue-600 shrink-0" title="Doppia Appartenenza" />}
                                    </td>
                                    <td className="py-2.5 text-slate-600">
                                        {highestDegree ? 
                                            getDegreeAbbreviation(highestDegree.degreeName) : 
                                            '-'
                                        }
                                    </td>
                                    <td className="py-2.5">{getRoleText(roleObj, !!isDuplicate)}</td>
                                    <td className="py-2.5 text-slate-500">{provenance}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      );
  };

  return (
    <div className="bg-white p-4 md:p-8 rounded-xl shadow-lg border border-slate-200 animate-fadeIn min-h-[800px] print:shadow-none print:border-none print:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6 print:hidden gap-4">
        <div><h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-800">Piedilista</h2><p className="text-slate-500 mt-1">Elenco fratelli attivi per l'anno {selectedYear}.</p></div>
        <div className="flex items-center gap-2"><button onClick={handlePrint} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-md w-full md:w-auto justify-center"><Printer size={18} /> Stampa Visualizzato</button><button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-lg hover:bg-green-600 transition-colors shadow-md w-full md:w-auto justify-center"><Download size={18} /> Esporta</button></div>
      </div>
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto mb-8 print:hidden rounded-t-lg scrollbar-hide">
          <button onClick={() => setViewMode('ALL')} className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${viewMode === 'ALL' ? 'border-slate-800 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Layout size={16} /> Tutto</button>
          {BRANCHES.map(b => (
            <button key={b.type} onClick={() => setViewMode(b.type)} className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${viewMode === b.type ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <div className={`w-2 h-2 rounded-full ${b.color}`} /> {b.label}
            </button>
          ))}
      </div>
      <div className="hidden print:block text-center mb-10">
          <h1 className="text-4xl font-serif font-bold mb-2">G.A.D.U.</h1>
          {lodgeName && <h2 className="text-2xl font-bold">{lodgeName} N. {lodgeNumber}</h2>}
          <h3 className="text-xl text-slate-600 mt-2">Piedilista Ufficiale - {viewMode === 'ALL' ? 'Tutti i Rami' : BRANCHES.find(b => b.type === viewMode)?.label}</h3>
          <p className="text-sm text-slate-600 mt-2">Anno {selectedYear}</p>
      </div>
      <div className="space-y-4 print:space-y-0">
          {viewMode === 'ALL' ? BRANCHES.map((branch, idx) => {
            const isFirstBranch = idx === 0;
            return (
              <div key={branch.type} className={isFirstBranch ? '' : 'print-page-break-before'}>
                {renderTable(branch)}
              </div>
            );
          }) : BRANCHES.filter(b => b.type === viewMode).map(branch => (
            <div key={branch.type}>
              {renderTable(branch)}
            </div>
          ))}
      </div>
    </div>
  );
};