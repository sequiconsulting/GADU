
import React, { useState, useEffect } from 'react';
import { Member, BranchType, StatusType, AppSettings, CapitazioneTipo, TitoloCraftMarchio, TitoloArcoRam } from '../types';
import { BRANCHES, isMemberActiveInYear, calculateMasonicYearString, STATUS_REASONS, getDegreesByRitual, CAPITAZIONI_CRAFT, CAPITAZIONE_DEFAULT, INITIATION_TERMS } from '../constants';
import { HistoryEditor } from './HistoryEditor';
import { RoleEditor } from './RoleEditor';
import { Save, ArrowLeft, Mail, Phone, MapPin, Hash, Landmark, Crown, Users, AlertTriangle, CheckCircle2, AlertCircle, Star, X, Trash2, History, Pencil } from 'lucide-react';
import { dataService } from '../services/dataService';

const PROFILE = 'PROFILE';

interface MemberDetailProps {
  memberId: string | 'new';
  onBack: () => void;
  onSave: () => Promise<void>;
  defaultYear: number;
  appSettings: AppSettings;
  currentUserEmail?: string;
}

export const MemberDetail: React.FC<MemberDetailProps> = ({ memberId, onBack, onSave, defaultYear, appSettings, currentUserEmail }) => {
  const [member, setMember] = useState<Member | null>(null);
  const [originalMember, setOriginalMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<BranchType | 'PROFILE'>(PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changelogPage, setChangelogPage] = useState<number>(0);
  const [matriculaValidating, setMatriculaValidating] = useState(false);
  const matriculaTimeoutRef = React.useRef<NodeJS.Timeout>();

  // State for status change modal/input
  const [changingStatusFor, setChangingStatusFor] = useState<BranchType | null>(null);
  const [statusDate, setStatusDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusReason, setStatusReason] = useState<string>('');
  const [statusLodge, setStatusLodge] = useState<string>('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{branch: BranchType, isActivation: boolean} | null>(null);
  
  // State for delete confirmation
  const [deleteConfirmation, setDeleteConfirmation] = useState<{branch: BranchType, eventIndex: number} | null>(null);
  
  // State for editing status event date
  const [editingStatusEvent, setEditingStatusEvent] = useState<{branch: BranchType, eventIndex: number, newDate: string} | null>(null);

  // Helper to get ritual for a branch in a year
  const getRitualForYear = (year: number, branch: BranchType): string => {
    const yearlyRituals = appSettings.yearlyRituals?.[year];
    if (branch === 'CRAFT') return yearlyRituals?.craft || 'Emulation';
    if (branch === 'MARK' || branch === 'ARCH') return yearlyRituals?.markAndArch || 'Irlandese';
    return '';
  };

  useEffect(() => {
    const load = async () => {
      if (memberId === 'new') {
        const emptyMember = dataService.getEmptyMember();
        setMember(emptyMember);
        setOriginalMember(emptyMember);
      } else {
        const data = await dataService.getMemberById(memberId);
        if (data) {
          setMember(data);
          setOriginalMember(JSON.parse(JSON.stringify(data)));
        }
      }
      setIsLoading(false);
    };
    load();
  }, [memberId]);

  // Debounced matricula validation
  useEffect(() => {
    if (matriculaTimeoutRef.current) {
      clearTimeout(matriculaTimeoutRef.current);
    }

    if (!member || member.matricula === '' || !/^\d+$/.test(member.matricula)) {
      setMatriculaValidating(false);
      return;
    }

    setMatriculaValidating(true);
    matriculaTimeoutRef.current = setTimeout(async () => {
      try {
        const allMembers = await dataService.getMembers();
        const duplicate = allMembers.find(m => m.matricula === member.matricula && m.id !== member.id);
        if (duplicate) {
          setError(`Matricola ${member.matricula} già assegnata a ${duplicate.lastName} ${duplicate.firstName}.`);
        } else {
          setError(null);
        }
      } catch (err) {
        console.error('Matricula check error:', err);
      } finally {
        setMatriculaValidating(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (matriculaTimeoutRef.current) {
        clearTimeout(matriculaTimeoutRef.current);
      }
    };
  }, [member?.matricula]);

  const validate = async (mem: Member): Promise<boolean> => {
    setError(null);

    // 1. Matricola: deve essere vuoto oppure numerico e univoco
    if (mem.matricula !== '') {
      // Se non vuoto, deve essere numerico
      if (!/^\d+$/.test(mem.matricula)) {
        setError("La matricola deve contenere solo numeri o essere vuota.");
        return false;
      }

      // 2. Duplicate Matricula (solo se presente) - verifica finale prima del save
      const allMembers = await dataService.getMembers();
      const duplicate = allMembers.find(m => m.matricula === mem.matricula && m.id !== mem.id);
      if (duplicate) {
        setError(`Matricola ${mem.matricula} già assegnata a ${duplicate.lastName} ${duplicate.firstName}.`);
        return false;
      }
    }

    // 3. Check incompatibility between isMotherLodgeMember and isDualAppartenance
    (['craft', 'mark', 'arch', 'ram'] as const).forEach(branchKey => {
      const branchData = mem[branchKey];
      if (branchData.isMotherLodgeMember === true && branchData.isDualAppartenance === true) {
        const branchLabel = { craft: 'Craft', mark: 'Mark', arch: 'Arch', ram: 'RAM' }[branchKey];
        setError(`Incongruenza nel ramo ${branchLabel}: non è possibile essere sia "Appartiene alla Loggia Madre" che "Doppia Appartenenza". Seleziona uno solo.`);
        throw new Error('incompatibility');
      }
    });

    // 4. For non-Craft branches, if not Mother Lodge member, loggia name is required
    (['mark', 'arch', 'ram'] as const).forEach(branchKey => {
      const branchData = mem[branchKey];
      if (branchData.isMotherLodgeMember === false && (!branchData.otherLodgeName || branchData.otherLodgeName.trim() === '')) {
        const branchLabel = { mark: 'Mark', arch: 'Arch', ram: 'RAM' }[branchKey];
        setError(`Nel ramo ${branchLabel}: se non è membro della Loggia Madre, è obbligatorio specificare il nome della loggia di provenienza.`);
        throw new Error('missing-lodge-name');
      }
    });

    // 5. Check that active members have at least one degree in that branch
    (['craft', 'mark', 'arch', 'ram'] as const).forEach(branchKey => {
      const branchData = mem[branchKey];
      const hasDegrees = branchData.degrees && branchData.degrees.length > 0;
      const hasActiveEvent = branchData.statusEvents && branchData.statusEvents.some(e => e.status === 'ACTIVE');
      
      // Se ci sono eventi ACTIVE, deve esserci almeno un grado
      if (hasActiveEvent && !hasDegrees) {
        const branchLabel = { craft: 'Craft', mark: 'Mark', arch: 'Arch', ram: 'RAM' }[branchKey];
        setError(`Non è possibile salvare un membro con eventi di attivazione nel ramo ${branchLabel} senza almeno un grado massonico. Aggiungi un grado prima di salvare.`);
        throw new Error('no-degrees-while-active');
      }
    });

    return true;
  };

  const handleSave = async () => {
    if (member && originalMember) {
      try {
        const isValid = await validate(member);
        if (!isValid) return;

        // Check for conflicts: reload fresh member to compare lastModified
        // Skip conflict check for new members (id is empty string)
        if (memberId !== 'new' && member.id && member.id !== '') {
          const freshMember = await dataService.getMemberById(member.id);
          if (freshMember && freshMember.lastModified && originalMember.lastModified && 
              freshMember.lastModified !== originalMember.lastModified) {
            // Data has been modified elsewhere since we loaded it
            const confirmOverwrite = window.confirm(
              `Questo associato è stato modificato da un altro utente.\n\nVuoi sovrascrivere le modifiche e salvare comunque?`
            );
            if (!confirmOverwrite) {
              setError('Salvataggio annullato. Ricaricare la pagina per vedere le modifiche recenti.');
              return;
            }
          }
        }
      } catch (e) {
        // Validation error already set via setError
        return;
      }
      
      // Traccia le modifiche
      const changes: string[] = [];
      
      // Dati personali
      if (originalMember.firstName !== member.firstName) changes.push(`Nome: ${originalMember.firstName} → ${member.firstName}`);
      if (originalMember.lastName !== member.lastName) changes.push(`Cognome: ${originalMember.lastName} → ${member.lastName}`);
      if (originalMember.matricula !== member.matricula) changes.push(`Matricola: ${originalMember.matricula} → ${member.matricula}`);
      if (originalMember.city !== member.city) changes.push(`Città: ${originalMember.city} → ${member.city}`);
      if (originalMember.email !== member.email) changes.push(`Email: ${originalMember.email} → ${member.email}`);
      if (originalMember.phone !== member.phone) changes.push(`Telefono: ${originalMember.phone} → ${member.phone}`);
      
      // Verificare cambiamenti nei rami
      const branchNames: { [key: string]: string } = { craft: 'Craft', mark: 'Mark', arch: 'Arch', ram: 'RAM' };
      
      (['craft', 'mark', 'arch', 'ram'] as const).forEach(branchKey => {
        const origBranch = originalMember[branchKey];
        const newBranch = member[branchKey];
        const branchLabel = branchNames[branchKey];
        
        // Gradi
        if (JSON.stringify(origBranch.degrees) !== JSON.stringify(newBranch.degrees)) {
          const addedDegrees = newBranch.degrees.filter(d => !origBranch.degrees.some(od => od.degreeName === d.degreeName && od.date === d.date));
          const removedDegrees = origBranch.degrees.filter(d => !newBranch.degrees.some(nd => nd.degreeName === d.degreeName && nd.date === d.date));
          
          addedDegrees.forEach(d => changes.push(`${branchLabel}: Aggiunto grado "${d.degreeName}" (${d.date})`));
          removedDegrees.forEach(d => changes.push(`${branchLabel}: Rimosso grado "${d.degreeName}" (${d.date})`));
        }
        
        // Ruoli
        if (JSON.stringify(origBranch.roles) !== JSON.stringify(newBranch.roles)) {
          const addedRoles = newBranch.roles.filter(r => !origBranch.roles.some(or => or.id === r.id));
          const removedRoles = origBranch.roles.filter(r => !newBranch.roles.some(nr => nr.id === r.id));
          const modifiedRoles = newBranch.roles.filter(r => {
            const orig = origBranch.roles.find(or => or.id === r.id);
            return orig && JSON.stringify(orig) !== JSON.stringify(r);
          });
          
          addedRoles.forEach(r => changes.push(`${branchLabel}: Assegnato ruolo "${r.roleName}" (${r.yearStart})`));
          removedRoles.forEach(r => changes.push(`${branchLabel}: Rimosso ruolo "${r.roleName}" (${r.yearStart})`));
          modifiedRoles.forEach(r => changes.push(`${branchLabel}: Modificato ruolo "${r.roleName}" (${r.yearStart})`));
        }
        
        // Stati
        if (JSON.stringify(origBranch.statusEvents) !== JSON.stringify(newBranch.statusEvents)) {
          const addedEvents = newBranch.statusEvents.filter(e => !origBranch.statusEvents.some(oe => oe.date === e.date && oe.status === e.status));
          const removedEvents = origBranch.statusEvents.filter(e => !newBranch.statusEvents.some(ne => ne.date === e.date && ne.status === e.status));
          
          addedEvents.forEach(e => {
            const statusLabel = e.status === 'ACTIVE' ? 'Attivato' : 'Disattivato';
            const reasonLabel = e.reason ? ` - ${e.reason}` : '';
            const lodgeLabel = e.lodge ? ` [${e.lodge}]` : '';
            changes.push(`${branchLabel}: ${statusLabel} (${e.date})${reasonLabel}${lodgeLabel}`);
          });
          
          removedEvents.forEach(e => {
            const statusLabel = e.status === 'ACTIVE' ? 'Attivazione' : 'Disattivazione';
            const reasonLabel = e.reason ? ` - ${e.reason}` : '';
            const lodgeLabel = e.lodge ? ` [${e.lodge}]` : '';
            changes.push(`${branchLabel}: Rimosso evento di ${statusLabel} (${e.date})${reasonLabel}${lodgeLabel}`);
          });
        }
        
        // Dati di appartenenza
        if (origBranch.isMotherLodgeMember !== newBranch.isMotherLodgeMember) 
          changes.push(`${branchLabel}: Loggia Madre: ${origBranch.isMotherLodgeMember} → ${newBranch.isMotherLodgeMember}`);
        if (origBranch.isFounder !== newBranch.isFounder) 
          changes.push(`${branchLabel}: Socio Fondatore: ${origBranch.isFounder} → ${newBranch.isFounder}`);
        if (origBranch.isHonorary !== newBranch.isHonorary) 
          changes.push(`${branchLabel}: Onorario: ${origBranch.isHonorary} → ${newBranch.isHonorary}`);
        if (origBranch.isDualAppartenance !== newBranch.isDualAppartenance) 
          changes.push(`${branchLabel}: Doppia Appartenenza: ${origBranch.isDualAppartenance} → ${newBranch.isDualAppartenance}`);
        if (origBranch.otherLodgeName !== newBranch.otherLodgeName) 
          changes.push(`${branchLabel}: Loggia Provenienza: ${origBranch.otherLodgeName} → ${newBranch.otherLodgeName}`);
        if (origBranch.initiationDate !== newBranch.initiationDate) 
          changes.push(`${branchLabel}: Data Iniziazione: ${origBranch.initiationDate} → ${newBranch.initiationDate}`);
      });
      
      if (changes.length > 0) {
        const timestamp = new Date().toISOString();
        const description = changes.join('; ');
        const descriptionWithEmail = currentUserEmail ? `[${currentUserEmail}] ${description}` : description;
        
        if (!member.changelog) {
          member.changelog = [];
        }
        
        member.changelog.push({
          timestamp,
          action: descriptionWithEmail
        });
      }
      
      try {
        setIsSaving(true);  // Show loading feedback (issue #25)
        await dataService.saveMember(member);
        // Aggiorna il membro originale per futture comparazioni
        setOriginalMember(JSON.parse(JSON.stringify(member)));
        // Resetta la pagina del changelog
        setChangelogPage(0);
        await onSave();
      } catch (err: any) {
        // Rollback UI state on error (issue #21)
        setError(err.message || 'Errore durante il salvataggio');
        console.error('[MemberDetail] Save failed:', err);
      } finally {
        setIsSaving(false);  // Hide loading feedback
      }
    }
  };

  const updateBranchData = (branch: BranchType, data: any) => {
    if (!member) return;
    const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
    const currentBranchData = member[branchKey];
    
    // Auto-aggiungi evento ACTIVE quando viene aggiunto il primo grado
    if (data.degrees) {
      const hadNoDegrees = currentBranchData.degrees.length === 0;
      const willHaveDegrees = data.degrees.length > 0;
      const hasNoActiveEvent = !currentBranchData.statusEvents.some(e => e.status === 'ACTIVE');
      
      // Se prima non c'erano gradi, ora ce ne sono, e non c'è un evento ACTIVE, aggiungilo
      if (hadNoDegrees && willHaveDegrees && hasNoActiveEvent) {
        // Ordina i gradi per data e prendi il primo
        const sortedDegrees = [...data.degrees].sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });
        const firstDegreeDate = sortedDegrees[0]?.date || new Date().toISOString().split('T')[0];
        
        const autoEvent = {
          date: firstDegreeDate,
          status: 'ACTIVE' as const,
          reason: INITIATION_TERMS[branch]
        };
        
        // Aggiungi anche l'evento ACTIVE insieme ai gradi
        data = {
          ...data,
          statusEvents: [...currentBranchData.statusEvents, autoEvent]
        };
      }
    }
    
    setMember({
      ...member,
      [branchKey]: { ...member[branchKey], ...data }
    });
  };

  const handleStatusChange = (branch: BranchType, newStatus: StatusType) => {
     if (!member) return;
      const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
     const currentData = member[branchKey];

     // Add status event with reason and lodge (if applicable)
     const newEvent: any = { date: statusDate, status: newStatus, reason: statusReason };
     if (statusLodge && (statusReason === 'Trasferimento Italia' || statusReason === 'Trasferimento Estero')) {
       newEvent.lodge = statusLodge;
     }
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
     setPendingStatusChange(null);
     setStatusReason('');
     setStatusLodge('');
  };

  const handleProvenanceChange = (branch: BranchType, provenance: 'mother' | 'dual' | 'other') => {
    if (!member) return;
    const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;

    const updatedMember = { ...member };

    if (provenance === 'mother') {
      updatedMember[branchKey] = { 
        ...updatedMember[branchKey], 
        isMotherLodgeMember: true,
        isDualAppartenance: false
      };
    } else if (provenance === 'dual') {
      updatedMember[branchKey] = { 
        ...updatedMember[branchKey], 
        isMotherLodgeMember: false,
        isDualAppartenance: true
      };
    } else if (provenance === 'other') {
      // Membro effettivo da altra loggia: no mother lodge, no dual membership
      updatedMember[branchKey] = { 
        ...updatedMember[branchKey], 
        isMotherLodgeMember: false,
        isDualAppartenance: false
      };
    }

    setMember(updatedMember);
  };

  const handleDeleteStatusEvent = (branch: BranchType, eventIndex: number) => {
    if (!member) return;
    
    // Se non c'è già una conferma attiva, mostra il prompt
    if (!deleteConfirmation || deleteConfirmation.branch !== branch || deleteConfirmation.eventIndex !== eventIndex) {
      setDeleteConfirmation({ branch, eventIndex });
      return;
    }
    
    // Conferma ricevuta, procedi con la cancellazione
    const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
    const currentData = member[branchKey];
    
    const updatedEvents = currentData.statusEvents.filter((_, idx) => idx !== eventIndex);
    updateBranchData(branch, { statusEvents: updatedEvents });
    setDeleteConfirmation(null);
  };

  const handleEditStatusEventDate = (branch: BranchType, eventIndex: number) => {
    if (!member) return;
    const branchKey = branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
    const currentData = member[branchKey];
    const event = currentData.statusEvents[eventIndex];
    
    setEditingStatusEvent({ branch, eventIndex, newDate: event.date });
  };

  const handleSaveStatusEventDate = () => {
    if (!member || !editingStatusEvent) return;
    const branchKey = editingStatusEvent.branch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
    const currentData = member[branchKey];
    
    const updatedEvents = currentData.statusEvents.map((evt, idx) => 
      idx === editingStatusEvent.eventIndex 
        ? { ...evt, date: editingStatusEvent.newDate }
        : evt
    );
    
    updateBranchData(editingStatusEvent.branch, { statusEvents: updatedEvents });
    setEditingStatusEvent(null);
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

      const hasDegree = (b: BranchType, degreeNameToFind: string) => {
          const branchData = member[b.toLowerCase() as keyof Member] as any;
          if (!branchData || !branchData.degrees) return false;
          return branchData.degrees.some((d: any) => d.degreeName === degreeNameToFind);
      };

      // New Prerequisite Logic
      const prerequisites: { [key: string]: { req: { branch: BranchType, name: string }[], message: string } } = {
          'Uomo del Marchio': { req: [{ branch: 'CRAFT', name: 'Compagno di Mestiere' }], message: 'Requisito: Compagno di Mestiere (Craft)' },
          'Maestro del Marchio': { req: [{ branch: 'CRAFT', name: 'Maestro Muratore' }, { branch: 'MARK', name: 'Uomo del Marchio' }], message: 'Requisiti: Maestro Muratore (Craft) e Uomo del Marchio (Mark)' },
          'Maestro Installato del Marchio': { req: [{ branch: 'CRAFT', name: 'Maestro Installato' }, { branch: 'MARK', name: 'Maestro del Marchio' }], message: 'Requisiti: Maestro Installato (Craft) e Maestro del Marchio (Mark)' },
          "Compagno dell'Arco Reale": { req: [{ branch: 'MARK', name: 'Maestro del Marchio' }], message: 'Requisito: Maestro del Marchio (Mark)' },
            "Principale dell'Arco Reale": { req: [{ branch: 'CRAFT', name: 'Maestro Installato' }, { branch: 'ARCH', name: "Compagno dell'Arco Reale" }], message: "Requisiti: Maestro Installato (Craft) e Compagno dell'Arco Reale (Arch)" },
          "Marinaio dell'Arca Reale": { req: [{ branch: 'CRAFT', name: 'Maestro Muratore' }], message: 'Requisito: Maestro Muratore (Craft)' },
          "Comandante del RAM": { req: [{ branch: 'CRAFT', name: 'Maestro Installato' }, { branch: 'RAM', name: "Marinaio dell'Arca Reale" }], message: "Requisiti: Maestro Installato (Craft) e Marinaio dell'Arca Reale (RAM)" },
      };

      if (prerequisites[degreeName]) {
          const { req, message } = prerequisites[degreeName];
          const allPrerequisitesMet = req.every(r => hasDegree(r.branch, r.name));
          if (!allPrerequisitesMet) {
              return message;
          }
      }

      // Default intra-branch progression (e.g., AA -> CdM)
      const branchDegrees = getDegreesByRitual(branch, getRitualForYear(defaultYear, branch));
      const degreeInfo = branchDegrees.find(d => d.name === degreeName);
      if (!degreeInfo) return null;

      const degreeIndex = branchDegrees.indexOf(degreeInfo);
      if (degreeIndex > 0) {
          const prerequisite = branchDegrees[degreeIndex - 1];
          // Check if there isnt a more specific rule already defined
          if (!prerequisites[degreeName] && !hasDegree(branch, prerequisite.name)) {
              return `Requisito: ${prerequisite.name}`;
          }
      }

      return null;
  };
  const formatIsoDateOrNd = (iso: string | undefined | null): string => {
    if (!iso) return 'n.d.';
    const s = iso.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'n.d.';
    const [year, month, day] = s.split('-');
    return `${day}/${month}/${year}`;
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
          disabled={isSaving}
          className="bg-masonic-gold hover:bg-yellow-600 text-white px-4 md:px-6 py-2 rounded-md font-semibold shadow-md flex items-center transition-colors text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="mr-2" size={18} /> {isSaving ? 'Salvataggio...' : 'Salva'}
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
          <button onClick={() => setActiveTab(PROFILE)} className={`px-4 md:px-6 py-3 md:py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex-shrink-0 ${activeTab === PROFILE ? 'border-slate-800 text-slate-900 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Anagrafica
          </button>
          {BRANCHES.map(b => (
            <button key={b.type} onClick={() => setActiveTab(b.type)} className={`px-4 md:px-6 py-3 md:py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${activeTab === b.type ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <div className={`w-2 h-2 rounded-full ${b.color}`} /> {b.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6 min-h-[500px]">
            {activeTab === PROFILE && (
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
                    
                    {/* Changelog Table */}
                    {member.changelog && member.changelog.length > 0 && (
                        <div className="col-span-1 md:col-span-2 mt-6 pt-4 border-t border-slate-200">
                            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Log Modifiche</h4>
                            <div className="overflow-x-auto border border-slate-200 rounded-md bg-slate-50">
                                <table className="w-full text-[10px] leading-tight">
                                    <thead className="bg-slate-200">
                                        <tr>
                                            <th className="text-left px-2 py-1 font-semibold text-slate-700 w-32">Timestamp UTC</th>
                                        <th className="text-left px-2 py-1 font-semibold text-slate-700">Azione</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const sorted = [...member.changelog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                                            const start = changelogPage * 5;
                                            const end = start + 5;
                                            const pageItems = sorted.slice(start, end);
                                            return pageItems.map((entry, idx) => (
                                                <tr key={idx} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
                                                    <td className="px-2 py-1 text-slate-600 font-mono whitespace-nowrap">{entry.timestamp}</td>
                                                <td className="px-2 py-1 text-slate-700">{entry.action}</td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                            {member.changelog.length > 5 && (
                                <div className="flex justify-between items-center mt-2 text-[10px] text-slate-600">
                                    <button 
                                        onClick={() => setChangelogPage(p => Math.max(0, p - 1))}
                                        disabled={changelogPage === 0}
                                        className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
                                    >
                                        ← Precedente
                                    </button>
                                    <span>Pagina {changelogPage + 1} di {Math.ceil(member.changelog.length / 5)}</span>
                                    <button 
                                        onClick={() => setChangelogPage(p => p + 1)}
                                        disabled={(changelogPage + 1) * 5 >= member.changelog.length}
                                        className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
                                    >
                                        Successivo →
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {BRANCHES.map(branch => {
                const isCraft = branch.type === 'CRAFT';
                const branchData = member[branch.type.toLowerCase() as keyof Member] as any;
                const isActiveCurrentYear = isMemberActiveInYear(branchData, defaultYear);

                return activeTab === branch.type && (
                    <div key={branch.type} className="animate-fadeIn">
                        {/* Status Header */}
                        <div className="flex flex-col mb-6 pb-4 border-b gap-3">
                             <div className="flex items-start gap-3">
                                <div className={`w-3 h-3 rounded-full ${branch.color} shrink-0 mt-1`}></div>
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                        <h2 className="text-xl font-serif font-bold text-slate-800 leading-none">Scheda {branch.label}</h2>
                                        <span className="text-xs text-slate-500 font-sans">Anno {defaultYear}</span>
                                    </div>
                                </div>
                             </div>

                             {/* Checkbox e Loggia su una riga */}
                             <div className="flex items-center gap-2 flex-wrap">
                                <label className="flex items-center gap-1.5 p-1.5 bg-yellow-50 border border-yellow-200 rounded cursor-pointer hover:bg-yellow-100/50">
                                    <input type="checkbox" checked={branchData.isFounder || false} onChange={(e) => updateBranchData(branch.type, { isFounder: e.target.checked })} className="w-3 h-3 shrink-0" />
                                    <Crown size={13} className="text-yellow-600"/>
                                    <span className="text-xs text-slate-700 font-medium">Fondatore</span>
                                </label>
                                <label className="flex items-center gap-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded cursor-pointer hover:bg-amber-100/50">
                                    <input type="checkbox" checked={branchData.isHonorary || false} onChange={(e) => updateBranchData(branch.type, { isHonorary: e.target.checked })} className="w-3 h-3 shrink-0" />
                                    <Star size={13} className="text-amber-500 fill-amber-500"/>
                                    <span className="text-xs text-slate-700 font-medium">Onorario</span>
                                </label>
                                <label className="flex items-center gap-1.5 p-1.5 bg-stone-50 border border-stone-300 rounded cursor-pointer hover:bg-stone-100/50">
                                  <input type="checkbox" checked={branchData.isMotherLodgeMember ?? true} onChange={(e) => handleProvenanceChange(branch.type, e.target.checked ? 'mother' : 'other')} className="w-3 h-3 shrink-0" />
                                  <Landmark size={13} className="text-stone-700"/>
                                  <span className="text-xs text-slate-700 font-medium">Loggia Madre</span>
                                </label>
                                <label className="flex items-center gap-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded cursor-pointer hover:bg-blue-100/50">
                                    <input type="checkbox" checked={branchData.isDualAppartenance || false} onChange={(e) => handleProvenanceChange(branch.type, e.target.checked ? 'dual' : 'mother')} className="w-3 h-3 shrink-0" />
                                    <Users size={13} className="text-blue-600"/>
                                    <span className="text-xs text-slate-700 font-medium">Doppia App.</span>
                                </label>
                                <div className={`flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded ${branchData.isMotherLodgeMember === false ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                  <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Loggia:</label>
                                  <input type="text" placeholder="Nome" value={branchData.otherLodgeName || ''} onChange={e => updateBranchData(branch.type, { otherLodgeName: e.target.value })} className="border border-slate-300 rounded px-2 py-1 w-32 text-xs" disabled={branchData.isMotherLodgeMember === true} />
                                </div>
                             </div>

                             {/* Titolo, Capitazione e Stato */}
                             <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  {/* Titolo Dropdown */}
                                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 w-auto">
                                    <label className="text-xs font-medium text-slate-700 block mb-1">Titolo</label>
                                    {(() => {
                                      // Determina se il membro ha il grado che abilita il titolo speciale
                                      let hasSpecialDegree = false;
                                      let defaultTitolo: TitoloCraftMarchio | TitoloArcoRam = 'Fr.';
                                      let specialTitolo: TitoloCraftMarchio | TitoloArcoRam = 'Ven. Fr.';
                                      
                                      if (branch.type === 'CRAFT') {
                                        // Craft: MI (Maestro Installato) -> Ven. Fr. / Ven.mo Fr.
                                        hasSpecialDegree = branchData.degrees?.some(d => d.degreeName === 'Maestro Installato') || false;
                                        defaultTitolo = 'Fr.';
                                        specialTitolo = 'Ven. Fr.';
                                      } else if (branch.type === 'MARK') {
                                        // Mark: MIM (Maestro Installato del Marchio) -> MVM Fr.
                                        hasSpecialDegree = branchData.degrees?.some(d => d.degreeName === 'Maestro Installato del Marchio') || false;
                                        defaultTitolo = 'Fr.';
                                        specialTitolo = 'MVM Fr.';
                                      } else if (branch.type === 'ARCH') {
                                        // Arch: Principale dell'Arco Reale -> Ecc. Comp. / Ecc.mo Comp.
                                        hasSpecialDegree = branchData.degrees?.some(d => d.degreeName === "Principale dell'Arco Reale") || false;
                                        defaultTitolo = 'Comp.';
                                        specialTitolo = 'Ecc. Comp.';
                                      } else if (branch.type === 'RAM') {
                                        // RAM: Comandante del RAM -> Ecc. Comp. / Ecc.mo Comp.
                                        hasSpecialDegree = branchData.degrees?.some(d => d.degreeName === 'Comandante del RAM') || false;
                                        defaultTitolo = 'Comp.';
                                        specialTitolo = 'Ecc. Comp.';
                                      }
                                      
                                      const currentTitolo = branchData.titoli?.find(t => t.year === defaultYear);
                                      const titoloValue = currentTitolo?.titolo || (hasSpecialDegree ? specialTitolo : defaultTitolo);
                                      
                                      if (!hasSpecialDegree) {
                                        return (
                                          <div className="w-40 px-2 py-1 border border-slate-300 rounded text-xs text-slate-600 bg-slate-100">
                                            {titoloValue}
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <select
                                          value={titoloValue}
                                          onChange={(e) => {
                                            const newTitoli = [...(branchData.titoli || [])];
                                            const existingIndex = newTitoli.findIndex(t => t.year === defaultYear);
                                            const newValue = e.target.value as TitoloCraftMarchio | TitoloArcoRam;
                                            if (existingIndex >= 0) {
                                              newTitoli[existingIndex] = { year: defaultYear, titolo: newValue };
                                            } else {
                                              newTitoli.push({ year: defaultYear, titolo: newValue });
                                            }
                                            updateBranchData(branch.type, { titoli: newTitoli });
                                          }}
                                          className="w-40 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:ring-2 focus:ring-masonic-gold focus:border-transparent"
                                        >
                                          {branch.type === 'CRAFT' ? (
                                            <>
                                              <option value="Ven. Fr.">Ven. Fr.</option>
                                              <option value="Ven.mo Fr.">Ven.mo Fr.</option>
                                            </>
                                          ) : branch.type === 'MARK' ? (
                                            <>
                                              <option value="MVM Fr.">MVM Fr.</option>
                                            </>
                                          ) : (
                                            <>
                                              <option value="Ecc. Comp.">Ecc. Comp.</option>
                                              <option value="Ecc.mo Comp.">Ecc.mo Comp.</option>
                                            </>
                                          )}
                                        </select>
                                      );
                                    })()}
                                  </div>

                                  {/* Capitazione Dropdown */}
                                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 w-auto">
                                    <label className="text-xs font-medium text-slate-700 block mb-1">Capitazione</label>
                                    <select
                                      value={(() => {
                                        const capitazione = branchData.capitazioni?.find(c => c.year === defaultYear);
                                        return capitazione?.tipo || CAPITAZIONE_DEFAULT;
                                      })()}
                                      onChange={(e) => {
                                        const newCapitazioni = [...(branchData.capitazioni || [])];
                                        const existingIndex = newCapitazioni.findIndex(c => c.year === defaultYear);
                                        if (existingIndex >= 0) {
                                          newCapitazioni[existingIndex] = { year: defaultYear, tipo: e.target.value as CapitazioneTipo };
                                        } else {
                                          newCapitazioni.push({ year: defaultYear, tipo: e.target.value as CapitazioneTipo });
                                        }
                                        updateBranchData(branch.type, { capitazioni: newCapitazioni });
                                      }}
                                      className="w-40 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800 focus:ring-2 focus:ring-masonic-gold focus:border-transparent"
                                    >
                                      {CAPITAZIONI_CRAFT.map(cap => (
                                        <option key={cap.tipo} value={cap.tipo}>{cap.tipo}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Stato di attivazione */}
                                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 w-auto justify-between md:justify-start flex-col md:flex-row shrink-0">
                                  <div>
                                    <div className={`text-sm font-bold flex items-center gap-1 ${isActiveCurrentYear ? 'text-green-700' : 'text-red-600'}`}>
                                        {isActiveCurrentYear ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
                                        {isActiveCurrentYear ? 'Attivo' : 'Non Attivo'}
                                    </div>
                                    {branchData.statusEvents && branchData.statusEvents.length > 0 && (() => {
                                      const lastEvent = [...branchData.statusEvents].reverse()[0];
                                      const formattedDate = formatIsoDateOrNd(lastEvent.date);
                                      return (
                                        <div className="text-xs text-slate-500 mt-1">
                                          {lastEvent.reason && <span className="font-medium">{lastEvent.reason}</span>}
                                          {lastEvent.reason && <span> - </span>}
                                          <span>{formattedDate}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <button
                                      onClick={() => {
                                          setChangingStatusFor(branch.type);
                                          setPendingStatusChange({branch: branch.type, isActivation: !isActiveCurrentYear});
                                          const todayString = new Date().toISOString().split('T')[0];
                                          const [_, month, day] = todayString.split('-');
                                          setStatusDate(`${defaultYear}-${month}-${day}`);
                                          setStatusReason('');
                                          setStatusLodge('');
                                      }}
                                      className="text-xs border border-slate-300 px-2 py-1 rounded hover:bg-white transition-colors"
                                  >
                                      Cambia
                                  </button>
                                </div>
                             </div>
                        </div>

                        {!isCraft && (
                          <>
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
                                {branchData.isMotherLodgeMember === true && branchData.isDualAppartenance === true && (
                                    <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-r-md flex items-start gap-3">
                                        <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <h5 className="text-sm font-bold text-red-800">Errore di Incompatibilità</h5>
                                            <p className="text-xs text-red-700 mt-1">Non è possibile essere sia "Appartiene alla Loggia Madre" che "Doppia Appartenenza". Selezionane uno solo.</p>
                                        </div>
                                    </div>
                                )}
                          </>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Carriera Massonica */}
                            <div className="flex flex-col">
                              <h3 className="text-base font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">Carriera Massonica</h3>
                              <HistoryEditor branchColor={branch.color} degrees={branchData.degrees} degreeOptions={getDegreesByRitual(branch.type, getRitualForYear(defaultYear, branch.type))} onChange={(degrees) => updateBranchData(branch.type, { degrees })} onValidate={(deg) => validateDegreePrerequisites(branch.type, deg)} />
                            </div>

                            {/* Ruoli e Incarichi */}
                            <div className="flex flex-col">
                              <h3 className="text-base font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">Ruoli e Incarichi</h3>
                              <RoleEditor branchColor={branch.color} branch={branch.type} roles={branchData.roles} onChange={(roles) => updateBranchData(branch.type, { roles })} defaultYear={defaultYear} appSettings={appSettings} />
                            </div>

                            {/* Attivazioni/Disattivazioni */}
                            <div className="flex flex-col">
                              <h3 className="text-base font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">Stato di Attivazione</h3>
                              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
                                <table className="w-full text-xs border border-slate-200 rounded table-fixed">
                                  <colgroup>
                                    <col style={{width: '65px'}} />
                                    <col style={{width: '65px'}} />
                                    <col style={{width: '80px'}} />
                                    <col style={{width: '50px'}} />
                                  </colgroup>
                                  <thead className="bg-slate-100">
                                    <tr>
                                      <th className="text-left px-1.5 py-1.5 font-semibold text-slate-700">Data</th>
                                      <th className="text-left px-1.5 py-1.5 font-semibold text-slate-700">Stato</th>
                                      <th className="text-left px-1.5 py-1.5 font-semibold text-slate-700">Motivo</th>
                                      <th className="text-center px-1 py-1.5"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[...branchData.statusEvents]
                                      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                                      .map((event, idx) => {
                                        const originalIdx = branchData.statusEvents.findIndex(e => e === event);
                                        const formattedDate = formatIsoDateOrNd(event.date);
                                        const isConfirming = deleteConfirmation?.branch === branch.type && deleteConfirmation?.eventIndex === originalIdx;
                                        return (
                                          <React.Fragment key={originalIdx}>
                                            <tr className="border-t border-slate-200 hover:bg-slate-50">
                                              <td className="px-1.5 py-1.5 text-slate-600 whitespace-nowrap align-top text-[11px]">
                                                {editingStatusEvent?.branch === branch.type && editingStatusEvent?.eventIndex === originalIdx ? (
                                                  <input
                                                    type="date"
                                                    value={editingStatusEvent.newDate}
                                                    onChange={(e) => setEditingStatusEvent({ ...editingStatusEvent, newDate: e.target.value })}
                                                    className="px-1 py-0.5 border border-slate-300 rounded text-[11px] w-28"
                                                    autoFocus
                                                  />
                                                ) : (
                                                  formattedDate
                                                )}
                                              </td>
                                              <td className="px-1.5 py-1.5 align-top">
                                                <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium ${event.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                  {event.status === 'ACTIVE' ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
                                                  {event.status === 'ACTIVE' ? 'Att.' : 'Inatt.'}
                                                </span>
                                              </td>
                                              <td className="px-1.5 py-1.5 text-slate-700 align-top text-[11px]">
                                                {event.reason || '—'}
                                              </td>
                                              <td className="px-1 py-1.5 text-center align-top">
                                                {editingStatusEvent?.branch === branch.type && editingStatusEvent?.eventIndex === originalIdx ? (
                                                  <div className="flex gap-0.5 justify-center">
                                                    <button
                                                      onClick={handleSaveStatusEventDate}
                                                      className="bg-green-500 hover:bg-green-600 text-white px-1.5 py-0.5 rounded text-[9px] font-medium"
                                                      title="Salva"
                                                    >
                                                      ✓
                                                    </button>
                                                    <button
                                                      onClick={() => setEditingStatusEvent(null)}
                                                      className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-medium"
                                                      title="Annulla"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                ) : isConfirming ? (
                                                  <div className="flex flex-col gap-0.5">
                                                    <div className="text-[9px] text-slate-600 font-semibold">Sicuro?</div>
                                                    <div className="flex gap-0.5 justify-center">
                                                      <button
                                                        onClick={() => handleDeleteStatusEvent(branch.type, originalIdx)}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px] font-medium"
                                                      >
                                                        Sì
                                                      </button>
                                                      <button
                                                        onClick={() => setDeleteConfirmation(null)}
                                                        className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-medium"
                                                      >
                                                        No
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="flex gap-0.5 justify-center">
                                                    <button
                                                      onClick={() => handleEditStatusEventDate(branch.type, originalIdx)}
                                                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-0.5 rounded transition-colors"
                                                      title="Modifica data"
                                                    >
                                                      <Pencil size={11} />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteStatusEvent(branch.type, originalIdx)}
                                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-0.5 rounded transition-colors"
                                                      title="Elimina evento"
                                                    >
                                                      <Trash2 size={13} />
                                                    </button>
                                                  </div>
                                                )}
                                              </td>
                                            </tr>
                                            {event.lodge && (
                                              <tr className="border-t border-slate-100">
                                                <td colSpan={4} className="px-1.5 py-1 text-right text-[10px] text-slate-500 bg-slate-50">
                                                  <Landmark size={9} className="inline mr-1" />
                                                  {event.lodge}
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    {branchData.statusEvents.length === 0 && (
                                      <tr>
                                        <td colSpan={4} className="px-2 py-4 text-center text-slate-400 text-xs">
                                          Nessun evento registrato
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>

      {/* Status Change Modal */}
      {pendingStatusChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-fadeIn">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {pendingStatusChange.isActivation ? 'Attivazione' : 'Disattivazione'} - {BRANCHES.find(b => b.type === pendingStatusChange.branch)?.label}
              </h3>
              <button
                onClick={() => {
                  setPendingStatusChange(null);
                  setChangingStatusFor(null);
                  setStatusReason('');
                  setStatusLodge('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Year display at top */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Anno Solare</label>
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                  {statusDate.split('-')[0]}
                </div>
              </div>

              {/* Date input in DD/MM format */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Data (gg/mm)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="GG"
                    maxLength={2}
                    value={statusDate.split('-')[2]}
                    onChange={(e) => {
                      const year = statusDate.split('-')[0];
                      const month = statusDate.split('-')[1];
                      const day = e.target.value.padStart(2, '0');
                      if (day.length <= 2 && !isNaN(parseInt(day))) {
                        setStatusDate(`${year}-${month}-${day === '' ? '01' : day}`);
                      }
                    }}
                    className="w-16 border border-slate-300 rounded p-2 text-center text-sm"
                  />
                  <span className="text-slate-600">/</span>
                  <input
                    type="text"
                    placeholder="MM"
                    maxLength={2}
                    value={statusDate.split('-')[1]}
                    onChange={(e) => {
                      const year = statusDate.split('-')[0];
                      const day = statusDate.split('-')[2];
                      const month = e.target.value.padStart(2, '0');
                      if (month.length <= 2 && !isNaN(parseInt(month))) {
                        setStatusDate(`${year}-${month === '' ? '01' : month}-${day}`);
                      }
                    }}
                    className="w-16 border border-slate-300 rounded p-2 text-center text-sm"
                  />
                  <span className="text-slate-500 text-sm">/{statusDate.split('-')[0]}</span>
                </div>
              </div>

              {/* Reason selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Motivo {pendingStatusChange.isActivation ? 'Attivazione' : 'Disattivazione'}
                </label>
                <select
                  value={statusReason}
                  onChange={(e) => {
                    setStatusReason(e.target.value);
                    // Clear lodge if not a transfer
                    if (e.target.value !== 'Trasferimento Italia' && e.target.value !== 'Trasferimento Estero') {
                      setStatusLodge('');
                    }
                  }}
                  className="w-full border border-slate-300 rounded p-2.5 text-sm focus:border-masonic-gold focus:outline-none"
                >
                  <option value="">Seleziona un motivo...</option>
                  {STATUS_REASONS[pendingStatusChange.isActivation ? 'ACTIVATION' : 'DEACTIVATION'][pendingStatusChange.branch].map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              {/* Lodge field for transfers */}
              {(statusReason === 'Trasferimento Italia' || statusReason === 'Trasferimento Estero') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Loggia {pendingStatusChange.isActivation ? 'di provenienza' : 'di destinazione'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={statusLodge}
                    onChange={(e) => setStatusLodge(e.target.value)}
                    placeholder="Nome della loggia"
                    className="w-full border border-slate-300 rounded p-2.5 text-sm focus:border-masonic-gold focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setPendingStatusChange(null);
                  setChangingStatusFor(null);
                  setStatusReason('');
                  setStatusLodge('');
                }}
                className="flex-1 px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (statusReason && pendingStatusChange) {
                    // Check if lodge is required and filled
                    const isTransfer = statusReason === 'Trasferimento Italia' || statusReason === 'Trasferimento Estero';
                    if (isTransfer && !statusLodge.trim()) {
                      return; // Don't proceed if lodge is required but empty
                    }
                    handleStatusChange(pendingStatusChange.branch, pendingStatusChange.isActivation ? 'ACTIVE' : 'INACTIVE');
                  }
                }}
                disabled={!statusReason || ((statusReason === 'Trasferimento Italia' || statusReason === 'Trasferimento Estero') && !statusLodge.trim())}
                className="flex-1 px-4 py-2 bg-masonic-gold hover:bg-yellow-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
