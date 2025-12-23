

import React, { useState } from 'react';
import { Member, BranchType } from '../types';
import { BRANCHES, isMemberActiveInYear } from '../constants';
import { UserX, Calendar, History, Printer, Download } from 'lucide-react';
import { dataService } from '../services/dataService';

interface InactiveMembersProps {
  members: Member[];
  onMemberClick: (id: string) => void;
  selectedYear: number;
  mode: 'YEAR' | 'TOTAL';
  lodgeName?: string;
  lodgeNumber?: string;
}

export const InactiveMembers: React.FC<InactiveMembersProps> = ({ members, onMemberClick, selectedYear, mode, lodgeName, lodgeNumber }) => {
  const [activeTab, setActiveTab] = useState<BranchType>('CRAFT');

  // Filter members who are inactive based on the selected mode
  const inactiveList = members.filter(m => {
    const branchKey = activeTab.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
    const branchData = m[branchKey];
    
    // Check 1: Must have some history in this branch to be considered relevant.
    // Checks both degrees AND status events (e.g. someone marked inactive but with no degrees yet)
    // @ts-ignore
    const degrees = branchData.degrees || [];
    // @ts-ignore
    const events = branchData.statusEvents || [];
    
    const hasHistory = degrees.length > 0 || events.length > 0;
    if (!hasHistory) return false;

    // Check 2: Status Check
    if (mode === 'YEAR') {
        // Is inactive specifically in the selected year
        // @ts-ignore
        return !isMemberActiveInYear(branchData, selectedYear);
    } else {
        // mode === 'TOTAL'
        // Is currently inactive (based on the last recorded event in history)
        if (events.length === 0) return false; 
        
        // Sort events by date to find the absolute latest status
        const sortedEvents = [...events].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastEvent = sortedEvents[sortedEvents.length - 1];
        
        return lastEvent.status === 'INACTIVE';
    }
  });

  const getLastInactiveDate = (member: Member) => {
    const branchKey = activeTab.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
    // @ts-ignore
    const events = member[branchKey].statusEvents || [];
    if (events.length === 0) return null;
    
    const sortedEvents = [...events].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    
    return lastEvent.status === 'INACTIVE' ? lastEvent.date : null;
  };

  const formatDate = (isoDate: string) => {
      if(!isoDate) return '';
      const [y, m, d] = isoDate.split('-');
      return `${d}/${m}/${y}`;
  }

  const handleExportExcel = () => {
    const exportData = inactiveList.map(m => {
      const branchData = m[activeTab.toLowerCase() as keyof Member] as any;
      const inactiveEvent = [...(branchData.statusEvents || [])].reverse().find((e: any) => e.status === 'INACTIVE');
      const inactiveReason = inactiveEvent?.reason || '-';
      
      return {
        'Matricola': m.matricula,
        'Cognome': m.lastName,
        'Nome': m.firstName,
        'Ramo': activeTab,
        'Data Inattività': formatDate(getLastInactiveDate(m) || ''),
        'Motivo': inactiveReason,
        'Email': m.email,
        'Telefono': m.phone,
        'Città': m.city
      };
    });
    
    dataService.exportToExcel(exportData, `InattiveMembers_${activeTab}_${selectedYear}`);
  };

  const branchConfig = BRANCHES.find(b => b.type === activeTab);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn min-h-[500px] print:shadow-none print:border-none">
      <div className="bg-slate-800 p-6 text-white flex items-center justify-between print:hidden">
        <div>
           <div className="flex items-center gap-3 mb-1">
               {mode === 'YEAR' ? <Calendar size={24} className="text-masonic-gold" /> : <History size={24} className="text-masonic-gold" />}
               <h2 className="text-xl font-serif font-bold">
                   {mode === 'YEAR' ? `Membri Inattivi - Anno ${selectedYear}-{selectedYear+1}` : 'Archivio Storico Inattivi (Ad Oggi)'}
               </h2>
           </div>
           <p className="text-slate-400 text-sm">
               {mode === 'YEAR' 
                ? `Elenco dei fratelli non attivi nell'anno selezionato (${selectedYear}-${selectedYear+1}) ma con storico nel ramo.` 
                : `Elenco completo di tutti i fratelli attualmente inattivi (dimessi o passati all'Oriente Eterno) in via definitiva.`}
           </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2">
            <Printer size={18} /> Stampa
          </button>
          <button onClick={handleExportExcel} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2">
              <Download size={18} /> Esporta
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-10 pt-4 print-branch-header">
          <h1 className="text-3xl font-serif font-bold">G.A.D.U.</h1>
          {lodgeName && <h2 className="text-2xl font-bold mt-1">{lodgeName} N. {lodgeNumber}</h2>}
          <h3 className="text-xl mt-2 font-serif text-slate-700">
               {mode === 'YEAR' ? `Archivio Inattivi - Anno ${selectedYear}-{selectedYear+1}` : 'Archivio Storico Totale Inattivi'}
          </h3>
          <p className="text-lg font-bold mt-2 border-b border-black pb-2 inline-block">Ramo: {branchConfig?.label}</p>
      </div>

      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto print:hidden">
          {BRANCHES.map(b => (
            <button key={b.type} onClick={() => setActiveTab(b.type)} className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 ${activeTab === b.type ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <div className={`w-2 h-2 rounded-full ${b.color}`} /> {b.label}
            </button>
          ))}
      </div>
      <div className="p-6">
        {inactiveList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px] print:min-w-0">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wider text-left border-y border-slate-200 print:bg-transparent print:text-slate-700 print:border-black">
                  <th className="py-3 pl-4 w-20">Matr.</th>
                  <th className="py-3 pl-2">Cognome e Nome</th>
                  <th className="py-3">Grado</th>
                  <th className="py-3">Stato / Data</th>
                  <th className="py-3">Motivo</th>
                  <th className="py-3">Provenienza / Città</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {inactiveList.map(m => {
                  const branchData = m[activeTab.toLowerCase() as keyof Member] as any;
                  const highestDegree = branchData?.degrees?.[branchData.degrees.length - 1];
                  const inactiveDate = getLastInactiveDate(m);
                  let provenance = '';
                  if (activeTab !== 'CRAFT') {
                    if (branchData.isMotherLodgeMember) provenance = 'Membro Ordinario';
                    else provenance = `da ${branchData.otherLodgeName || 'Altra Loggia'}`;
                    if (branchData.isFounder) provenance += ' (Fondatore)';
                    if (branchData.isHonorary) provenance += ' (Onorario)';
                    if (branchData.isDualAppartenance) provenance += ' (Doppia Appartenenza)';
                  } else {
                    provenance = m.city;
                  }
                  
                  // Get the reason from the last inactive status event
                  const inactiveEvent = [...(branchData.statusEvents || [])].reverse().find((e: any) => e.status === 'INACTIVE');
                  const inactiveReason = inactiveEvent?.reason || '-';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onMemberClick(m.id)}>
                      <td className="py-2.5 pl-4 font-mono text-slate-600">{m.matricula}</td>
                      <td className="py-2.5 pl-2 font-serif">
                        <div className="font-bold text-slate-800">{m.lastName} {m.firstName}</div>
                      </td>
                      <td className="py-2.5 text-slate-600">{highestDegree ? highestDegree.degreeName : '-'}</td>
                      <td className="py-2.5 text-slate-600">{mode === 'YEAR' ? `Inattivo nel ${selectedYear}-${selectedYear+1}` : (inactiveDate ? `Inattivo dal ${formatDate(inactiveDate)}` : 'Attualmente Inattivo')}</td>
                      <td className="py-2.5">{inactiveReason}</td>
                      <td className="py-2.5 text-slate-500">{provenance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 italic">
              {mode === 'YEAR'
                ? `Nessun membro inattivo trovato per il ramo ${branchConfig?.label} nell'anno ${selectedYear}-${selectedYear+1}.`
                : `Nessun membro attualmente inattivo nel ramo ${branchConfig?.label}.`}
          </div>
        )}
      </div>
    </div>
  );
};