
import React, { useState, useEffect } from 'react';
import { Member, BranchType, StatusType } from '../types';
import { BRANCHES, isMemberActiveInYear, calculateMasonicYearString } from '../constants';
import { HistoryEditor } from './HistoryEditor';
import { RoleEditor } from './RoleEditor';
import { Save, ArrowLeft, Mail, Phone, MapPin, Hash, Landmark, Crown, Users, AlertTriangle, CheckCircle2, AlertCircle, History } from 'lucide-react';
import { dataService } from '../services/dataService';

interface MemberDetailProps {
  memberId: string | 'new';
  onBack: () => void;
  onSave: () => void;
  defaultYear: number;
}

export const MemberDetail: React.FC<MemberDetailProps> = ({ memberId, onBack, onSave, defaultYear }) => {
  const [member, setMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<BranchType | 'PROFILE'>('PROFILE');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for status change modal/input
  const [changingStatusFor, setChangingStatusFor] = useState<BranchType | null>(null);
  const [statusDate, setStatusDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const load = async () => {
      if (memberId === 'new') {
        setMember(dataService.getEmptyMember());
      } else {
        const data = await dataService.getMemberById(memberId);
        if (data) setMember(data);
      }
      setIsLoading(false);
    };
    load();
  }, [memberId]);

  const validate = async (mem: Member): Promise<boolean> => {
    setError(null);
    if (!/^\d+$/.test(mem.matricula)) {
      setError("La matricola deve contenere solo numeri.");
      return false;
    }
    const allMembers = await dataService.getMembers();
    const duplicate = allMembers.find(m => m.matricula === mem.matricula && m.id !== mem.id);
    if (duplicate) {
      setError(`Matricola ${mem.matricula} già assegnata a ${duplicate.lastName} ${duplicate.firstName}.`);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (member) {
      const isValid = await validate(member);
      if (!isValid) return;
      await dataService.saveMember(member);
      onSave();
    }
  };

  const updateBranchData = (branch: BranchType, data: any) => {
    if (!member) return;
    const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
    setMember({
      ...member,
      [branchKey]: { ...member[branchKey], ...data }
    });
  };

  const handleStatusChange = (branch: BranchType, newStatus: StatusType) => {
     if (!member) return;
     const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
     const currentData = member[branchKey];
     
     // Add status event
     const newEvent = { date: statusDate, status: newStatus };
     const updatedEvents = [...currentData.statusEvents, newEvent];

     let updatedRoles = currentData.roles;

     // If Deactivating, close open roles
     if (newStatus === 'INACTIVE') {
        const inactivationYear = parseInt(statusDate.split('-')[0]);
        updatedRoles = updatedRoles.map(role => {
            // Close role if it starts in the future or current year of inactivation
            if (role.yearStart >= inactivationYear && !role.endDate) {
                return { ...role, endDate: statusDate };
            }
            return role;
        });
     }

     updateBranchData(branch, { statusEvents: updatedEvents, roles: updatedRoles });
     setChangingStatusFor(null);
  };

  const handleMotherLodgeChange = (branch: BranchType, isMotherLodge: boolean) => {
    if (!member) return;
    const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
    
    // Create a copy of member
    const updatedMember = { ...member };

    // 1. Update the specific branch provenance
    // @ts-ignore
    updatedMember[branchKey] = { ...updatedMember[branchKey], isMotherLodgeMember: isMotherLodge };

    // 2. Rule: If NOT mother lodge member -> Automaticaly deactivate Craft (Add INACTIVE event)
    if (!isMotherLodge) {
        const craftKey = 'craft';
        const craftData = updatedMember[craftKey];
        // Check if already inactive to avoid duplicate events
        const isAlreadyInactive = !isMemberActiveInYear(craftData, defaultYear);
        if (!isAlreadyInactive) {
             craftData.statusEvents.push({ date: new Date().toISOString().split('T')[0], status: 'INACTIVE', note: 'Auto-disattivazione per cambio Loggia Madre' });
        }
    }

    setMember(updatedMember);
  };

  const activateCraft = () => {
    if (!member) return;
    const today = new Date().toISOString().split('T')[0];
    setMember({
        ...member,
        craft: { 
            ...member.craft, 
            statusEvents: [...member.craft.statusEvents, { date: today, status: 'ACTIVE', note: 'Attivazione Manuale' }] 
        }
    });
  };

  const validateDegreePrerequisites = (branch: BranchType, degreeName: string): string | null => {
      if (!member) return null;

      const hasDegree = (b: BranchType, names: string[]) => {
          // @ts-ignore
          const events = member[b.toLowerCase()].degrees || [];
          return events.some((d: any) => names.includes(d.degreeName));
      };

      if (branch === 'MARK') {
          if (degreeName === 'Venerabile della Loggia del Marchio') {
              if (!hasDegree('CRAFT', ['Maestro Installato'])) {
                  return 'Requisito: Maestro Installato nel Craft.';
              }
          }
      }

      if (branch === 'CHAPTER') {
          if (degreeName === 'Compagno dell\'Arco Reale') {
              if (!hasDegree('MARK', ['Maestro del Marchio', 'Venerabile della Loggia del Marchio'])) {
                  return 'Requisito: Maestro del Marchio (o Venerabile del Marchio).';
              }
          }
          if (degreeName === 'Principale dell\'Arco Reale') {
              if (!hasDegree('CRAFT', ['Maestro Installato'])) {
                   return 'Requisito: Maestro Installato nel Craft.';
              }
          }
      }

      return null;
  };

  if (isLoading || !member) return <div className="p-8 text-center">Caricamento...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="mr-2" size={20} /> <span className="hidden sm:inline">Torna alla lista</span><span className="sm:hidden">Indietro</span>
        </button>
        <button 
          onClick={handleSave} 
          className="bg-masonic-gold hover:bg-yellow-600 text-white px-4 md:px-6 py-2 rounded-md font-semibold shadow-md flex items-center transition-colors text-sm md:text-base"
        >
          <Save className="mr-2" size={18} /> Salva
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 flex items-center gap-3 animate-pulse-once rounded-r-md">
          <AlertCircle className="text-red-500" size={24} />
          <div>
            <h3 className="text-red-800 font-bold">Impossibile Salvare</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
            <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center border-2 border-masonic-gold shrink-0">
                <span className="text-2xl font-serif font-bold">{member.firstName[0]}{member.lastName[0]}</span>
            </div>
            <div>
                <h1 className="text-xl md:text-2xl font-serif font-bold tracking-wide break-words">{member.lastName} {member.firstName}</h1>
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-slate-300 text-sm mt-1">
                    <span className="flex items-center gap-1"><Hash size={14}/> Matr. {member.matricula || 'N/A'}</span>
                    <span className="flex items-center gap-1"><MapPin size={14}/> {member.city || 'Città non spec.'}</span>
                </div>
            </div>
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('PROFILE')} className={`px-4 md:px-6 py-3 md:py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex-shrink-0 ${activeTab === 'PROFILE' ? 'border-slate-800 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Anagrafica
          </button>
          {BRANCHES.map(b => (
            <button key={b.type} onClick={() => setActiveTab(b.type)} className={`px-4 md:px-6 py-3 md:py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${activeTab === b.type ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <div className={`w-2 h-2 rounded-full ${b.color}`} /> {b.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6 min-h-[500px]">
            {activeTab === 'PROFILE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                    <div className="col-span-1 md:col-span-2"><h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Dati Personali</h3></div>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Nome</label><input type="text" value={member.firstName} onChange={e => setMember({...member, firstName: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" /></div>
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Cognome</label><input type="text" value={member.lastName} onChange={e => setMember({...member, lastName: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" /></div>
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Matricola</label><input type="text" value={member.matricula} onChange={e => setMember({...member, matricula: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" /></div>
                    </div>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Città</label><input type="text" value={member.city} onChange={e => setMember({...member, city: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" /></div>
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Email</label><input type="email" value={member.email} onChange={e => setMember({...member, email: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" /></div>
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Telefono</label><input type="tel" value={member.phone} onChange={e => setMember({...member, phone: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" /></div>
                    </div>
                </div>
            )}

            {BRANCHES.map(branch => {
                const isCraft = branch.type === 'CRAFT';
                const branchData = member[branch.type.toLowerCase() as keyof Member] as any;
                const isActiveCurrentYear = isMemberActiveInYear(branchData, defaultYear);
                const isChanging = changingStatusFor === branch.type;

                return activeTab === branch.type && (
                    <div key={branch.type} className="animate-fadeIn">
                        {/* Status Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b gap-4">
                             <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${branch.color}`}></div>
                                <div>
                                    <h2 className="text-xl font-serif font-bold text-slate-800 leading-none">Scheda {branch.label}</h2>
                                    <span className="text-xs text-slate-500 font-sans mt-1 block">Riferimento: Anno {defaultYear}-{defaultYear + 1} - A.L. {calculateMasonicYearString(defaultYear)}</span>
                                </div>
                             </div>
                             
                             <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 w-full md:w-auto justify-between md:justify-start">
                                {isChanging ? (
                                    <div className="flex flex-col sm:flex-row items-center gap-2 animate-fadeIn w-full">
                                        <input 
                                            type="date" 
                                            value={statusDate} 
                                            onChange={(e) => setStatusDate(e.target.value)}
                                            className="text-sm border border-slate-300 rounded p-1 w-full sm:w-auto"
                                        />
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button 
                                                onClick={() => handleStatusChange(branch.type, isActiveCurrentYear ? 'INACTIVE' : 'ACTIVE')}
                                                className="text-xs bg-slate-800 text-white px-2 py-1 rounded flex-1 sm:flex-none whitespace-nowrap"
                                            >
                                                Conferma {isActiveCurrentYear ? 'Disattivazione' : 'Attivazione'}
                                            </button>
                                            <button onClick={() => setChangingStatusFor(null)} className="text-xs text-slate-500 underline">Annulla</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`text-sm font-bold flex items-center gap-1 ${isActiveCurrentYear ? 'text-green-700' : 'text-red-600'}`}>
                                            {isActiveCurrentYear ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                                            {isActiveCurrentYear ? 'Attivo' : 'Non Attivo'}
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setChangingStatusFor(branch.type);
                                                setStatusDate(new Date().toISOString().split('T')[0]);
                                            }}
                                            className="text-xs border border-slate-300 px-2 py-1 rounded hover:bg-white transition-colors"
                                        >
                                            Cambia
                                        </button>
                                    </>
                                )}
                             </div>
                        </div>

                        {/* Status History */}
                        <div className="mb-6">
                            <details className="group">
                                <summary className="flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-800 w-fit">
                                    <History size={14}/> Visualizza Storico Stati
                                </summary>
                                <div className="mt-2 text-sm bg-slate-50 p-3 rounded-md border border-slate-100">
                                    {branchData.statusEvents.length === 0 && <span className="text-slate-400 italic">Nessun evento registrato.</span>}
                                    <ul className="space-y-1">
                                        {branchData.statusEvents.map((e: any, idx: number) => (
                                            <li key={idx} className="flex gap-2">
                                                <span className="font-mono text-slate-600">{e.date}</span>
                                                <span className={`font-bold ${e.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>{e.status === 'ACTIVE' ? 'ATTIVO' : 'INATTIVO'}</span>
                                                {e.note && <span className="text-slate-400 italic">- {e.note}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </details>
                        </div>

                        {!isCraft && (
                             <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Landmark size={16} /> Dettagli Appartenenza</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                    <label className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:border-slate-300 h-auto min-h-[40px] w-full">
                                        <input type="checkbox" checked={branchData.isMotherLodgeMember ?? true} onChange={(e) => handleMotherLodgeChange(branch.type, e.target.checked)} className="w-4 h-4 shrink-0" />
                                        <span className="text-sm text-slate-700 font-medium leading-tight">Appartiene alla Loggia Madre</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-md cursor-pointer hover:border-slate-300 h-auto min-h-[40px] w-full">
                                        <input type="checkbox" checked={branchData.isFounder || false} onChange={(e) => updateBranchData(branch.type, { isFounder: e.target.checked })} className="w-4 h-4 shrink-0" />
                                        <div className="flex items-center gap-2"><Crown size={14} className="text-yellow-600"/><span className="text-sm text-slate-700 font-medium">Socio Fondatore</span></div>
                                    </label>
                                    <div className={`transition-opacity ${branchData.isMotherLodgeMember !== false ? 'opacity-50 pointer-events-none' : 'opacity-100'} w-full`}>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Nome Loggia Provenienza</label>
                                        <input type="text" value={branchData.otherLodgeName || ''} onChange={e => updateBranchData(branch.type, { otherLodgeName: e.target.value })} className="w-full text-sm border border-slate-300 rounded-md p-2 h-10" disabled={branchData.isMotherLodgeMember !== false} />
                                    </div>
                                    <div className={`transition-opacity ${branchData.isMotherLodgeMember !== false ? 'opacity-50 pointer-events-none' : 'opacity-100'} w-full`}>
                                         <label className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-md cursor-pointer mt-0 h-auto min-h-[40px]">
                                            <input type="checkbox" checked={branchData.isDualMember || false} onChange={(e) => updateBranchData(branch.type, { isDualMember: e.target.checked })} className="w-4 h-4 shrink-0" disabled={branchData.isMotherLodgeMember !== false} />
                                            <div className="flex items-center gap-2"><Users size={14} className="text-slate-600"/><span className="text-sm text-slate-700 font-medium">Doppia App.</span></div>
                                        </label>
                                    </div>
                                </div>
                                {branchData.isMotherLodgeMember !== false && !isMemberActiveInYear(member.craft, defaultYear) && (
                                    <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-md flex items-start gap-3">
                                        <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <h5 className="text-sm font-bold text-yellow-800">Incongruenza</h5>
                                            <p className="text-xs text-yellow-700 mt-1 mb-2">Risulta "Appartenente alla Loggia Madre", ma la scheda Craft è segnata come <strong>Non Attiva</strong>.</p>
                                            <button onClick={activateCraft} className="text-xs bg-yellow-600 text-white px-3 py-1 rounded flex items-center gap-1 font-medium"><CheckCircle2 size={12} /> Attiva ora in Craft</button>
                                        </div>
                                    </div>
                                )}
                             </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div><HistoryEditor branchColor={branch.color} degrees={branchData.degrees} degreeOptions={branch.degreeLabels} onChange={(degrees) => updateBranchData(branch.type, { degrees })} onValidate={(deg) => validateDegreePrerequisites(branch.type, deg)} /></div>
                            <div><RoleEditor branchColor={branch.color} branch={branch.type} roles={branchData.roles} onChange={(roles) => updateBranchData(branch.type, { roles })} defaultYear={defaultYear} /></div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
    </div>
  );
};
