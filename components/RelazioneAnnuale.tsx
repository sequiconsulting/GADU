import React, { useMemo, useState } from 'react';
import { Member, BranchType, MasonicBranchData, StatusEvent, AppSettings, CapitazioneTipo } from '../types';
import { BRANCHES, calculateMasonicYearString, getDegreeAbbreviation, isMemberActiveInYear, CAPITAZIONI_CRAFT } from '../constants';
import { Printer, Download, Users } from 'lucide-react';
import { dataService } from '../services/dataService';

interface RelazioneAnnualeProps {
  members: Member[];
  selectedYear: number;
  settings: AppSettings;
  onUpdate?: () => Promise<void>;
}

type BranchKey = 'craft' | 'mark' | 'arch' | 'ram';

type MemberBranchContext = {
  member: Member;
  branchData: MasonicBranchData;
};

type EventContext = MemberBranchContext & {
  event: StatusEvent;
};

type BranchReportConfig = (typeof branchReportConfig)[BranchType];

interface BranchReport {
  branch: typeof BRANCHES[number];
  config: BranchReportConfig;
  activeAtStart: MemberBranchContext[];
  activeAtEnd: MemberBranchContext[];
  activeAtJan31: MemberBranchContext[];
  events: EventContext[];
  primaryActivations: EventContext[];
  reAdmissions: EventContext[];
  transfersIn: EventContext[];
  transfersForeign: EventContext[];
  doubleAffiliations: EventContext[];
  resignations: EventContext[];
  deaths: EventContext[];
  deletions: EventContext[];
  transfersOut: EventContext[];
}

const branchKeys: Record<BranchType, BranchKey> = {
  CRAFT: 'craft',
  MARK: 'mark',
  ARCH: 'arch',
  RAM: 'ram',
};

const branchReportConfig: Record<BranchType, {
  introLabel: string;
  memberPlural: string;
  primaryActivationLabel: string;
  primaryActivationReason: string;
  transferInLabel: string;
  transferOutLabel: string;
  reAdmissionLabel: string;
  foreignAffiliationLabel: string;
  doubleAffiliationLabel: string;
}> = {
  CRAFT: {
    introLabel: 'Loggia Craft',
    memberPlural: 'Fratelli',
    primaryActivationLabel: 'Iniziazioni',
    primaryActivationReason: 'Iniziazione',
    transferInLabel: 'Trasferimenti da altre Logge',
    transferOutLabel: 'Trasferimenti ad altre Logge',
    reAdmissionLabel: 'Riammissioni',
    foreignAffiliationLabel: 'Affiliazioni da Logge Estere',
    doubleAffiliationLabel: 'Affiliazioni in Doppia Appartenenza',
  },
  MARK: {
    introLabel: 'Loggia del Marchio',
    memberPlural: 'Fratelli',
    primaryActivationLabel: 'Avanzamenti',
    primaryActivationReason: 'Avanzamento',
    transferInLabel: 'Trasferimenti da altre Logge del Marchio',
    transferOutLabel: 'Trasferimenti ad altre Logge del Marchio',
    reAdmissionLabel: 'Riammissioni',
    foreignAffiliationLabel: 'Affiliazioni da Logge Estere',
    doubleAffiliationLabel: 'Affiliazioni in Doppia Appartenenza',
  },
  ARCH: {
    introLabel: 'Arco Reale',
    memberPlural: 'Compagni',
    primaryActivationLabel: 'Esaltazioni',
    primaryActivationReason: 'Esaltazione per primo',
    transferInLabel: 'Trasferimenti da altri Corpi dell\'Arco Reale',
    transferOutLabel: 'Trasferimenti ad altri Corpi dell\'Arco Reale',
    reAdmissionLabel: 'Riammissioni',
    foreignAffiliationLabel: 'Affiliazioni da Corpi dell\'Arco Reale Stranieri',
    doubleAffiliationLabel: 'Affiliazioni in Doppia Appartenenza',
  },
  RAM: {
    introLabel: 'Loggia Royal Ark Mariner',
    memberPlural: 'Fratelli',
    primaryActivationLabel: 'Elevazioni',
    primaryActivationReason: 'Elevazione',
    transferInLabel: 'Trasferimenti da altre Logge RAM',
    transferOutLabel: 'Trasferimenti ad altre Logge RAM',
    reAdmissionLabel: 'Riammissioni',
    foreignAffiliationLabel: 'Affiliazioni da Logge Estere',
    doubleAffiliationLabel: 'Affiliazioni in Doppia Appartenenza',
  },
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
};

const getLatestDegree = (branchData: MasonicBranchData, branch: BranchType) => {
  if (!branchData.degrees || branchData.degrees.length === 0) return '-';
  const sorted = [...branchData.degrees].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const latest = sorted[sorted.length - 1];
  return latest?.degreeName ? getDegreeAbbreviation(latest.degreeName) : '-';
};

const sortByName = (items: MemberBranchContext[]) => {
  return [...items].sort((a, b) => {
    const last = a.member.lastName.localeCompare(b.member.lastName);
    if (last !== 0) return last;
    return a.member.firstName.localeCompare(b.member.firstName);
  });
};

const RelazioneAnnuale: React.FC<RelazioneAnnualeProps> = ({ members, selectedYear, settings, onUpdate }) => {
  const [activeBranch, setActiveBranch] = useState<BranchType>('CRAFT');
  const [savingMemberIds, setSavingMemberIds] = useState<Set<string>>(new Set());

  const getCapitazioneForYear = (branchData: MasonicBranchData, year: number): { value: string; error?: string } => {
    const nextYear = year + 1;
    // Prova prima anno successivo, poi anno in corso del report
    const ev = branchData.capitazioni?.find(c => Number(c.year) === nextYear)
      || branchData.capitazioni?.find(c => Number(c.year) === year);
    
    if (!ev?.tipo) {
      return {
        value: '',
        error: `⚠️ Tipo capitazione non trovato per anno ${nextYear} o ${year}`
      };
    }
    
    return { value: ev.tipo };
  };

  const euroFmt = useMemo(() => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), []);

  const getQuotaForYear = (branchData: MasonicBranchData, year: number): { value: number | null; error?: string } => {
    const nextYear = year + 1;
    // Prova prima anno successivo, poi anno in corso del report
    const capitazione = branchData.capitazioni?.find(c => Number(c.year) === nextYear)
      || branchData.capitazioni?.find(c => Number(c.year) === year);
    const tipo = capitazione?.tipo as CapitazioneTipo | undefined;
    
    if (!tipo) {
      return {
        value: null,
        error: `⚠️ Tipo capitazione non trovato per anno ${nextYear} o ${year}`
      };
    }
    
    const prefs = settings.branchPreferences?.[activeBranch]?.defaultQuote;
    if (!prefs) {
      return {
        value: null,
        error: `⚠️ Quote non configurate per il ramo ${activeBranch}`
      };
    }
    
    const total = (prefs.quotaGLGC?.[tipo] ?? 0)
      + (prefs.quotaRegionale?.[tipo] ?? 0)
      + (prefs.quotaLoggia?.[tipo] ?? 0)
      + (prefs.quotaCerimonia?.[tipo] ?? 0);
    
    if (!total) {
      return {
        value: null,
        error: `⚠️ Quote non configurate per tipo "${tipo}"`
      };
    }
    
    return { value: total };
  };

  const getQuotaGLGCForYear = (branchData: MasonicBranchData, year: number): { value: number | null; error?: string } => {
    const nextYear = year + 1;
    // Prova prima anno successivo, poi anno in corso del report
    const capitazione = branchData.capitazioni?.find(c => Number(c.year) === nextYear)
      || branchData.capitazioni?.find(c => Number(c.year) === year);
    const tipo = capitazione?.tipo as CapitazioneTipo | undefined;
    
    if (!tipo) {
      return {
        value: null,
        error: `⚠️ Tipo capitazione non trovato per anno ${nextYear} o ${year}`
      };
    }
    
    const prefs = settings.branchPreferences?.[activeBranch]?.defaultQuote;
    if (!prefs) {
      return {
        value: null,
        error: `⚠️ Quote non configurate per il ramo ${activeBranch}`
      };
    }
    
    const quotaValue = prefs.quotaGLGC?.[tipo] ?? null;
    if (!quotaValue) {
      return {
        value: null,
        error: `⚠️ Quota GL/GC non configurata per tipo "${tipo}"`
      };
    }
    
    return { value: quotaValue };
  };

  const isActiveOnDate = (branchData: MasonicBranchData | undefined, targetDate: string): boolean => {
    if (!branchData?.statusEvents || branchData.statusEvents.length === 0) return false;
    const lastEvent = [...branchData.statusEvents]
      .filter(e => e.date <= targetDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .pop();
    return lastEvent?.status === 'ACTIVE';
  };

  const branchReports = useMemo(() => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const yearStartDeact = `${selectedYear}-02-01`;
    const previousYear = selectedYear - 1;

    return BRANCHES.reduce((acc, branch) => {
      const branchKey = branchKeys[branch.type];
      const branchMembers: MemberBranchContext[] = members
        .map(member => ({ member, branchData: member[branchKey] }))
        .filter(ctx => ctx.branchData && (ctx.branchData.statusEvents?.length || ctx.branchData.degrees?.length))
        .filter(ctx => {
          // Per il ramo CRAFT, considerare solo i membri della loggia madre
          if (branch.type === 'CRAFT') {
            return ctx.branchData.isMotherLodgeMember === true;
          }
          return true;
        });

      // Attivi al 1° gennaio dell'anno selezionato: valutiamo lo stato alla data esatta
      const activeAtStartDate = `${selectedYear}-01-01`;
      const activeAtStart = sortByName(
        branchMembers.filter(ctx => isActiveOnDate(ctx.branchData, activeAtStartDate))
      );
      const activeAtEnd = sortByName(
        branchMembers.filter(ctx => isMemberActiveInYear(ctx.branchData, selectedYear))
      );

      // Membri attivi al 31/1 anno successivo: partono da attivi al 31/12 anno selezionato,
      // esclusi nuovi ingressi tra 1/1 e 31/1 anno successivo, incluse disattivazioni in quel periodo
      const nextYearJan31 = `${selectedYear + 1}-01-31`;
      const nextYearJan1 = `${selectedYear + 1}-01-01`;
      const activeAtJan31 = sortByName(
        branchMembers.filter(ctx => {
          // Deve essere attivo al 31/12 anno selezionato
          if (!isMemberActiveInYear(ctx.branchData, selectedYear)) return false;

          // Verifica se c'è stata attivazione tra 1/1 e 31/1 anno successivo (escludiamo)
          const hasActivationInJan = ctx.branchData.statusEvents?.some(e =>
            e.status === 'ACTIVE' && e.date >= nextYearJan1 && e.date <= nextYearJan31
          );
          if (hasActivationInJan) return false;

          // Verifica lo stato al 31/1 anno successivo considerando eventuali disattivazioni
          const eventsUpToJan31 = [...(ctx.branchData.statusEvents || [])]
            .filter(e => e.date <= nextYearJan31)
            .sort((a, b) => a.date.localeCompare(b.date));
          const lastEvent = eventsUpToJan31[eventsUpToJan31.length - 1];
          return lastEvent?.status === 'ACTIVE';
        })
      );

      const events: EventContext[] = branchMembers.flatMap(ctx =>
        (ctx.branchData.statusEvents || [])
          .filter(event => event.date >= yearStart && event.date <= yearEnd)
          .map(event => ({ ...ctx, event }))
      ).sort((a, b) => {
        const last = a.member.lastName.localeCompare(b.member.lastName);
        if (last !== 0) return last;
        return a.member.firstName.localeCompare(b.member.firstName);
      });

      // Eventi estesi fino al 31/1 anno successivo per tabelle 4, 7, 8
      const eventsExtended: EventContext[] = branchMembers.flatMap(ctx =>
        (ctx.branchData.statusEvents || [])
          .filter(event => event.date >= yearStartDeact && event.date <= nextYearJan31)
          .map(event => ({ ...ctx, event }))
      ).sort((a, b) => {
        const last = a.member.lastName.localeCompare(b.member.lastName);
        if (last !== 0) return last;
        return a.member.firstName.localeCompare(b.member.firstName);
      });

      const activationEvents = events.filter(e => e.event.status === 'ACTIVE');
      const deactivationEvents = events.filter(e => e.event.status === 'INACTIVE' && e.event.date >= yearStartDeact);
      const deactivationEventsExtended = eventsExtended.filter(e => e.event.status === 'INACTIVE');

      const config = branchReportConfig[branch.type];

      // Categorize activation events - mutually exclusive
      const primaryActivations = activationEvents.filter(e => e.event.reason === config.primaryActivationReason);
      const reAdmissions = activationEvents.filter(e => e.event.reason === 'Riammissione');
      const transfersIn = activationEvents.filter(e => e.event.reason === 'Trasferimento Italia');
      const transfersForeign = activationEvents.filter(e => e.event.reason === 'Trasferimento Estero');
      const doubleAffiliations = activationEvents.filter(e => 
        e.branchData.isDualAppartenance && 
        e.event.reason !== config.primaryActivationReason && 
        e.event.reason !== 'Riammissione' && 
        e.event.reason !== 'Trasferimento Italia' &&
        e.event.reason !== 'Trasferimento Estero'
      );

      // Categorize deactivation events - mutually exclusive
      // Tabelle 7, 8: solo anno in corso
      const resignations = deactivationEventsExtended.filter(e => e.event.reason === 'Dimissioni');
      const deletions = deactivationEventsExtended.filter(e => e.event.reason === 'Depennamento');
      const deaths = deactivationEvents.filter(e => e.event.reason === 'Oriente Eterno');
      // Tabella 4: fino al 31/1 anno successivo
      const transfersOut = deactivationEventsExtended.filter(e => 
        e.event.reason && 
        e.event.reason.startsWith('Trasferimento') && 
        e.event.reason !== 'Dimissioni' && 
        e.event.reason !== 'Oriente Eterno' && 
        e.event.reason !== 'Depennamento'
      );

      acc[branch.type] = {
        branch,
        config,
        activeAtStart,
        activeAtEnd,
        activeAtJan31,
        events,
        primaryActivations,
        reAdmissions,
        transfersIn,
        transfersForeign,
        doubleAffiliations,
        resignations,
        deaths,
        deletions,
        transfersOut,
      } as BranchReport;

      return acc;
    }, {} as Record<BranchType, BranchReport>);
  }, [members, selectedYear]);

  const currentReport = branchReports[activeBranch];

  const renderMembersTable = (title: string, rows: MemberBranchContext[], options?: { showCapitazione?: boolean; showQuota?: boolean; quotaGLGCOnly?: boolean; showQuotaTotal?: boolean; editableCapitazione?: boolean }) => {
    // Deduplicate by member ID
    const dedupedRows = Array.from(
      new Map(rows.map(row => [row.member.id, row])).values()
    );

    const showCapitazione = options?.showCapitazione ?? false;
    const showQuota = options?.showQuota ?? false;
    const quotaGLGCOnly = options?.quotaGLGCOnly ?? false;
    const showQuotaTotal = options?.showQuotaTotal ?? false;
    const editableCapitazione = options?.editableCapitazione ?? false;

    // Funzione per salvare la capitazione per l'anno successivo
    const handleCapitazioneChange = async (memberId: string, newTipo: CapitazioneTipo) => {
      try {
        // Indica che il membro sta siendo salvato
        setSavingMemberIds(prev => new Set([...prev, memberId]));
        
        const member = members.find(m => m.id === memberId);
        if (!member) return;

        const nextYear = selectedYear + 1;
        const branchKey = activeBranch.toLowerCase() as BranchKey;
        const branchData = member[branchKey];

        // Assicura che l'array capitazioni esista
        if (!branchData.capitazioni) {
          branchData.capitazioni = [];
        }

        // Cerca la capitazione per l'anno successivo
        const existingIndex = branchData.capitazioni.findIndex(c => c.year === nextYear);
        if (existingIndex >= 0) {
          // Aggiorna quella esistente
          branchData.capitazioni[existingIndex] = { year: nextYear, tipo: newTipo };
        } else {
          // Crea una nuova
          branchData.capitazioni.push({ year: nextYear, tipo: newTipo });
        }

        // Salva il membro
        await dataService.saveMember(member);
        
        // Ricarica i dati se disponibile una callback
        if (onUpdate) {
          await onUpdate();
        }
      } catch (err) {
        console.error('Errore salvataggio capitazione:', err);
        alert(`Errore salvataggio capitazione: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
      } finally {
        // Rimuove il membro dal set di salvataggio
        setSavingMemberIds(prev => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
      }
    };

    // Calcola totale quote se richiesto
    const quotaTotal = showQuotaTotal ? dedupedRows.reduce((sum, row) => {
      const result = quotaGLGCOnly ? getQuotaGLGCForYear(row.branchData, selectedYear) : getQuotaForYear(row.branchData, selectedYear);
      return sum + (result.value ?? 0);
    }, 0) : 0;

    return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Matricola</th>
              <th className="px-3 py-2">Cognome</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2 text-center">Doppia</th>
              <th className="px-3 py-2">Provenienza</th>
              <th className="px-3 py-2">Grado</th>
              {showCapitazione && <th className="px-3 py-2">Tipo Capitazione</th>}
              {showQuota && <th className="px-3 py-2">Quota GL/GC</th>}
            </tr>
          </thead>
          <tbody>
            {dedupedRows.length === 0 && (
              <tr>
                <td colSpan={7 + (showCapitazione ? 1 : 0) + (showQuota ? 1 : 0)} className="px-3 py-4 text-center text-slate-400">Nessun dato disponibile</td>
              </tr>
            )}
            {dedupedRows.map((row, index) => (
              <tr key={row.member.id ? `member-${row.member.id}` : `fallback-${index}`} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                <td className="px-3 py-2 text-slate-600">{row.member.glriNumber || '—'}</td>
                <td className="px-3 py-2 font-medium">{row.member.lastName}</td>
                <td className="px-3 py-2">{row.member.firstName}</td>
                <td className="px-3 py-2 text-center">
                  {row.member.isDualAppartenance && <Users size={18} className="text-blue-600 mx-auto" />}
                </td>
                <td className="px-3 py-2">
                  {row.member.isMotherLodgeMember ? 'Madre' : (row.member.otherLodgeName || '—')}
                </td>
                <td className="px-3 py-2">{getLatestDegree(row.branchData, activeBranch)}</td>
                {showCapitazione && <td className="px-3 py-2">{editableCapitazione ? (() => {
                  const nextYear = selectedYear + 1;
                  const capitazione = row.branchData.capitazioni?.find(c => c.year === nextYear);
                  const currentValue = capitazione?.tipo || 'Ordinaria';
                  const isSaving = savingMemberIds.has(row.member.id);
                  return (
                    <select
                      value={currentValue}
                      onChange={(e) => handleCapitazioneChange(row.member.id, e.target.value as CapitazioneTipo)}
                      disabled={isSaving}
                      className={`px-2 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-masonic-gold focus:border-transparent ${
                        isSaving 
                          ? 'opacity-60 cursor-not-allowed bg-slate-100' 
                          : 'hover:border-masonic-gold cursor-pointer'
                      }`}
                    >
                      {CAPITAZIONI_CRAFT.map(cap => (
                        <option key={cap.tipo} value={cap.tipo}>{cap.tipo}</option>
                      ))}
                    </select>
                  );
                })() : (() => {
                  const result = getCapitazioneForYear(row.branchData, selectedYear);
                  return result.error ? <span className="text-red-600 text-xs">{result.error}</span> : result.value;
                })()}</td>}
                {showQuota && <td className="px-3 py-2">{(() => { 
                  const result = quotaGLGCOnly ? getQuotaGLGCForYear(row.branchData, selectedYear) : getQuotaForYear(row.branchData, selectedYear); 
                  return result.error ? <span className="text-red-600 text-xs">{result.error}</span> : (result.value != null ? euroFmt.format(result.value) : '—'); 
                })()}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 text-sm font-semibold text-slate-600">
              {showQuotaTotal ? (
                <>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">Totale: {dedupedRows.length}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  {showCapitazione && <td className="px-3 py-2"></td>}
                  {showQuota && <td className="px-3 py-2">{euroFmt.format(quotaTotal)}</td>}
                </>
              ) : (
                <>
                  <td className="px-3 py-2" colSpan={4 + (showCapitazione ? 1 : 0) + (showQuota ? 1 : 0)}>Totale</td>
                  <td className="px-3 py-2">{dedupedRows.length}</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    );
  };

  const renderSimpleList = (title: string, rows: EventContext[], showDegree = false, showOrigin = false) => {
    // Deduplicate rows by member ID, date, reason, and lodge (issue #27)
    const dedupedRows = Array.from(
      new Map(rows.map(row => 
        [`${row.member.id}-${row.event.date}-${row.event.reason || ''}-${row.event.lodge || ''}`, row]
      )).values()
    );

    const optionalColumns = (showDegree ? 1 : 0) + (showOrigin ? 1 : 0);
    const totalColumns = 6 + optionalColumns;
    const labelColSpan = totalColumns - 1;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">{title}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Matricola</th>
                <th className="px-3 py-2">Cognome</th>
                <th className="px-3 py-2">Nome</th>
                {showDegree && <th className="px-3 py-2">Grado</th>}
                {showOrigin && <th className="px-3 py-2">Provenienza / Destinazione</th>}
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {dedupedRows.length === 0 && (
                <tr>
                  <td colSpan={totalColumns} className="px-3 py-4 text-center text-slate-400">Nessun evento registrato</td>
                </tr>
              )}
              {dedupedRows.map((row, index) => (
                <tr key={`${row.member.id}-${row.event.date}-${index}`} className="odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-2 text-slate-600">{row.member.glriNumber || '—'}</td>
                  <td className="px-3 py-2 font-medium">{row.member.lastName}</td>
                  <td className="px-3 py-2">{row.member.firstName}</td>
                  {showDegree && <td className="px-3 py-2">{getLatestDegree(row.branchData, activeBranch)}</td>}
                  {showOrigin && (
                    <td className="px-3 py-2">{row.event.lodge || row.branchData.otherLodgeName || '—'}</td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.event.date)}</td>
                  <td className="px-3 py-2">{row.event.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 text-sm font-semibold text-slate-600">
                <td className="px-3 py-2" colSpan={labelColSpan}>Totale</td>
                <td className="px-3 py-2">{dedupedRows.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderRiscossioniTable = () => {
    // Raccogli i pagamenti effettuati nel ramo attivo per l'anno selezionato
    const paid = currentReport.activeAtEnd.filter(ctx => {
      const branchKey = activeBranch.toLowerCase() as BranchKey;
      const capitazione = ctx.branchData.capitazioni?.find(c => c.year === selectedYear);
      return capitazione?.pagato === true;
    });

    if (paid.length === 0) return null;

    // Calcola i totali per categoria
    let totalGL = 0;
    let totalRegionale = 0;
    let totalLoggia = 0;

    paid.forEach(ctx => {
      const branchKey = activeBranch.toLowerCase() as BranchKey;
      // Usa le quote attuali impostate
      const branchData = ctx.branchData;
      if (branchData && branchData.capitazioni) {
        totalGL += 100; // placeholder, dovrebbe venire dal dataService
        totalRegionale += 50;
        totalLoggia += 30;
      }
    });

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">Tabella 9 · Riscossioni Capitazioni</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Cognome</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Tipo Capitazione</th>
                <th className="px-3 py-2 text-right">Quota G.L. (€)</th>
                <th className="px-3 py-2 text-right">Quota Regionale (€)</th>
                <th className="px-3 py-2 text-right">Quota Loggia (€)</th>
                <th className="px-3 py-2 text-right">Totale (€)</th>
                <th className="px-3 py-2 text-right">Pagato (€)</th>
              </tr>
            </thead>
            <tbody>
              {paid.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-slate-400">Nessun pagamento registrato</td>
                </tr>
              )}
              {paid.map((row, index) => {
                const branchKey = activeBranch.toLowerCase() as BranchKey;
                const capitazione = row.branchData.capitazioni?.find(c => c.year === selectedYear);
                return (
                  <tr key={`${row.member.id}-${index}`} className="odd:bg-white even:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                    <td className="px-3 py-2 font-medium">{row.member.lastName}</td>
                    <td className="px-3 py-2">{row.member.firstName}</td>
                    <td className="px-3 py-2">{capitazione?.tipo || '—'}</td>
                    <td className="px-3 py-2 text-right">100.00</td>
                    <td className="px-3 py-2 text-right">50.00</td>
                    <td className="px-3 py-2 text-right">30.00</td>
                    <td className="px-3 py-2 text-right font-medium">180.00</td>
                    <td className="px-3 py-2 text-right">{typeof (capitazione as any)?.pagato === 'number' ? (capitazione as any).pagato.toFixed(2) : '0.00'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 text-sm font-semibold text-slate-600">
                <td className="px-3 py-2" colSpan={4}>Totale Riscosso</td>
                <td className="px-3 py-2 text-right">100.00</td>
                <td className="px-3 py-2 text-right">50.00</td>
                <td className="px-3 py-2 text-right">30.00</td>
                <td className="px-3 py-2 text-right font-bold">180.00</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!currentReport) return null;
    const config = currentReport.config;
    const {
      activeAtStart,
      activeAtEnd,
      primaryActivations,
      reAdmissions,
      transfersIn,
      transfersForeign,
      doubleAffiliations,
      resignations,
      deaths,
      deletions,
      transfersOut,
    } = currentReport;

    const cards = [
      { label: 'A inizio anno', value: activeAtStart.length },
      { label: config.primaryActivationLabel, value: primaryActivations.length },
      { label: currentReport.config.reAdmissionLabel, value: reAdmissions.length },
      { label: currentReport.config.transferInLabel, value: transfersIn.length },
      { label: currentReport.config.foreignAffiliationLabel, value: transfersForeign.length },
      { label: currentReport.config.doubleAffiliationLabel, value: doubleAffiliations.length },
      { label: 'Dimissioni', value: resignations.length },
      { label: 'Oriente Eterno', value: deaths.length },
      { label: 'Depennamenti per Morosità', value: deletions.length },
      { label: currentReport.config.transferOutLabel, value: transfersOut.length },
      { label: 'A fine anno', value: activeAtEnd.length },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {cards.map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
            <div className="text-2xl font-semibold text-slate-800">{card.value}</div>
          </div>
        ))}
      </div>
    );
  };

  if (!currentReport) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Nessun dato disponibile per l'anno selezionato.</p>
      </div>
    );
  }

  const { config } = currentReport;

  const handlePrint = () => {
    const originalTitle = document.title;
    const branchLabel = BRANCHES.find(b => b.type === activeBranch)?.label || activeBranch;
    document.title = `GADU - ${settings.lodgeName || 'Loggia'} - Relazione Annuale ${branchLabel} ${selectedYear}`;
    window.print();
    document.title = originalTitle;
  };

  const handleExportExcel = () => {
    const exportData: any[] = [];

    // Aggiungi intestazione con informazioni relazione
    exportData.push({
      'Ramo': config.introLabel,
      'Data': `${selectedYear}`,
      'Loggia': settings.lodgeName || '',
      'Numero': settings.lodgeNumber || '',
      'Provincia': settings.province || ''
    });
    exportData.push({}); // Riga vuota

    // Tabella 1: Situazione al 1° gennaio
    exportData.push({ 'Cognome': 'TABELLA 1 - Situazione al 1° gennaio' });
    currentReport.activeAtStart.forEach(ctx => {
      const capitazioneResult = getCapitazioneForYear(ctx.branchData, selectedYear);
      const quotaResult = getQuotaForYear(ctx.branchData, selectedYear);
      exportData.push({
        'Cognome': ctx.member.lastName,
        'Nome': ctx.member.firstName,
        'Grado': getLatestDegree(ctx.branchData, activeBranch),
        'Tipo Capitazione': capitazioneResult.error || capitazioneResult.value,
        'Quota': quotaResult.error || (quotaResult.value != null ? quotaResult.value : '—')
      });
    });
    exportData.push({ 'Cognome': `TOTALE: ${currentReport.activeAtStart.length}` });
    exportData.push({}); // Riga vuota

    // Tabella 2: Primarie attivazioni
    if (currentReport.primaryActivations.length > 0) {
      exportData.push({ 'Cognome': `TABELLA 2 - ${config.primaryActivationLabel}` });
      currentReport.primaryActivations.forEach(ctx => {
        exportData.push({
          'Cognome': ctx.member.lastName,
          'Nome': ctx.member.firstName,
          'Data': formatDate(ctx.event.date),
          'Motivo': ctx.event.reason || '—'
        });
      });
      exportData.push({ 'Cognome': `TOTALE: ${currentReport.primaryActivations.length}` });
      exportData.push({});
    }

    // Tabella 3: Riammissioni e Trasferimenti In
    const table3Data = currentReport.reAdmissions.concat(currentReport.transfersIn);
    if (table3Data.length > 0) {
      exportData.push({ 'Cognome': `TABELLA 3 - ${config.reAdmissionLabel} e ${config.transferInLabel}` });
      table3Data.forEach(ctx => {
        exportData.push({
          'Cognome': ctx.member.lastName,
          'Nome': ctx.member.firstName,
          'Grado': getLatestDegree(ctx.branchData, activeBranch),
          'Provenienza': ctx.branchData.otherLodgeName || '—',
          'Data': formatDate(ctx.event.date),
          'Motivo': ctx.event.reason || '—'
        });
      });
      exportData.push({ 'Cognome': `TOTALE: ${table3Data.length}` });
      exportData.push({});
    }

    // Tabella 4: Trasferimenti Out
    if (currentReport.transfersOut.length > 0) {
      exportData.push({ 'Cognome': `TABELLA 4 - ${config.transferOutLabel}` });
      currentReport.transfersOut.forEach(ctx => {
        exportData.push({
          'Cognome': ctx.member.lastName,
          'Nome': ctx.member.firstName,
          'Grado': getLatestDegree(ctx.branchData, activeBranch),
          'Destinazione': ctx.branchData.otherLodgeName || '—',
          'Data': formatDate(ctx.event.date),
          'Motivo': ctx.event.reason || '—'
        });
      });
      exportData.push({ 'Cognome': `TOTALE: ${currentReport.transfersOut.length}` });
      exportData.push({});
    }

    // Tabella 5: Affiliazioni da Estero
    if (currentReport.transfersForeign.length > 0) {
      exportData.push({ 'Cognome': `TABELLA 5 - ${config.foreignAffiliationLabel}` });
      currentReport.transfersForeign.forEach(ctx => {
        exportData.push({
          'Cognome': ctx.member.lastName,
          'Nome': ctx.member.firstName,
          'Grado': getLatestDegree(ctx.branchData, activeBranch),
          'Provenienza': ctx.branchData.otherLodgeName || '—',
          'Data': formatDate(ctx.event.date)
        });
      });
      exportData.push({ 'Cognome': `TOTALE: ${currentReport.transfersForeign.length}` });
      exportData.push({});
    }

    // Tabella 6: Doppie Appartenenze
    if (currentReport.doubleAffiliations.length > 0) {
      exportData.push({ 'Cognome': `TABELLA 6 - ${config.doubleAffiliationLabel}` });
      currentReport.doubleAffiliations.forEach(ctx => {
        exportData.push({
          'Cognome': ctx.member.lastName,
          'Nome': ctx.member.firstName,
          'Grado': getLatestDegree(ctx.branchData, activeBranch),
          'Provenienza': ctx.branchData.otherLodgeName || '—',
          'Data': formatDate(ctx.event.date)
        });
      });
      exportData.push({ 'Cognome': `TOTALE: ${currentReport.doubleAffiliations.length}` });
      exportData.push({});
    }

    // Tabella 7: Dimissioni
    if (currentReport.resignations.length > 0) {
      exportData.push({ 'Cognome': 'TABELLA 7 - Dimissioni' });
      currentReport.resignations.forEach(ctx => {
        exportData.push({
          'Cognome': ctx.member.lastName,
          'Nome': ctx.member.firstName,
          'Data': formatDate(ctx.event.date)
        });
      });
      exportData.push({ 'Cognome': `TOTALE: ${currentReport.resignations.length}` });
      exportData.push({});
    }

    // Tabella 8: Depennamenti
    if (currentReport.deletions.length > 0) {
      exportData.push({ 'Cognome': 'TABELLA 8 - Depennamenti per Morosità' });
      currentReport.deletions.forEach(ctx => {
        exportData.push({
          'Cognome': ctx.member.lastName,
          'Nome': ctx.member.firstName,
          'Data': formatDate(ctx.event.date)
        });
      });
      exportData.push({ 'Cognome': `TOTALE: ${currentReport.deletions.length}` });
      exportData.push({});
    }

    // Tabella 10: Situazione al 31 dicembre anno in corso (etichetta)
    exportData.push({ 'Cognome': `TABELLA 10 - Situazione al 31 dicembre ${selectedYear}` });
    currentReport.activeAtJan31.forEach(ctx => {
      const capitazioneResult = getCapitazioneForYear(ctx.branchData, selectedYear);
      const quotaResult = getQuotaForYear(ctx.branchData, selectedYear);
      exportData.push({
        'Matricola': ctx.member.glriNumber || '—',
        'Cognome': ctx.member.lastName,
        'Nome': ctx.member.firstName,
        'Grado': getLatestDegree(ctx.branchData, activeBranch),
        'Tipo Capitazione': capitazioneResult.error || capitazioneResult.value,
        'Quota': quotaResult.error || (quotaResult.value != null ? quotaResult.value : '—')
      });
    });
    exportData.push({ 'Cognome': `TOTALE: ${currentReport.activeAtJan31.length}` });

    dataService.exportToExcel(exportData, `GADU_${settings.lodgeName || 'Loggia'}_Relazione_${config.introLabel.replace(/\s+/g, '_')}_${selectedYear}`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 print:hidden">
        <div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-800">Relazione Annuale</h2>
          <p className="text-slate-500 mt-1">Report dettagliato per l'anno {selectedYear}</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors shadow-md w-full md:w-auto justify-center">
            <Printer size={18} /> Stampa
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-lg hover:bg-green-600 transition-colors shadow-md w-full md:w-auto justify-center">
            <Download size={18} /> Esporta
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto rounded-t-lg scrollbar-hide print:hidden">
        {BRANCHES.map(b => (
          <button
            key={b.type}
            onClick={() => setActiveBranch(b.type)}
            className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${
              activeBranch === b.type
                ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white`
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${b.color}`} />
            {b.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 border-t-0 shadow-sm p-6 space-y-3">
        <h2 className="text-lg font-serif font-bold text-slate-800">
          {config.introLabel} – Relazione Annuale {selectedYear}
        </h2>
        <p className="text-sm text-slate-600">
          {settings.lodgeName ? `${settings.lodgeName} N. ${settings.lodgeNumber}` : 'Loggia non configurata'} · Provincia {settings.province || 'N.D.'}
        </p>
        <p className="text-sm text-slate-500">
          Alla data del 1° gennaio {selectedYear} facevano parte {currentReport.config.memberPlural.toLowerCase()} pari a {currentReport.activeAtStart.length} unità; al 31 dicembre {selectedYear} risultano {currentReport.activeAtEnd.length} {currentReport.config.memberPlural.toLowerCase()} attivi.
        </p>
      </div>

      {renderSummary()}

      {renderMembersTable('Tabella 1 · Situazione al 1° gennaio', currentReport.activeAtStart, { showCapitazione: false, showQuota: false, showQuotaTotal: true })}

      {renderSimpleList(`Tabella 2 · ${config.primaryActivationLabel}`, currentReport.primaryActivations)}

      {renderSimpleList(`Tabella 3 · ${config.reAdmissionLabel} e ${config.transferInLabel}`, currentReport.reAdmissions.concat(currentReport.transfersIn), true, true)}

      {renderSimpleList(`Tabella 4 · ${config.transferOutLabel}`, currentReport.transfersOut, true, true)}

      {renderSimpleList(`Tabella 5 · ${config.foreignAffiliationLabel}`, currentReport.transfersForeign, true, true)}

      {renderSimpleList(`Tabella 6 · ${config.doubleAffiliationLabel}`, currentReport.doubleAffiliations, true, true)}

      {renderSimpleList('Tabella 7 · Dimissioni', currentReport.resignations)}

      {renderSimpleList('Tabella 8 · Depennamenti per Morosità', currentReport.deletions)}

      {renderRiscossioniTable()}

      {/* Riepilogo movimentazione */}
      {(() => {
        const totaleInizioAnno = currentReport.activeAtStart.length;
        const totaleIncrementi = currentReport.primaryActivations.length + currentReport.reAdmissions.length + currentReport.transfersIn.length + currentReport.transfersForeign.length + currentReport.doubleAffiliations.length;
        const totaleDecrementi = currentReport.transfersOut.length + currentReport.resignations.length + currentReport.deletions.length + currentReport.deaths.length;
        const totaleAnnoInCorso = currentReport.activeAtEnd.length;
        const sommaAlgebrica = totaleInizioAnno + totaleIncrementi - totaleDecrementi;
        const totaleJan31 = currentReport.activeAtJan31.length;
        
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-blue-200 bg-blue-100 font-semibold text-blue-800">Riepilogo Movimentazione</div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-700">Totale inizio anno {selectedYear}:</span>
                <span className="font-semibold text-slate-900">{totaleInizioAnno}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Totale incrementi (attivazioni):</span>
                <span className="font-semibold text-green-700">+{totaleIncrementi}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Totale decrementi (disattivazioni fino al 31/1/{selectedYear + 1}):</span>
                <span className="font-semibold text-red-700">-{totaleDecrementi}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Somma algebrica (inizio + incrementi - decrementi):</span>
                <span className="font-semibold text-blue-700">{sommaAlgebrica}</span>
              </div>
              <div className="flex justify-between border-t border-blue-300 pt-2 mt-2">
                <span className="text-slate-700 font-semibold">Totale al 31/1/{selectedYear + 1} (Tabella 10):</span>
                <span className="font-bold text-blue-900">{totaleJan31}</span>
              </div>
              {sommaAlgebrica !== totaleJan31 && (
                <div className="bg-amber-100 border border-amber-300 rounded px-3 py-2 text-xs text-amber-800 mt-2">
                  ⚠️ Attenzione: la somma algebrica ({sommaAlgebrica}) non corrisponde al totale Tabella 10 ({totaleJan31}). Verifica eventi tra 1/1 e 31/1/{selectedYear + 1}.
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {renderMembersTable(`Tabella 10 · Situazione al 31 dicembre ${selectedYear}`, currentReport.activeAtJan31, { showCapitazione: true, showQuota: true, quotaGLGCOnly: true, showQuotaTotal: true, editableCapitazione: true })}

      <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm px-4 py-3 text-xs text-amber-700">
        La colonna "Quota" è calcolata in base alle preferenze del ramo e al "Tipo Capitazione" impostato per l'anno selezionato. Modifica gli importi in Impostazioni → Preferenze di Ramo.
      </div>
    </div>
  );
};

export { RelazioneAnnuale };
