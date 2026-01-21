import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, PlusCircle, Printer, Trash2, Upload } from 'lucide-react';
import { PublicLodgeConfig } from '../types/lodge';
import { FiscalEntry, FiscalEntryType, FiscalSection, RendicontoFiscale } from '../types';
import { dataService } from '../services/dataService';
import { RENDICONTO_CATEGORIES, RENDICONTO_SECTION_LABELS } from '../constants';

interface RendicontoFiscaleProps {
  selectedYear: number;
  lodge?: PublicLodgeConfig | null;
}

type ActiveTab = 'CONTO_1' | 'CONTO_2' | 'CONTO_3' | 'CASSA' | 'RENDICONTO';
type EntryTypeOption = 'ENTRATA' | 'USCITA' | 'ENTRATA_CASSA' | 'USCITA_CASSA';

const formatEuro = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);

const parseAmount = (value: string): number => {
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9\-\.]/g, '').trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    throw new Error(`Importo non valido: "${value}"`);
  }
  return num;
};

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

const parseDate = (value: string, selectedYear: number): string => {
  const v = value.trim();
  if (!v) {
    throw new Error('Data mancante');
  }
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    if (year !== selectedYear) {
      throw new Error(`Data fuori anno selezionato (${selectedYear}): ${v}`);
    }
    return v;
  }
  const slashMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = Number(slashMatch[3]);
    if (year !== selectedYear) {
      throw new Error(`Data fuori anno selezionato (${selectedYear}): ${v}`);
    }
    return `${year}-${month}-${day}`;
  }
  const shortMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (shortMatch) {
    const day = shortMatch[1].padStart(2, '0');
    const month = shortMatch[2].padStart(2, '0');
    return `${selectedYear}-${month}-${day}`;
  }
  throw new Error(`Formato data non riconosciuto: "${value}"`);
};

const detectDelimiter = (line: string): string => {
  const semicolon = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  const tab = (line.match(/\t/g) || []).length;
  if (tab >= semicolon && tab >= comma) return '\t';
  if (semicolon >= comma) return ';';
  return ',';
};

const parseCsv = (content: string) => {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) {
    throw new Error('CSV vuoto o senza righe leggibili');
  }
  const delimiter = detectDelimiter(lines[0]);
  const rows: string[][] = [];

  lines.forEach(line => {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && char === delimiter) {
        row.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    row.push(current.trim());
    rows.push(row);
  });

  if (!rows.length) {
    throw new Error('CSV senza righe utili');
  }
  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
};

const CASH_OUT_LABEL = 'Prelievo per cassa';
const CASH_IN_LABEL = 'Versamento da cassa';
const getAccountLabel = (name: string | undefined, fallback: string) => (name && name.trim() ? name.trim() : fallback);
const getAccountTransferDescription = (accountName: string, transfer: 'OUT' | 'IN') =>
  transfer === 'OUT' ? CASH_OUT_LABEL : `Versamento su conto ${accountName}`;
const getCashTransferDescription = (accountName: string, transfer: 'OUT' | 'IN') =>
  transfer === 'OUT' ? `Prelievo da ${accountName}` : CASH_IN_LABEL;
const PRINT_TYPE_LABELS: Record<string, string> = {
  ENTRATA: 'Entrata',
  USCITA: 'Uscita',
  ENTRATA_CASSA: 'Entrata per cassa',
  USCITA_CASSA: 'Uscita per cassa',
};

const guessHeader = (headers: string[], variants: string[]) => {
  const lower = headers.map(h => h.toLowerCase());
  const idx = lower.findIndex(h => variants.some(v => h.includes(v)));
  return idx >= 0 ? headers[idx] : '';
};

const normalizeType = (value: string): FiscalEntryType | null => {
  const v = value.toLowerCase();
  if (v.includes('dare') || v.includes('uscita') || v.includes('addebito') || v.includes('debit')) return 'USCITA';
  if (v.includes('avere') || v.includes('entrata') || v.includes('accredito') || v.includes('credit')) return 'ENTRATA';
  return null;
};

const defaultEntry = (year: number): FiscalEntry => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `entry_${Date.now()}_${Math.random()}`,
  date: `${year}-01-01`,
  description: '',
  amount: 0,
  type: 'ENTRATA',
  section: 'A',
  categoryLabel: '',
});

export const RendicontoFiscale: React.FC<RendicontoFiscaleProps> = ({ selectedYear, lodge }) => {
  const [data, setData] = useState<RendicontoFiscale | null>(null);
  const dataRef = useRef<RendicontoFiscale | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('CONTO_1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  const [importTarget, setImportTarget] = useState<{ tab: ActiveTab; accountId?: string } | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMap, setImportMap] = useState<{ date?: string; description?: string; amount?: string; debit?: string; credit?: string; type?: string }>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await dataService.getRendicontoFiscale(selectedYear);
        setData(res);
      } catch (err: any) {
        setError(err?.message || 'Errore caricamento rendiconto fiscale');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const categoriesByType = useMemo(() => {
    return {
      ENTRATA: RENDICONTO_CATEGORIES.filter(c => c.type === 'ENTRATA'),
      USCITA: RENDICONTO_CATEGORIES.filter(c => c.type === 'USCITA'),
    } as Record<FiscalEntryType, typeof RENDICONTO_CATEGORIES>;
  }, []);

  const allEntries = useMemo(() => {
    if (!data) return [];
    const accountsEntries = data.accounts.flatMap(a => a.entries);
    return [...accountsEntries, ...data.cash.entries];
  }, [data]);

  const totalsBySection = useMemo(() => {
    const totals: Record<FiscalSection, { entrate: number; uscite: number }> = {
      A: { entrate: 0, uscite: 0 },
      B: { entrate: 0, uscite: 0 },
      C: { entrate: 0, uscite: 0 },
      D: { entrate: 0, uscite: 0 },
      E: { entrate: 0, uscite: 0 },
    };
    allEntries.forEach(entry => {
      if (entry.cashTransfer) return;
      if (entry.type === 'ENTRATA') totals[entry.section].entrate += entry.amount;
      else totals[entry.section].uscite += entry.amount;
    });
    return totals;
  }, [allEntries]);

  const initialTotal = useMemo(() => {
    if (!data) return 0;
    const accountsInit = data.accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0);
    return accountsInit + (data.cash.initialBalance || 0);
  }, [data]);

  const entriesTotals = useMemo(() => {
    let entrate = 0;
    let uscite = 0;
    allEntries.forEach(entry => {
      if (entry.cashTransfer) return;
      if (entry.type === 'ENTRATA') entrate += entry.amount;
      else uscite += entry.amount;
    });
    return { entrate, uscite };
  }, [allEntries]);

  const finalTotal = initialTotal + entriesTotals.entrate - entriesTotals.uscite;

  const handleAutoSave = async () => {
    const current = dataRef.current;
    if (!current) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const accountByEntryId = new Map<string, string>();
      current.accounts.forEach((account, index) => {
        const accountName = getAccountLabel(account.name, `Conto ${index + 1}`);
        account.entries.forEach(entry => {
          accountByEntryId.set(entry.id, accountName);
        });
      });
      const normalized: RendicontoFiscale = {
        ...current,
        accounts: current.accounts.map((account, index) => ({
          ...account,
          entries: account.entries.map(entry => {
            if (!entry.cashTransfer) return entry;
            const accountName = getAccountLabel(account.name, `Conto ${index + 1}`);
            const description = getAccountTransferDescription(accountName, entry.cashTransfer);
            return {
              ...entry,
              description,
              categoryId: undefined,
              categoryLabel: '',
              section: 'A',
            };
          }),
        })),
        cash: {
          ...current.cash,
          entries: current.cash.entries.map(entry => {
            if (!entry.cashTransfer) return entry;
            const accountName = entry.linkedAccountEntryId
              ? accountByEntryId.get(entry.linkedAccountEntryId) || 'Conto'
              : 'Conto';
            const description = getCashTransferDescription(accountName, entry.cashTransfer);
            return {
              ...entry,
              description,
              categoryId: undefined,
              categoryLabel: '',
              section: 'A',
            };
          }),
        },
      };
      const saved = await dataService.saveRendicontoFiscale(normalized);
      setData(saved);
    } catch (err: any) {
      setError(err?.message || 'Errore salvataggio rendiconto fiscale');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  const updateDraft = (key: string, value: string) => {
    setAmountDrafts(prev => ({ ...prev, [key]: value }));
  };

  const updateDateDraft = (key: string, value: string) => {
    setDateDrafts(prev => ({ ...prev, [key]: value }));
  };

  const commitDraft = (key: string, raw: string, onCommit: (value: number) => void) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onCommit(0);
      updateDraft(key, formatAmount(0));
      return;
    }

    const value = parseAmount(trimmed);
    onCommit(value);

    const cleaned = trimmed.replace(/\s/g, '');
    if (cleaned.includes(',') || cleaned.includes('.')) {
      const display = cleaned.includes(',')
        ? cleaned.replace(/\./g, '')
        : cleaned.replace(/,/g, '').replace(/\./g, ',');
      updateDraft(key, display);
      return;
    }

    updateDraft(key, `${cleaned.replace(/\./g, '')},00`);
  };

  const getDraftValue = (key: string, fallback: number) =>
    amountDrafts[key] ?? formatAmount(fallback);

  const formatDayMonth = (isoDate: string): string => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';
    const day = parts[2];
    const month = parts[1];
    return `${day}/${month}`;
  };

  const toIsoFromDayMonth = (value: string, year: number): string | null => {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(day) || !Number.isFinite(month)) return null;
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
      return null;
    }
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  const getDraftDayMonth = (key: string, isoDate: string) =>
    dateDrafts[key] ?? formatDayMonth(isoDate);

  const scheduleAutoSave = () => {
    setTimeout(() => {
      void handleAutoSave();
    }, 0);
  };

  const updateAccount = (accountId: string, updater: (draft: RendicontoFiscale) => RendicontoFiscale) => {
    setData(prev => (prev ? updater(prev) : prev));
  };

  const updateCash = (updater: (draft: RendicontoFiscale) => RendicontoFiscale) => {
    setData(prev => (prev ? updater(prev) : prev));
  };

  const handleAddEntry = (tab: ActiveTab) => {
    if (!data) return;
    if (tab === 'CASSA') {
      updateCash(prev => ({
        ...prev,
        cash: {
          ...prev.cash,
          entries: [...prev.cash.entries, defaultEntry(selectedYear)],
        },
      }));
      return;
    }
    const accountId = tab === 'CONTO_1' ? '1' : tab === 'CONTO_2' ? '2' : '3';
    updateAccount(accountId, prev => ({
      ...prev,
      accounts: prev.accounts.map(acc =>
        acc.id === accountId ? { ...acc, entries: [...acc.entries, defaultEntry(selectedYear)] } : acc
      ),
    }));
  };

  const handleRemoveEntry = (tab: ActiveTab, entryId: string) => {
    if (!data) return;
    if (tab === 'CASSA') {
      updateCash(prev => ({
        ...prev,
        cash: {
          ...prev.cash,
          entries: prev.cash.entries.filter(e => e.id !== entryId),
        },
      }));
      scheduleAutoSave();
      return;
    }
    const accountId = tab === 'CONTO_1' ? '1' : tab === 'CONTO_2' ? '2' : '3';
    updateAccount(accountId, prev => {
      const entryToRemove = prev.accounts
        .find(acc => acc.id === accountId)
        ?.entries.find(e => e.id === entryId);
      const linkedCashEntryId = entryToRemove?.linkedCashEntryId;
      const accounts = prev.accounts.map(acc =>
        acc.id === accountId ? { ...acc, entries: acc.entries.filter(e => e.id !== entryId) } : acc
      );
      const cashEntries = linkedCashEntryId
        ? prev.cash.entries.filter(e => e.id !== linkedCashEntryId)
        : prev.cash.entries;
      return {
        ...prev,
        accounts,
        cash: {
          ...prev.cash,
          entries: cashEntries,
        },
      };
    });
    scheduleAutoSave();
  };

  const handleEntryChange = (
    tab: ActiveTab,
    entryId: string,
    patch: Partial<FiscalEntry>
  ) => {
    if (!data) return;

    if (tab === 'CASSA') {
      updateCash(prev => {
        const entries = prev.cash.entries.map(e => {
          if (e.id !== entryId) return e;
          if (e.cashTransfer) return e;
          return { ...e, ...patch };
        });
        return {
          ...prev,
          cash: {
            ...prev.cash,
            entries,
          },
        };
      });
      return;
    }

    const accountId = tab === 'CONTO_1' ? '1' : tab === 'CONTO_2' ? '2' : '3';
    updateAccount(accountId, prev => {
      let linkedCashEntryId: string | undefined;
      let updatedEntry: FiscalEntry | null = null;
      const accounts = prev.accounts.map(acc => {
        if (acc.id !== accountId) return acc;
        const entries = acc.entries.map(entry => {
          if (entry.id !== entryId) return entry;
          const next = { ...entry, ...patch } as FiscalEntry;
          if (next.cashTransfer && !next.linkedCashEntryId) {
            next.linkedCashEntryId = `cash_${next.id}`;
          }
          linkedCashEntryId = next.linkedCashEntryId;
          updatedEntry = next;
          return next;
        });
        return { ...acc, entries };
      });

      if (!linkedCashEntryId || !updatedEntry?.cashTransfer) {
        return { ...prev, accounts };
      }

      const source = accounts
        .flatMap(a => a.entries)
        .find(e => e.linkedCashEntryId === linkedCashEntryId);
      if (!source) {
        return { ...prev, accounts };
      }

      const description = source.cashTransfer === 'OUT' ? CASH_OUT_LABEL : CASH_IN_LABEL;
      const cashType = source.cashTransfer === 'OUT' ? 'ENTRATA' : 'USCITA';
      const existing = prev.cash.entries.find(entry => entry.id === linkedCashEntryId);
      const nextCashEntry: FiscalEntry = {
        ...(existing || defaultEntry(selectedYear)),
        id: linkedCashEntryId,
        date: source.date,
        amount: source.amount,
        type: cashType,
        description,
        categoryId: undefined,
        categoryLabel: '',
        section: 'A',
        cashTransfer: source.cashTransfer,
        linkedAccountEntryId: source.id,
      };

      const cashEntries = existing
        ? prev.cash.entries.map(entry => (entry.id === linkedCashEntryId ? nextCashEntry : entry))
        : [...prev.cash.entries, nextCashEntry];

      return {
        ...prev,
        accounts,
        cash: {
          ...prev.cash,
          entries: cashEntries,
        },
      };
    });
  };

  const sortEntriesByDate = (entries: FiscalEntry[]) => {
    return entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const dateCompare = a.entry.date.localeCompare(b.entry.date);
        if (dateCompare !== 0) return dateCompare;
        return a.index - b.index;
      })
      .map(item => item.entry);
  };

  const handleCategoryChange = (tab: ActiveTab, entryId: string, categoryId: string) => {
    const category = RENDICONTO_CATEGORIES.find(c => c.id === categoryId);
    if (!category) {
      handleEntryChange(tab, entryId, { categoryId: undefined, categoryLabel: '', section: 'A' });
      return;
    }
    handleEntryChange(tab, entryId, {
      categoryId: category.id,
      categoryLabel: category.label,
      section: category.section,
      type: category.type,
    });
  };

  const handleEntryTypeChange = (tab: ActiveTab, entryId: string, type: EntryTypeOption) => {
    if (tab === 'CASSA') {
      const baseType: FiscalEntryType = type === 'USCITA' ? 'USCITA' : 'ENTRATA';
      const categories = categoriesByType[baseType];
      handleEntryChange(tab, entryId, {
        type: baseType,
        categoryId: undefined,
        categoryLabel: '',
        section: categories[0]?.section || 'A',
      });
      return;
    }

    const isCashOut = type === 'USCITA_CASSA';
    const isCashIn = type === 'ENTRATA_CASSA';
    const isCashTransfer = isCashOut || isCashIn;
    const baseType: FiscalEntryType = isCashOut ? 'USCITA' : isCashIn ? 'ENTRATA' : (type as FiscalEntryType);
    const description = isCashOut ? CASH_OUT_LABEL : isCashIn ? CASH_IN_LABEL : '';

    updateAccount(tab === 'CONTO_1' ? '1' : tab === 'CONTO_2' ? '2' : '3', prev => {
      let updatedEntry: FiscalEntry | null = null;
      let activeAccountName = 'Conto';
      const accounts = prev.accounts.map((acc, index) => {
        if (acc.id !== (tab === 'CONTO_1' ? '1' : tab === 'CONTO_2' ? '2' : '3')) return acc;
        const accountName = getAccountLabel(acc.name, `Conto ${index + 1}`);
        activeAccountName = accountName;
        const entries = acc.entries.map(entry => {
          if (entry.id !== entryId) return entry;
          const next: FiscalEntry = {
            ...entry,
            type: baseType,
            cashTransfer: isCashTransfer ? (isCashOut ? 'OUT' : 'IN') : undefined,
            linkedCashEntryId: isCashTransfer ? entry.linkedCashEntryId || `cash_${entry.id}` : undefined,
            categoryId: isCashTransfer ? undefined : entry.categoryId,
            categoryLabel: isCashTransfer ? '' : entry.categoryLabel,
            section: isCashTransfer ? 'A' : entry.section,
            description: isCashTransfer
              ? getAccountTransferDescription(accountName, isCashOut ? 'OUT' : 'IN')
              : entry.description,
          };
          updatedEntry = next;
          return next;
        });
        return { ...acc, entries };
      });

      let cashEntries = prev.cash.entries;
      if (updatedEntry?.cashTransfer) {
        const linkedId = updatedEntry.linkedCashEntryId || `cash_${updatedEntry.id}`;
        const cashType: FiscalEntryType = updatedEntry.cashTransfer === 'OUT' ? 'ENTRATA' : 'USCITA';
        const cashDescription = getCashTransferDescription(activeAccountName, updatedEntry.cashTransfer);
        const existing = prev.cash.entries.find(e => e.id === linkedId);
        const nextCashEntry: FiscalEntry = {
          ...(existing || defaultEntry(selectedYear)),
          id: linkedId,
          date: updatedEntry.date,
          description: cashDescription,
          amount: updatedEntry.amount,
          type: cashType,
          section: 'A',
          categoryId: undefined,
          categoryLabel: '',
          cashTransfer: updatedEntry.cashTransfer,
          linkedAccountEntryId: updatedEntry.id,
        };
        cashEntries = existing
          ? prev.cash.entries.map(entry => (entry.id === linkedId ? nextCashEntry : entry))
          : [...prev.cash.entries, nextCashEntry];
      } else if (updatedEntry && updatedEntry.linkedCashEntryId) {
        cashEntries = prev.cash.entries.filter(e => e.id !== updatedEntry.linkedCashEntryId);
      }

      return {
        ...prev,
        accounts,
        cash: {
          ...prev.cash,
          entries: cashEntries,
        },
      };
    });
  };

  const handleImportFile = (tab: ActiveTab, accountId?: string) => {
    setImportError(null);
    setImportHeaders([]);
    setImportRows([]);
    setImportMap({});
    setImportTarget({ tab, accountId });
  };

  const applyImport = () => {
    if (!data || !importTarget) return;
    if (!importMap.date || !importMap.description) {
      setImportError('Seleziona almeno Data e Descrizione per l\'import');
      return;
    }
    if (!importMap.amount && !importMap.debit && !importMap.credit) {
      setImportError('Seleziona un campo Importo o le colonne Dare/Avere');
      return;
    }

    const entries: FiscalEntry[] = [];

    importRows.forEach((row, index) => {
      try {
        const find = (header?: string) => {
          if (!header) return '';
          const idx = importHeaders.indexOf(header);
          return idx >= 0 ? row[idx] || '' : '';
        };
        const parseOptionalAmount = (value: string) => (value.trim() ? parseAmount(value) : 0);
        const dateValue = parseDate(find(importMap.date), selectedYear);
        const description = find(importMap.description);
        if (!description) {
          throw new Error(`Descrizione mancante alla riga ${index + 2}`);
        }

        let type: FiscalEntryType = 'ENTRATA';
        let amount = 0;

        if (importMap.amount) {
          const amountCell = find(importMap.amount);
          if (!amountCell.trim()) {
            throw new Error(`Importo mancante alla riga ${index + 2}`);
          }
          const rawAmount = parseAmount(amountCell);
          const explicitType = importMap.type ? normalizeType(find(importMap.type)) : null;
          if (explicitType) {
            type = explicitType;
            amount = Math.abs(rawAmount);
          } else {
            type = rawAmount < 0 ? 'USCITA' : 'ENTRATA';
            amount = Math.abs(rawAmount);
          }
        } else {
          const debitRaw = importMap.debit ? parseOptionalAmount(find(importMap.debit)) : 0;
          const creditRaw = importMap.credit ? parseOptionalAmount(find(importMap.credit)) : 0;
          if (creditRaw > 0) {
            type = 'ENTRATA';
            amount = Math.abs(creditRaw);
          } else if (debitRaw > 0) {
            type = 'USCITA';
            amount = Math.abs(debitRaw);
          } else {
            throw new Error(`Importo nullo alla riga ${index + 2}`);
          }
        }

        entries.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `entry_${Date.now()}_${index}`,
          date: dateValue,
          description,
          amount,
          type,
          section: 'A',
          categoryLabel: '',
        });
      } catch (err: any) {
        throw new Error(err?.message || `Errore importazione riga ${index + 2}`);
      }
    });

    if (importTarget.tab === 'CASSA') {
      updateCash(prev => ({
        ...prev,
        cash: {
          ...prev.cash,
          entries: [...prev.cash.entries, ...entries],
        },
      }));
    } else {
      const accountId = importTarget.accountId || (importTarget.tab === 'CONTO_1' ? '1' : importTarget.tab === 'CONTO_2' ? '2' : '3');
      updateAccount(accountId, prev => ({
        ...prev,
        accounts: prev.accounts.map(acc =>
          acc.id === accountId ? { ...acc, entries: [...acc.entries, ...entries] } : acc
        ),
      }));
    }

    setImportTarget(null);
    setImportHeaders([]);
    setImportRows([]);
    setImportMap({});
    setImportError(null);
    scheduleAutoSave();
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Rendiconto fiscale - ${selectedYear}`;
    window.print();
    document.title = originalTitle;
  };

  const renderEntryRow = (tab: ActiveTab, entry: FiscalEntry, progressivo: number, accountName?: string) => {
    const categories = categoriesByType[entry.type];
    const isCashTransfer = Boolean(entry.cashTransfer);
    const isCashTabLocked = tab === 'CASSA' && isCashTransfer;
    const typeValue: EntryTypeOption = entry.cashTransfer
      ? entry.cashTransfer === 'OUT'
        ? 'USCITA_CASSA'
        : 'ENTRATA_CASSA'
      : entry.type;
    const fixedDescription = entry.cashTransfer
      ? tab === 'CASSA'
        ? getCashTransferDescription(accountName || 'Conto', entry.cashTransfer)
        : getAccountTransferDescription(accountName || 'Conto', entry.cashTransfer)
      : entry.description;
    const needsAttention = !isCashTransfer && (!entry.description.trim() || !entry.categoryId);
    const saldoClass = progressivo >= 0 ? 'text-emerald-700' : 'text-red-600';
    return (
      <tr key={entry.id} className={`border-b border-slate-100 text-xs ${needsAttention ? 'bg-yellow-200' : ''}`}>
        <td className="px-2 py-1">
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="GG/MM"
              value={getDraftDayMonth(`entry:${entry.id}:date`, entry.date)}
              onChange={e => {
                const raw = e.target.value;
                updateDateDraft(`entry:${entry.id}:date`, raw);
                const iso = toIsoFromDayMonth(raw, selectedYear);
                if (iso) {
                  handleEntryChange(tab, entry.id, { date: iso });
                }
              }}
              onBlur={e => {
                const raw = e.target.value;
                const iso = toIsoFromDayMonth(raw, selectedYear);
                if (iso) {
                  handleEntryChange(tab, entry.id, { date: iso });
                  updateDateDraft(`entry:${entry.id}:date`, formatDayMonth(iso));
                } else {
                  updateDateDraft(`entry:${entry.id}:date`, formatDayMonth(entry.date));
                }
                handleAutoSave();
              }}
              onFocus={e => e.currentTarget.select()}
              disabled={isCashTabLocked}
              className="w-16 border border-slate-200 rounded-md px-2 py-1 text-xs disabled:bg-slate-100"
            />
            <span className="text-[10px] text-slate-400">/{selectedYear}</span>
          </div>
        </td>
        <td className="px-2 py-1">
          <input
            type="text"
            value={fixedDescription}
            onChange={e => handleEntryChange(tab, entry.id, { description: e.target.value })}
            onBlur={handleAutoSave}
            disabled={isCashTransfer || isCashTabLocked}
            className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs disabled:bg-slate-100"
          />
        </td>
        <td className="px-2 py-1">
          <select
            value={typeValue}
            onChange={e => handleEntryTypeChange(tab, entry.id, e.target.value as EntryTypeOption)}
            onBlur={handleAutoSave}
            disabled={isCashTabLocked}
            className="w-28 border border-slate-200 rounded-md px-2 py-1 text-xs disabled:bg-slate-100"
          >
            <option value="ENTRATA">Entrata</option>
            <option value="USCITA">Uscita</option>
            {tab !== 'CASSA' && (
              <>
                <option value="ENTRATA_CASSA">Entrata per cassa</option>
                <option value="USCITA_CASSA">Uscita per cassa</option>
              </>
            )}
          </select>
        </td>
        <td className="px-2 py-1">
          <input
            type="text"
            inputMode="decimal"
            value={getDraftValue(`entry:${entry.id}:amount`, entry.amount)}
            onChange={e => {
              const raw = e.target.value;
              updateDraft(`entry:${entry.id}:amount`, raw);
              try {
                const value = parseAmount(raw);
                handleEntryChange(tab, entry.id, { amount: value });
              } catch {
                // ignore invalid intermediate input
              }
            }}
            onBlur={e => {
              commitDraft(`entry:${entry.id}:amount`, e.target.value, (value) => {
                handleEntryChange(tab, entry.id, { amount: value });
              });
              handleAutoSave();
            }}
            onFocus={e => e.currentTarget.select()}
            disabled={isCashTabLocked}
            className="w-20 border border-slate-200 rounded-md px-2 py-1 text-xs text-right disabled:bg-slate-100"
          />
        </td>
        <td className="px-2 py-1">
          <select
            value={entry.categoryId || ''}
            onChange={e => handleCategoryChange(tab, entry.id, e.target.value)}
            onBlur={handleAutoSave}
            disabled={isCashTransfer || isCashTabLocked}
            className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs disabled:bg-slate-100"
          >
            <option value="">Seleziona categoria...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1 text-xs text-slate-600">
          {RENDICONTO_SECTION_LABELS[entry.section]}
        </td>
        <td className="px-2 py-1 text-right">
          <button
            onClick={() => handleRemoveEntry(tab, entry.id)}
            onBlur={handleAutoSave}
            disabled={isCashTabLocked}
            className="text-red-600 hover:text-red-700 disabled:text-slate-300"
            title="Rimuovi"
          >
            <Trash2 size={16} />
          </button>
        </td>
        <td className={`px-2 py-1 text-right font-medium ${saldoClass}`}>
          {formatEuro(progressivo)}
        </td>
      </tr>
    );
  };

  const renderPrintHeader = () => (
    <div className="text-sm text-slate-600 mb-4">
      <div className="font-semibold">{lodge?.associationName}</div>
      <div>{[lodge?.address, [lodge?.zipCode, lodge?.city].filter(Boolean).join(' ')].filter(Boolean).join(' - ')}</div>
      <div>CF: {lodge?.taxCode}</div>
    </div>
  );

  const renderMovimentiTable = (entries: FiscalEntry[], label: string, initialBalance: number, accountByEntryId: Map<string, string>) => (
    <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
      {renderPrintHeader()}
      <h2 className="text-lg font-semibold text-slate-900 mb-2">{label}</h2>
      <table className="w-full text-xs border border-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-2 py-1 text-left">Data</th>
            <th className="px-2 py-1 text-left">Descrizione</th>
            <th className="px-2 py-1 text-left">Categoria contabile</th>
            <th className="px-2 py-1 text-left">Tipo</th>
            <th className="px-2 py-1 text-right">Importo</th>
            <th className="px-2 py-1 text-right">Saldo progressivo</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let running = initialBalance || 0;
            return sortEntriesByDate(entries).map(entry => {
            const typeLabel = entry.cashTransfer
              ? entry.cashTransfer === 'OUT'
                ? PRINT_TYPE_LABELS.USCITA_CASSA
                : PRINT_TYPE_LABELS.ENTRATA_CASSA
              : PRINT_TYPE_LABELS[entry.type] || entry.type;
              const accountName = entry.linkedAccountEntryId
                ? accountByEntryId.get(entry.linkedAccountEntryId) || 'Conto'
                : 'Conto';
              const categoryLabel = entry.cashTransfer ? '-' : entry.categoryLabel || '-';
            const delta = entry.type === 'ENTRATA' ? entry.amount : -entry.amount;
            running += delta;
            const saldoClass = running >= 0 ? 'text-emerald-700' : 'text-red-600';
              const description = entry.cashTransfer
                ? getCashTransferDescription(accountName, entry.cashTransfer)
                : entry.description;
            return (
              <tr key={entry.id} className="border-b border-slate-200">
                <td className="px-2 py-1">{entry.date}</td>
                  <td className="px-2 py-1">{description}</td>
                  <td className="px-2 py-1">{categoryLabel}</td>
                <td className="px-2 py-1">{typeLabel}</td>
                <td className="px-2 py-1 text-right">{formatEuro(entry.amount)}</td>
                <td className={`px-2 py-1 text-right font-medium ${saldoClass}`}>{formatEuro(running)}</td>
              </tr>
            );
            });
          })()}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return <div className="text-center py-12">Caricamento rendiconto fiscale...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4">
        Nessun rendiconto disponibile.
      </div>
    );
  }

  const missingFiscalFields = [
    !lodge?.associationName ? 'associationName' : null,
    !lodge?.taxCode ? 'taxCode' : null,
    !lodge?.address ? 'address' : null,
    !lodge?.city ? 'city' : null,
  ].filter(Boolean);

  if (missingFiscalFields.length) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        Dati fiscali mancanti nel registry: {missingFiscalFields.join(', ')}.
      </div>
    );
  }

  const accountTabs = data.accounts.map((acc, idx) => ({
    id: `CONTO_${idx + 1}` as ActiveTab,
    label: acc.name || `Conto ${idx + 1}`,
    accountId: acc.id,
  }));

  const activeAccount = data.accounts.find(acc =>
    (activeTab === 'CONTO_1' && acc.id === '1') ||
    (activeTab === 'CONTO_2' && acc.id === '2') ||
    (activeTab === 'CONTO_3' && acc.id === '3')
  );
  const activeAccountFinalBalance = activeAccount
    ? (activeAccount.initialBalance || 0) + activeAccount.entries.reduce((sum, entry) => {
        const delta = entry.type === 'ENTRATA' ? entry.amount : -entry.amount;
        return sum + delta;
      }, 0)
    : 0;
  const cashFinalBalance = (data.cash.initialBalance || 0) + data.cash.entries.reduce((sum, entry) => {
    const delta = entry.type === 'ENTRATA' ? entry.amount : -entry.amount;
    return sum + delta;
  }, 0);

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-serif font-bold text-slate-900">Rendiconto fiscale</h3>
            {saving && (
              <span className="text-xs text-amber-600 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Salvataggio...
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">Modello D (criterio di cassa) - anno {selectedYear}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            disabled={activeTab !== 'RENDICONTO'}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Printer size={16} /> Stampa
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 print:hidden">
        {accountTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 md:px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              activeTab === tab.id
                ? 'border-slate-800 text-slate-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('CASSA')}
          className={`px-4 md:px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
            activeTab === 'CASSA'
              ? 'border-slate-800 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Cassa
        </button>
        <button
          onClick={() => setActiveTab('RENDICONTO')}
          className={`px-4 md:px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
            activeTab === 'RENDICONTO'
              ? 'border-slate-800 text-slate-900 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Rendiconto
        </button>
      </div>

      {(activeTab === 'CONTO_1' || activeTab === 'CONTO_2' || activeTab === 'CONTO_3') && activeAccount && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nome conto</label>
                <input
                  type="text"
                  value={activeAccount.name}
                  onChange={e =>
                    updateAccount(activeAccount.id, prev => {
                      let updatedAccountName = '';
                      const accounts = prev.accounts.map((acc, index) => {
                        if (acc.id !== activeAccount.id) return acc;
                        const nextName = e.target.value;
                        const accountName = getAccountLabel(nextName, `Conto ${index + 1}`);
                        updatedAccountName = accountName;
                        return {
                          ...acc,
                          name: nextName,
                          entries: acc.entries.map(entry => {
                            if (!entry.cashTransfer) return entry;
                            if (entry.cashTransfer === 'OUT') {
                              return { ...entry, description: CASH_OUT_LABEL };
                            }
                            return {
                              ...entry,
                              description: getAccountTransferDescription(accountName, 'IN'),
                            };
                          }),
                        };
                      });

                      const cashEntries = prev.cash.entries.map(entry => {
                        if (!entry.cashTransfer || !entry.linkedAccountEntryId) return entry;
                        if (entry.linkedAccountEntryId && updatedAccountName) {
                          if (entry.cashTransfer === 'OUT') {
                            return { ...entry, description: getCashTransferDescription(updatedAccountName, 'OUT') };
                          }
                          return { ...entry, description: getCashTransferDescription(updatedAccountName, 'IN') };
                        }
                        return entry;
                      });

                      return {
                        ...prev,
                        accounts,
                        cash: {
                          ...prev.cash,
                          entries: cashEntries,
                        },
                      };
                    })
                  }
                  onBlur={handleAutoSave}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Saldo iniziale</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={getDraftValue(`account:${activeAccount.id}:initial`, activeAccount.initialBalance || 0)}
                  onChange={e => {
                    const raw = e.target.value;
                    updateDraft(`account:${activeAccount.id}:initial`, raw);
                    try {
                      const value = parseAmount(raw);
                      updateAccount(activeAccount.id, prev => ({
                        ...prev,
                        accounts: prev.accounts.map(acc =>
                          acc.id === activeAccount.id
                            ? { ...acc, initialBalance: value }
                            : acc
                        ),
                      }));
                    } catch {
                      // ignore invalid intermediate input
                    }
                  }}
                  onBlur={e => {
                    commitDraft(`account:${activeAccount.id}:initial`, e.target.value, (value) => {
                      updateAccount(activeAccount.id, prev => ({
                        ...prev,
                        accounts: prev.accounts.map(acc =>
                          acc.id === activeAccount.id
                            ? { ...acc, initialBalance: value }
                            : acc
                        ),
                      }));
                    });
                    handleAutoSave();
                  }}
                  onFocus={e => e.currentTarget.select()}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Saldo finale</label>
                <input
                  type="text"
                  value={formatEuro(activeAccountFinalBalance)}
                  disabled
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-slate-100 text-slate-700"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => handleAddEntry(activeTab)}
                  className="px-3 py-2 rounded-md bg-masonic-gold text-white text-sm flex items-center gap-2"
                >
                  <PlusCircle size={16} /> Nuova riga
                </button>
                <button
                  onClick={() => handleImportFile(activeTab, activeAccount.id)}
                  className="px-3 py-2 rounded-md bg-white border border-slate-300 text-slate-700 text-sm flex items-center gap-2"
                >
                  <Upload size={16} /> Importa CSV
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto print:hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Data</th>
                  <th className="px-2 py-1 text-left w-1/3">Descrizione</th>
                  <th className="px-2 py-1 text-left w-28">Tipo</th>
                  <th className="px-2 py-1 text-right w-24">Importo</th>
                  <th className="px-2 py-1 text-left">Categoria</th>
                  <th className="px-2 py-1 text-left">Sezione</th>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1 text-right">Saldo progressivo</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let running = activeAccount.initialBalance || 0;
                  return sortEntriesByDate(activeAccount.entries).map(entry => {
                    const delta = entry.type === 'ENTRATA' ? entry.amount : -entry.amount;
                    running += delta;
                    const accountName = getAccountLabel(activeAccount.name, `Conto ${activeTab === 'CONTO_1' ? 1 : activeTab === 'CONTO_2' ? 2 : 3}`);
                    return renderEntryRow(activeTab, entry, running, accountName);
                  });
                })()}
                {activeAccount.entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-slate-400 text-xs">
                      Nessuna riga presente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'CASSA' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Saldo iniziale</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={getDraftValue('cash:initial', data.cash.initialBalance || 0)}
                  onChange={e => {
                    const raw = e.target.value;
                    updateDraft('cash:initial', raw);
                    try {
                      const value = parseAmount(raw);
                      updateCash(prev => ({
                        ...prev,
                        cash: { ...prev.cash, initialBalance: value },
                      }));
                    } catch {
                      // ignore invalid intermediate input
                    }
                  }}
                  onBlur={e => {
                    commitDraft('cash:initial', e.target.value, (value) => {
                      updateCash(prev => ({
                        ...prev,
                        cash: { ...prev.cash, initialBalance: value },
                      }));
                    });
                    handleAutoSave();
                  }}
                  onFocus={e => e.currentTarget.select()}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Saldo finale</label>
                <input
                  type="text"
                  value={formatEuro(cashFinalBalance)}
                  disabled
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-slate-100 text-slate-700"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => handleAddEntry('CASSA')}
                  className="px-3 py-2 rounded-md bg-masonic-gold text-white text-sm flex items-center gap-2"
                >
                  <PlusCircle size={16} /> Nuova riga
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto print:hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Data</th>
                  <th className="px-2 py-1 text-left w-1/3">Descrizione</th>
                  <th className="px-2 py-1 text-left w-28">Tipo</th>
                  <th className="px-2 py-1 text-right w-24">Importo</th>
                  <th className="px-2 py-1 text-left">Categoria</th>
                  <th className="px-2 py-1 text-left">Sezione</th>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1 text-right">Saldo progressivo</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let running = data.cash.initialBalance || 0;
                  return sortEntriesByDate(data.cash.entries).map(entry => {
                    const delta = entry.type === 'ENTRATA' ? entry.amount : -entry.amount;
                    running += delta;
                    const accountName = entry.linkedAccountEntryId
                      ? (() => {
                          const found = data.accounts.find(acc => acc.entries.some(e => e.id === entry.linkedAccountEntryId));
                          if (!found) return 'Conto';
                          const idx = data.accounts.indexOf(found);
                          return getAccountLabel(found.name, `Conto ${idx + 1}`);
                        })()
                      : 'Conto';
                    return renderEntryRow('CASSA', entry, running, accountName);
                  });
                })()}
                {data.cash.entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-slate-400 text-xs">
                      Nessuna riga presente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'RENDICONTO' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
            <div>
              <div className="text-sm text-slate-500">Saldo iniziale complessivo</div>
              <div className="text-lg font-semibold text-slate-900">{formatEuro(initialTotal)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Entrate complessive</div>
              <div className="text-lg font-semibold text-emerald-700">{formatEuro(entriesTotals.entrate)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Uscite complessive</div>
              <div className="text-lg font-semibold text-red-600">{formatEuro(entriesTotals.uscite)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Saldo finale</div>
              <div className="text-lg font-semibold text-slate-900">{formatEuro(finalTotal)}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto print:hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Sezione</th>
                  <th className="px-3 py-2 text-right">Entrate</th>
                  <th className="px-3 py-2 text-right">Uscite</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(['A', 'B', 'C', 'D', 'E'] as FiscalSection[]).map(section => {
                  const t = totalsBySection[section];
                  const saldo = t.entrate - t.uscite;
                  return (
                    <tr key={section} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{section} - {RENDICONTO_SECTION_LABELS[section]}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{formatEuro(t.entrate)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatEuro(t.uscite)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">{formatEuro(saldo)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-3 py-2 font-semibold">Totale</td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatEuro(entriesTotals.entrate)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-red-600">{formatEuro(entriesTotals.uscite)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatEuro(entriesTotals.entrate - entriesTotals.uscite)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4 print:hidden">
            <div>
              <label className="text-sm font-medium text-slate-700">Annotazione sul carattere secondario delle attività diverse</label>
              <textarea
                value={data.notes?.secondarietaAttivitaDiverse || ''}
                onChange={e =>
                  setData(prev =>
                    prev
                      ? {
                          ...prev,
                          notes: {
                            ...prev.notes,
                            secondarietaAttivitaDiverse: e.target.value,
                          },
                        }
                      : prev
                  )
                }
                rows={3}
                onBlur={handleAutoSave}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Costi/Proventi figurativi (facoltativo)</label>
              <textarea
                value={data.notes?.costiProventiFigurativi || ''}
                onChange={e =>
                  setData(prev =>
                    prev
                      ? {
                          ...prev,
                          notes: {
                            ...prev.notes,
                            costiProventiFigurativi: e.target.value,
                          },
                        }
                      : prev
                  )
                }
                rows={3}
                onBlur={handleAutoSave}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Firma Presidente</label>
              <input
                type="text"
                value={data.signatureName || ''}
                onChange={e => setData(prev => (prev ? { ...prev, signatureName: e.target.value } : prev))}
                onBlur={handleAutoSave}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="hidden print:block">
            <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
              {renderPrintHeader()}
              <h1 className="text-xl font-bold text-slate-900">Rendiconto per cassa (Modello D)</h1>
              <p className="text-sm text-slate-600 mb-4">Anno {selectedYear}</p>
              <table className="w-full text-sm border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Sezione</th>
                    <th className="px-3 py-2 text-right">Entrate</th>
                    <th className="px-3 py-2 text-right">Uscite</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {(['A', 'B', 'C', 'D', 'E'] as FiscalSection[]).map(section => {
                    const t = totalsBySection[section];
                    const saldo = t.entrate - t.uscite;
                    return (
                      <tr key={section} className="border-b border-slate-200">
                        <td className="px-3 py-2">{section} - {RENDICONTO_SECTION_LABELS[section]}</td>
                        <td className="px-3 py-2 text-right">{formatEuro(t.entrate)}</td>
                        <td className="px-3 py-2 text-right">{formatEuro(t.uscite)}</td>
                        <td className="px-3 py-2 text-right">{formatEuro(saldo)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-6 text-sm">
                <p><strong>Annotazioni attività diverse:</strong> {data.notes?.secondarietaAttivitaDiverse || '-'}</p>
                <p className="mt-2"><strong>Costi/Proventi figurativi:</strong> {data.notes?.costiProventiFigurativi || '-'}</p>
              </div>

              <div className="mt-8 flex justify-end">
                <div className="text-center w-64">
                  <div className="border-t border-slate-400 h-0" />
                  <div className="text-xs mt-2">Firma Presidente: {data.signatureName || '________________'}</div>
                </div>
              </div>
            </div>

            {(() => {
              const accountByEntryId = new Map<string, string>();
              data.accounts.forEach((account, index) => {
                const accountName = getAccountLabel(account.name, `Conto ${index + 1}`);
                account.entries.forEach(entry => {
                  accountByEntryId.set(entry.id, accountName);
                });
              });
              return (
                <>
                  {data.accounts
              .map((account, idx) => ({
                label: `Movimenti ${account.name || `Conto ${idx + 1}`}`,
                entries: account.entries,
                initialBalance: account.initialBalance || 0,
              }))
              .filter(account => account.entries.length > 0)
              .map(account => renderMovimentiTable(account.entries, account.label, account.initialBalance, accountByEntryId))}
                  {data.cash.entries.length > 0
                    ? renderMovimentiTable(data.cash.entries, 'Movimenti Cassa', data.cash.initialBalance || 0, accountByEntryId)
                    : null}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {importTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">Importa CSV</h4>
              <button onClick={() => setImportTarget(null)} className="text-slate-500">✕</button>
            </div>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = evt => {
                  try {
                    const content = String(evt.target?.result || '');
                    const parsed = parseCsv(content);
                    setImportHeaders(parsed.headers);
                    setImportRows(parsed.rows);
                    setImportError(null);
                    const dateGuess = guessHeader(parsed.headers, ['data', 'valuta', 'operazione']);
                    const descGuess = guessHeader(parsed.headers, ['descrizione', 'causale', 'dettaglio', 'operazione']);
                    const amountGuess = guessHeader(parsed.headers, ['importo', 'importo eur', 'importo€', 'ammontare', 'totale']);
                    const debitGuess = guessHeader(parsed.headers, ['dare', 'addebito', 'uscita', 'debit']);
                    const creditGuess = guessHeader(parsed.headers, ['avere', 'accredito', 'entrata', 'credit']);
                    const typeGuess = guessHeader(parsed.headers, ['segno', 'tipo', 'dare/avere', 'operazione']);
                    setImportMap({
                      date: dateGuess,
                      description: descGuess,
                      amount: amountGuess,
                      debit: debitGuess,
                      credit: creditGuess,
                      type: typeGuess,
                    });
                  } catch (err: any) {
                    setImportError(err?.message || 'Errore lettura CSV');
                  }
                };
                reader.readAsText(file, 'utf-8');
              }}
            />

            {importError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                {importError}
              </div>
            )}

            {importHeaders.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { key: 'date', label: 'Data' },
                  { key: 'description', label: 'Descrizione' },
                  { key: 'amount', label: 'Importo (con segno)' },
                  { key: 'debit', label: 'Dare (uscite)' },
                  { key: 'credit', label: 'Avere (entrate)' },
                  { key: 'type', label: 'Tipo (opzionale)' },
                ] as const).map(field => (
                  <label key={field.key} className="text-sm text-slate-600">
                    <span className="block mb-1">{field.label}</span>
                    <select
                      value={(importMap as any)[field.key] || ''}
                      onChange={e => setImportMap(prev => ({ ...prev, [field.key]: e.target.value || undefined }))}
                      className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm"
                    >
                      <option value="">Non usare</option>
                      {importHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setImportTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700"
              >
                Annulla
              </button>
              <button
                onClick={applyImport}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-2"
              >
                <Download size={16} /> Importa righe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
