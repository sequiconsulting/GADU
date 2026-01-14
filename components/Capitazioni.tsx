import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Member, BranchType, AppSettings, CapitazioneTipo, CapitazioneEvent } from '../types';
import { BRANCHES, isMemberActiveInYear, CAPITAZIONE_TYPES } from '../constants';
import { AlertTriangle, Users } from 'lucide-react';
import { dataService } from '../services/dataService';

interface CapitazioniProps {
  members: Member[];
  selectedYear: number;
  appSettings: AppSettings;
  onUpdate?: () => Promise<void>;
  lodgeName?: string;
  lodgeNumber?: string;
}

export const Capitazioni: React.FC<CapitazioniProps> = ({ 
  members, 
  selectedYear, 
  appSettings,
  onUpdate,
  lodgeName,
  lodgeNumber
}) => {
  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, []);

  const fmt = (value: number): string => {
    if (!Number.isFinite(value)) return numberFormatter.format(0);
    return numberFormatter.format(value);
  };

  const [activeBranch, setActiveBranch] = useState<BranchType>('CRAFT');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberCapitazioni, setMemberCapitazioni] = useState<Map<string, CapitazioneEvent | undefined>>(new Map());
  // Stato per le quote modificabili per-tipo
  const [quotesByTipo, setQuotesByTipo] = useState<Record<CapitazioneTipo, { quota_gl: number; quota_regionale: number; quota_loggia: number }>>({} as any);

  const isMountedRef = useRef(true);
  const quoteSaveTimersRef = useRef<Map<string, number>>(new Map());
  const pendingQuotesRef = useRef<
    Map<string, Record<CapitazioneTipo, { quota_gl: number; quota_regionale: number; quota_loggia: number }>>
  >(new Map());

  const memberSaveTimersRef = useRef<Map<string, number>>(new Map());
  const pendingMemberCapsRef = useRef<Map<string, CapitazioneEvent>>(new Map());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancella eventuali debounce pendenti
      for (const timerId of quoteSaveTimersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      quoteSaveTimersRef.current.clear();
      pendingQuotesRef.current.clear();

      for (const timerId of memberSaveTimersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      memberSaveTimersRef.current.clear();
      pendingMemberCapsRef.current.clear();
    };
  }, []);

  // Carica le quote per il ramo/anno selezionato
  useEffect(() => {
    // Flag per rilevare se il component è ancora montato
    let isMounted = true;
    
    const loadQuotes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Carica le quote (che verranno seed dal dataService se non esistono)
        const loaded = await dataService.getCapitazioniQuotes(selectedYear, activeBranch);
        
        // Aggiorna solo se il component è ancora montato
        if (isMounted) {
          setQuotesByTipo(loaded.byTipo);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Errore caricamento quote');
          setIsLoading(false);
        }
      }
    };
    
    loadQuotes();
    
    // Cleanup per evitare state updates su component smontato
    return () => {
      isMounted = false;
    };
  }, [selectedYear, activeBranch]);

  const scheduleSaveQuotes = (
    year: number,
    branch: BranchType,
    nextQuotes: Record<CapitazioneTipo, { quota_gl: number; quota_regionale: number; quota_loggia: number }>
  ) => {
    const key = `${year}:${branch}`;
    pendingQuotesRef.current.set(key, nextQuotes);

    const existingTimer = quoteSaveTimersRef.current.get(key);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timerId = window.setTimeout(async () => {
      quoteSaveTimersRef.current.delete(key);
      const payload = pendingQuotesRef.current.get(key);
      pendingQuotesRef.current.delete(key);
      if (!payload) return;

      try {
        await dataService.saveCapitazioniQuotes(year, branch, { byTipo: payload });
        if (isMountedRef.current) setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore salvataggio quote';
        if (isMountedRef.current) setError(message);
        else console.error(message);
      }
    }, 250);

    quoteSaveTimersRef.current.set(key, timerId);
  };

  // Salva capitazione di un singolo membro al volo
  const saveMemberCapitazione = async (member: Member, branch: BranchType, cap: CapitazioneEvent) => {
    try {
      const branchKey = branch.toLowerCase() as keyof Member;
      const branchData = member[branchKey] as any;
      
      // Trova o crea l'entry nella lista capitazioni
      const existingIdx = branchData.capitazioni?.findIndex(c => c.year === selectedYear) ?? -1;
      const updatedCapitazioni = branchData.capitazioni ? [...branchData.capitazioni] : [];
      
      if (existingIdx >= 0) {
        updatedCapitazioni[existingIdx] = cap;
      } else {
        updatedCapitazioni.push(cap);
      }
      
      // Salva il membro
      await dataService.saveMember({
        ...member,
        [branchKey]: {
          ...branchData,
          capitazioni: updatedCapitazioni
        }
      });
      
      if (onUpdate) await onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio capitazione');
    }
  };

  const getPaidAmount = (cap?: CapitazioneEvent): number => {
    const raw = (cap as any)?.pagato;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    return 0;
  };

  const getPaidAmountWithTotal = (cap: CapitazioneEvent | undefined, totalDue: number): number => {
    const raw = (cap as any)?.pagato;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'boolean') return raw ? totalDue : 0;
    return 0;
  };

  const scheduleSaveMemberCapitazione = (memberId: string, branch: BranchType, cap: CapitazioneEvent) => {
    const key = `${selectedYear}:${branch}:${memberId}`;
    pendingMemberCapsRef.current.set(key, cap);

    const existingTimer = memberSaveTimersRef.current.get(key);
    if (existingTimer) window.clearTimeout(existingTimer);

    const timerId = window.setTimeout(async () => {
      memberSaveTimersRef.current.delete(key);
      const payload = pendingMemberCapsRef.current.get(key);
      pendingMemberCapsRef.current.delete(key);
      if (!payload) return;

      const member = members.find(m => m.id === memberId);
      if (!member) {
        const message = `Impossibile salvare capitazione: membro non trovato (id=${memberId})`;
        if (isMountedRef.current) setError(message);
        else console.error(message);
        return;
      }

      await saveMemberCapitazione(member, branch, payload);
    }, 250);

    memberSaveTimersRef.current.set(key, timerId);
  };

  // Determina se un membro è attivo in questo ramo per l'anno
  const getActiveMembersForBranch = () => {
    return members.filter(m => {
      const branchKey = activeBranch.toLowerCase() as keyof Member;
      const branchData = m[branchKey] as MasonicBranchData;
      
      // Verifica che il membro sia attivo in questo ramo per questo anno
      if (!isMemberActiveInYear(branchData, selectedYear)) {
        return false;
      }
      
      // Per il ramo CRAFT, filtra per loggia madre o doppia appartenenza
      if (activeBranch === 'CRAFT') {
        return branchData.isMotherLodgeMember || branchData.isDualAppartenance;
      }
      
      return true;
    }).slice().sort((a, b) => {
      const lastA = (a.lastName || '').trim();
      const lastB = (b.lastName || '').trim();
      const lastCmp = lastA.localeCompare(lastB, 'it', { sensitivity: 'base' });
      if (lastCmp !== 0) return lastCmp;

      const firstA = (a.firstName || '').trim();
      const firstB = (b.firstName || '').trim();
      return firstA.localeCompare(firstB, 'it', { sensitivity: 'base' });
    });
  };

  // Legge la capitazione di un membro
  const getCapitazioneMembro = (member: Member): CapitazioneEvent | undefined => {
    const branchKey = activeBranch.toLowerCase() as keyof Member;
    const branchData = member[branchKey] as any;
    return branchData.capitazioni?.find(c => c.year === selectedYear);
  };

  // Logica di dimming: MARK e ARCH pagano insieme
  const shouldDimBranch = (member: Member): boolean => {
    if (activeBranch === 'MARK') {
      const archCap = getCapitazioneMembro({ ...member, arch: member.arch });
      if (getPaidAmount(archCap) > 0) return true; // Se ARCH ha pagamento registrato, MARK è dimmed
    }
    if (activeBranch === 'ARCH') {
      const markCap = getCapitazioneMembro({ ...member, mark: member.mark });
      if (getPaidAmount(markCap) > 0) return true; // Se MARK ha pagamento registrato, ARCH è dimmed
    }
    return false;
  };

  // Calcola il totale quota per un tipo capitazione specifico
  const getQuotaForTipo = (tipo: CapitazioneTipo): number => {
    const branchPrefs = appSettings.branchPreferences?.[activeBranch] || {};
    const qGL = branchPrefs.defaultQuote?.quotaGLGC?.[tipo] || 0;
    const qReg = branchPrefs.defaultQuote?.quotaRegionale?.[tipo] || 0;
    const qLog = branchPrefs.defaultQuote?.quotaLoggia?.[tipo] || 0;
    return qGL + qReg + qLog;
  };

  const activeBranchData = BRANCHES.find(b => b.type === activeBranch);
  const activeMembers = getActiveMembersForBranch();

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div>
        <h2 className="text-2xl font-serif font-bold text-slate-800">Capitazioni</h2>
        <p className="text-slate-500">Gestione quote anno {selectedYear}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tab per ramo */}
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto rounded-t-lg scrollbar-hide">
        {BRANCHES.map(branch => (
          <button
            key={branch.type}
            onClick={() => setActiveBranch(branch.type)}
            className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeBranch === branch.type
                ? 'border-masonic-gold text-masonic-gold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {branch.label}
          </button>
        ))}
      </div>

      {/* Tabella Quote */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <h3 className="text-xs font-semibold text-slate-800 mb-2">Quote {activeBranchData?.label}</h3>
        
        {isLoading ? (
          <div className="text-center py-3 text-slate-500 text-xs">Caricamento...</div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-slate-700 border border-slate-300">Tipo</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-700 border border-slate-300">{activeBranch === 'CRAFT' ? 'GL' : 'GC'}</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-700 border border-slate-300">Reg.</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-700 border border-slate-300">Loggia</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-700 border border-slate-300">Tot.</th>
                  </tr>
                </thead>
                <tbody>
                  {CAPITAZIONE_TYPES.map(tipo => {
                    const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                    const qTot = q.quota_gl + q.quota_regionale + q.quota_loggia;
                    
                    return (
                      <tr key={tipo} className="hover:bg-slate-50">
                        <td className="px-2 py-1 border border-slate-300 text-slate-700 text-xs">{tipo}</td>
                        <td className="px-2 py-1 border border-slate-300 text-xs">
                          <input
                            type="number"
                            value={q.quota_gl}
                            onChange={(e) => {
                              const numValue = parseFloat(e.target.value) || 0;
                              setQuotesByTipo(prev => {
                                const next = {
                                  ...prev,
                                  [tipo]: {
                                    ...prev[tipo],
                                    quota_gl: numValue
                                  }
                                };
                                scheduleSaveQuotes(selectedYear, activeBranch, next);
                                return next;
                              });
                            }}
                            className="no-spinner w-12 px-1 py-0 border border-slate-300 rounded text-right text-xs outline-none focus:ring-1 focus:ring-masonic-gold"
                            step="1"
                          />
                        </td>
                        <td className="px-2 py-1 border border-slate-300 text-xs">
                          <input
                            type="number"
                            value={q.quota_regionale}
                            onChange={(e) => {
                              const numValue = parseFloat(e.target.value) || 0;
                              setQuotesByTipo(prev => {
                                const next = {
                                  ...prev,
                                  [tipo]: {
                                    ...prev[tipo],
                                    quota_regionale: numValue
                                  }
                                };
                                scheduleSaveQuotes(selectedYear, activeBranch, next);
                                return next;
                              });
                            }}
                            className="no-spinner w-12 px-1 py-0 border border-slate-300 rounded text-right text-xs outline-none focus:ring-1 focus:ring-masonic-gold"
                            step="1"
                          />
                        </td>
                        <td className="px-2 py-1 border border-slate-300 text-xs">
                          <input
                            type="number"
                            value={q.quota_loggia}
                            onChange={(e) => {
                              const numValue = parseFloat(e.target.value) || 0;
                              setQuotesByTipo(prev => {
                                const next = {
                                  ...prev,
                                  [tipo]: {
                                    ...prev[tipo],
                                    quota_loggia: numValue
                                  }
                                };
                                scheduleSaveQuotes(selectedYear, activeBranch, next);
                                return next;
                              });
                            }}
                            className="no-spinner w-12 px-1 py-0 border border-slate-300 rounded text-right text-xs outline-none focus:ring-1 focus:ring-masonic-gold"
                            step="1"
                          />
                        </td>
                        <td className="px-2 py-1 border border-slate-300 text-right text-slate-700 font-semibold text-xs">{fmt(qTot)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Tabella Soci Attivi */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <h3 className="text-base font-semibold text-slate-800 p-6 pb-4">Soci Attivi - {activeBranchData?.label}</h3>
        
        {activeMembers.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Nessun socio attivo in questo ramo per l'anno {selectedYear}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Cognome</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Nome</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-700">Doppia</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Provenienza</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Tipo Capitazione</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">{activeBranch === 'CRAFT' ? 'GL' : 'GC'} (€)</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Reg. (€)</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Loggia (€)</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Totale (€)</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Pagato (€)</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Residuo (€)</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((member) => {
                  const cap = memberCapitazioni.get(member.id) || getCapitazioneMembro(member);
                  const isDisabled = shouldDimBranch(member);
                  const tipo = cap?.tipo || 'Ordinaria';
                  const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                  const totale = q.quota_gl + q.quota_regionale + q.quota_loggia;
                  const pagato = getPaidAmountWithTotal(cap, totale);
                  const residuo = Math.max(0, totale - pagato);
                  const branchKey = activeBranch.toLowerCase() as keyof Member;
                  const branchData = member[branchKey] as MasonicBranchData;

                  return (
                    <tr key={member.id} className={`border-t border-slate-200 ${isDisabled ? 'bg-slate-100 opacity-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-2 text-slate-700">{member.lastName}</td>
                      <td className="px-3 py-2 text-slate-700">{member.firstName}</td>
                      <td className="px-3 py-2 text-center">
                        {branchData.isDualAppartenance && <Users size={18} className="text-blue-600 mx-auto" />}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {branchData.isMotherLodgeMember ? 'Madre' : (branchData.otherLodgeName || '—')}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={cap?.tipo || 'Ordinaria'}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newCap: CapitazioneEvent = {
                              year: selectedYear,
                              tipo: e.target.value as CapitazioneTipo,
                              pagato: getPaidAmountWithTotal(cap, totale)
                            };
                            memberCapitazioni.set(member.id, newCap);
                            setMemberCapitazioni(new Map(memberCapitazioni));
                            scheduleSaveMemberCapitazione(member.id, activeBranch, newCap);
                          }}
                          className="px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-masonic-gold disabled:bg-slate-200"
                        >
                          {CAPITAZIONE_TYPES.map(tipo => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700 text-xs">{fmt(q.quota_gl)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700 text-xs">{fmt(q.quota_regionale)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700 text-xs">{fmt(q.quota_loggia)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700 text-xs font-bold">{fmt(totale)}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={pagato}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const nextPaid = raw === '' ? 0 : Number(raw);
                            if (!Number.isFinite(nextPaid)) return;

                            const newCap: CapitazioneEvent = {
                              year: selectedYear,
                              tipo: cap?.tipo || 'Ordinaria',
                              pagato: nextPaid,
                            };
                            memberCapitazioni.set(member.id, newCap);
                            setMemberCapitazioni(new Map(memberCapitazioni));
                            scheduleSaveMemberCapitazione(member.id, activeBranch, newCap);
                          }}
                          className="no-spinner w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right outline-none focus:ring-2 focus:ring-masonic-gold disabled:bg-slate-200"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-700 text-xs">{fmt(residuo)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-700">Totale:</td>
                  <td className="px-3 py-2 text-right text-slate-700 font-bold">
                    {fmt(activeMembers.reduce((sum, m) => {
                      const cap = memberCapitazioni.get(m.id) || getCapitazioneMembro(m);
                      const tipo = cap?.tipo || 'Ordinaria';
                      const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                      return sum + q.quota_gl;
                    }, 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 font-bold">
                    {fmt(activeMembers.reduce((sum, m) => {
                      const cap = memberCapitazioni.get(m.id) || getCapitazioneMembro(m);
                      const tipo = cap?.tipo || 'Ordinaria';
                      const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                      return sum + q.quota_regionale;
                    }, 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 font-bold">
                    {fmt(activeMembers.reduce((sum, m) => {
                      const cap = memberCapitazioni.get(m.id) || getCapitazioneMembro(m);
                      const tipo = cap?.tipo || 'Ordinaria';
                      const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                      return sum + q.quota_loggia;
                    }, 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 font-bold">
                    {fmt(activeMembers.reduce((sum, m) => {
                      const cap = memberCapitazioni.get(m.id) || getCapitazioneMembro(m);
                      const tipo = cap?.tipo || 'Ordinaria';
                      const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                      return sum + (q.quota_gl + q.quota_regionale + q.quota_loggia);
                    }, 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 font-bold">
                    {fmt(activeMembers.reduce((sum, m) => {
                      const cap = memberCapitazioni.get(m.id) || getCapitazioneMembro(m);
                      const tipo = cap?.tipo || 'Ordinaria';
                      const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                      const totale = q.quota_gl + q.quota_regionale + q.quota_loggia;
                      return sum + getPaidAmountWithTotal(cap, totale);
                    }, 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 font-bold">
                    {fmt(activeMembers.reduce((sum, m) => {
                      const cap = memberCapitazioni.get(m.id) || getCapitazioneMembro(m);
                      const tipo = cap?.tipo || 'Ordinaria';
                      const q = quotesByTipo[tipo] || { quota_gl: 0, quota_regionale: 0, quota_loggia: 0 };
                      const totale = q.quota_gl + q.quota_regionale + q.quota_loggia;
                      const residuo = Math.max(0, totale - getPaidAmountWithTotal(cap, totale));
                      return sum + residuo;
                    }, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
