import React, { useMemo, useState } from 'react';
import { Member, BranchType, MasonicBranchData, StatusEvent, AppSettings, CapitazioneTipo } from '../types';
import { BRANCHES, calculateMasonicYearString, getDegreeAbbreviation, isMemberActiveInYear } from '../constants';
import { Printer, Download } from 'lucide-react';
import { dataService } from '../services/dataService';

interface RelazioneAnnualeProps {
  members: Member[];
  selectedYear: number;
  settings: AppSettings;
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

const RelazioneAnnuale: React.FC<RelazioneAnnualeProps> = ({ members, selectedYear, settings }) => {
  const [activeBranch, setActiveBranch] = useState<BranchType>('CRAFT');

  const getCapitazioneForYear = (branchData: MasonicBranchData, year: number): string => {
    const ev = branchData.capitazioni?.find(c => c.year === year);
    return ev?.tipo || '—';
  };

  const euroFmt = useMemo(() => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }), []);

  const getQuotaForYear = (branchData: MasonicBranchData, year: number): number | null => {
    const tipo = branchData.capitazioni?.find(c => c.year === year)?.tipo as CapitazioneTipo | undefined;
    const prefs = settings.branchPreferences?.[activeBranch]?.defaultQuote;
    if (!tipo || !prefs) return null;
    const total = (prefs.quotaGLGC?.[tipo] ?? 0)
      + (prefs.quotaRegionale?.[tipo] ?? 0)
      + (prefs.quotaLoggia?.[tipo] ?? 0)
      + (prefs.quotaCerimonia?.[tipo] ?? 0);
    return total || null;
  };

  const branchReports = useMemo(() => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const previousYear = selectedYear - 1;

    return BRANCHES.reduce((acc, branch) => {
      const branchKey = branchKeys[branch.type];
      const branchMembers: MemberBranchContext[] = members
        .map(member => ({ member, branchData: member[branchKey] }))
        .filter(ctx => ctx.branchData && (ctx.branchData.statusEvents?.length || ctx.branchData.degrees?.length));

      const activeAtStart = sortByName(
        branchMembers.filter(ctx => isMemberActiveInYear(ctx.branchData, previousYear))
      );
      const activeAtEnd = sortByName(
        branchMembers.filter(ctx => isMemberActiveInYear(ctx.branchData, selectedYear))
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

      const activationEvents = events.filter(e => e.event.status === 'ACTIVE');
      const deactivationEvents = events.filter(e => e.event.status === 'INACTIVE');

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
      const resignations = deactivationEvents.filter(e => e.event.reason === 'Dimissioni');
      const deaths = deactivationEvents.filter(e => e.event.reason === 'Oriente Eterno');
      const deletions = deactivationEvents.filter(e => e.event.reason === 'Depennamento');
      const transfersOut = deactivationEvents.filter(e => 
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

  const renderMembersTable = (title: string, rows: MemberBranchContext[]) => {
    // Deduplicate by member ID
    const dedupedRows = Array.from(
      new Map(rows.map(row => [row.member.id, row])).values()
    );

    return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Cognome</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Grado</th>
              <th className="px-3 py-2">Tipo Capitazione</th>
              <th className="px-3 py-2">Quota</th>
            </tr>
          </thead>
          <tbody>
            {dedupedRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">Nessun dato disponibile</td>
              </tr>
            )}
            {dedupedRows.map((row, index) => (
              <tr key={row.member.id ? `member-${row.member.id}` : `fallback-${index}`} className="odd:bg-white even:bg-slate-50">
                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                <td className="px-3 py-2 font-medium">{row.member.lastName}</td>
                <td className="px-3 py-2">{row.member.firstName}</td>
                <td className="px-3 py-2">{getLatestDegree(row.branchData, activeBranch)}</td>
                <td className="px-3 py-2">{getCapitazioneForYear(row.branchData, selectedYear)}</td>
                <td className="px-3 py-2">{(() => { const q = getQuotaForYear(row.branchData, selectedYear); return q != null ? euroFmt.format(q) : '—'; })()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 text-sm font-semibold text-slate-600">
              <td className="px-3 py-2" colSpan={5}>Totale</td>
              <td className="px-3 py-2">{dedupedRows.length}</td>
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
    const totalColumns = 5 + optionalColumns;
    const labelColSpan = totalColumns - 1;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">{title}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 w-10">#</th>
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
      exportData.push({
        'Cognome': ctx.member.lastName,
        'Nome': ctx.member.firstName,
        'Grado': getLatestDegree(ctx.branchData, activeBranch),
        'Tipo Capitazione': getCapitazioneForYear(ctx.branchData, selectedYear),
        'Quota': (() => { const q = getQuotaForYear(ctx.branchData, selectedYear); return q != null ? q : '—'; })()
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

    // Tabella 10: Situazione al 31 dicembre
    exportData.push({ 'Cognome': 'TABELLA 10 - Situazione al 31 dicembre' });
    currentReport.activeAtEnd.forEach(ctx => {
      exportData.push({
        'Cognome': ctx.member.lastName,
        'Nome': ctx.member.firstName,
        'Grado': getLatestDegree(ctx.branchData, activeBranch),
        'Tipo Capitazione': getCapitazioneForYear(ctx.branchData, selectedYear),
        'Quota': '—'
      });
    });
    exportData.push({ 'Cognome': `TOTALE: ${currentReport.activeAtEnd.length}` });

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

      {renderMembersTable('Tabella 1 · Situazione al 1° gennaio', currentReport.activeAtStart)}

      {renderSimpleList(`Tabella 2 · ${config.primaryActivationLabel}`, currentReport.primaryActivations)}

      {renderSimpleList(`Tabella 3 · ${config.reAdmissionLabel} e ${config.transferInLabel}`, currentReport.reAdmissions.concat(currentReport.transfersIn), true, true)}

      {renderSimpleList(`Tabella 4 · ${config.transferOutLabel}`, currentReport.transfersOut, true, true)}

      {renderSimpleList(`Tabella 5 · ${config.foreignAffiliationLabel}`, currentReport.transfersForeign, true, true)}

      {renderSimpleList(`Tabella 6 · ${config.doubleAffiliationLabel}`, currentReport.doubleAffiliations, true, true)}

      {renderSimpleList('Tabella 7 · Dimissioni', currentReport.resignations)}

      {renderSimpleList('Tabella 8 · Depennamenti per Morosità', currentReport.deletions)}

      {renderMembersTable('Tabella 10 · Situazione al 31 dicembre', currentReport.activeAtEnd)}

      <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm px-4 py-3 text-xs text-amber-700">
        La colonna "Quota" è calcolata in base alle preferenze del ramo e al "Tipo Capitazione" impostato per l'anno selezionato. Modifica gli importi in Impostazioni → Preferenze di Ramo.
      </div>
    </div>
  );
};

export { RelazioneAnnuale };
