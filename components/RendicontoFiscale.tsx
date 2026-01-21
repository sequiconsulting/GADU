import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, PlusCircle, Printer, Trash2, X } from 'lucide-react';
import { PublicLodgeConfig } from '../types/lodge';
import type { FiscalEntry, FiscalEntryType, FiscalSection, RendicontoFiscale as RendicontoFiscaleData } from '../types';
import { dataService } from '../services/dataService';
import { RENDICONTO_CATEGORIES, RENDICONTO_SECTION_LABELS } from '../constants';

interface RendicontoFiscaleProps {
  selectedYear: number;
  lodge?: PublicLodgeConfig | null;
}

type ActiveTab = 'CONTO_1' | 'CONTO_2' | 'CONTO_3' | 'CASSA' | 'RENDICONTO';
type EntryTypeOption = 'ENTRATA' | 'USCITA' | 'ENTRATA_CASSA' | 'USCITA_CASSA';
type CategoryTotals = { label: string; entrate: number; uscite: number };

const formatEuro = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);

const parseAmount = (value: string): number => {
  const sanitized = value.replace(/[^0-9,\.\-]/g, '').trim();
  if (!sanitized || sanitized === '-' || sanitized === ',' || sanitized === '.') {
    throw new Error(`Importo non valido: "${value}"`);
  }

  const sign = sanitized.startsWith('-') ? '-' : '';
  const unsigned = sanitized.replace(/-/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  let decimalSep: ',' | '.' | null = null;

  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimalSep = ',';
  } else if (lastDot >= 0) {
    decimalSep = '.';
  }

  let normalized = '';
  if (decimalSep) {
    const splitIndex = unsigned.lastIndexOf(decimalSep);
    const left = unsigned.slice(0, splitIndex).replace(/[.,]/g, '');
    const right = unsigned.slice(splitIndex + 1).replace(/[.,]/g, '');
    normalized = `${left}.${right}`;
  } else {
    normalized = unsigned.replace(/[.,]/g, '');
  }

  const num = Number(`${sign}${normalized}`);
  if (!Number.isFinite(num)) {
    throw new Error(`Importo non valido: "${value}"`);
  }
  return num;
};

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);

const isValidDate = (year: number, month: number, day: number) => {
  const candidate = new Date(year, month - 1, day);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
};

const normalizeDateStrict = (value: string, selectedYear: number, context?: string): string => {
  const v = value.trim();
  const label = context ? `${context}: ` : '';
  if (!v) {
    throw new Error(`${label}Data mancante`);
  }

  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year !== selectedYear) {
      throw new Error(`${label}Data fuori anno selezionato (${selectedYear}): ${v}`);
    }
    if (!isValidDate(year, month, day)) {
      throw new Error(`${label}Data non valida: ${v}`);
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const slashMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    if (year !== selectedYear) {
      throw new Error(`${label}Data fuori anno selezionato (${selectedYear}): ${v}`);
    }
    if (!isValidDate(year, month, day)) {
      throw new Error(`${label}Data non valida: ${v}`);
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const shortMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (shortMatch) {
    const day = Number(shortMatch[1]);
    const month = Number(shortMatch[2]);
    if (!isValidDate(selectedYear, month, day)) {
      throw new Error(`${label}Data non valida: ${v}`);
    }
    return `${selectedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  throw new Error(`${label}Formato data non riconosciuto: "${value}"`);
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
  const [data, setData] = useState<RendicontoFiscaleData | null>(null);
  const dataRef = useRef<RendicontoFiscaleData | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('CONTO_1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ tab: ActiveTab; entryId: string } | null>(null);


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
    const build = (type: FiscalEntryType) => {
      const bySection: Record<FiscalSection, typeof RENDICONTO_CATEGORIES> = {
        A: [],
        B: [],
        C: [],
        D: [],
        E: [],
      };
      RENDICONTO_CATEGORIES.filter(c => c.type === type).forEach(category => {
        bySection[category.section].push(category);
      });
      return bySection;
    };

    return {
      ENTRATA: build('ENTRATA'),
      USCITA: build('USCITA'),
    } as Record<FiscalEntryType, Record<FiscalSection, typeof RENDICONTO_CATEGORIES>>;
  }, []);

  const categoryById = useMemo(() => {
    return new Map(RENDICONTO_CATEGORIES.map(category => [category.id, category]));
  }, []);

  const invalidCategoryIds = useMemo(() => {
    if (!data) return [] as string[];
    const invalid = new Set<string>();
    const scan = (entry: FiscalEntry) => {
      if (entry.categoryId && !categoryById.has(entry.categoryId)) {
        invalid.add(entry.categoryId);
      }
    };
    data.accounts.forEach(account => account.entries.forEach(scan));
    data.cash.entries.forEach(scan);
    return Array.from(invalid);
  }, [data, categoryById]);

  useEffect(() => {
    if (invalidCategoryIds.length) {
      setError(`Categoria contabile non trovata: ${invalidCategoryIds[0]}`);
    }
  }, [invalidCategoryIds]);

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
      const category = entry.categoryId ? categoryById.get(entry.categoryId) : null;
      const section = category?.section || entry.section;
      if (entry.type === 'ENTRATA') totals[section].entrate += entry.amount;
      else totals[section].uscite += entry.amount;
    });
    return totals;
  }, [allEntries, categoryById]);

  const categoryTotalsBySection = useMemo(() => {
    const totals: Record<FiscalSection, Map<string, CategoryTotals>> = {
      A: new Map(),
      B: new Map(),
      C: new Map(),
      D: new Map(),
      E: new Map(),
    };

    allEntries.forEach(entry => {
      if (entry.cashTransfer) return;
      const category = entry.categoryId ? categoryById.get(entry.categoryId) : null;
      const section = category?.section || entry.section;
      const label = entry.categoryLabel || category?.label || 'Senza categoria';
      const key = entry.categoryId || label;
      const current = totals[section].get(key) || { label, entrate: 0, uscite: 0 };
      if (entry.type === 'ENTRATA') current.entrate += entry.amount;
      else current.uscite += entry.amount;
      totals[section].set(key, current);
    });

    return totals;
  }, [allEntries, categoryById]);

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
      const normalizeEntry = (entry: FiscalEntry) => {
        const normalizedDate = normalizeDateStrict(entry.date, current.year, `Data non valida (${entry.id})`);
        if (!entry.categoryId) {
          return { ...entry, date: normalizedDate };
        }
        const category = categoryById.get(entry.categoryId);
        if (!category) {
          throw new Error(`Categoria contabile non trovata: ${entry.categoryId}`);
        }
        return {
          ...entry,
          date: normalizedDate,
          type: category.type,
          section: category.section,
          categoryLabel: category.label,
        };
      };

      const normalized: RendicontoFiscaleData = {
        ...current,
        accounts: current.accounts.map((account, index) => ({
          ...account,
          entries: account.entries.map(entry => {
            if (!entry.cashTransfer) {
              return normalizeEntry(entry);
            }
            const accountName = getAccountLabel(account.name, `Conto ${index + 1}`);
            const description = getAccountTransferDescription(accountName, entry.cashTransfer);
            return {
              ...entry,
              date: normalizeDateStrict(entry.date, current.year, `Data non valida (${entry.id})`),
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
            if (!entry.cashTransfer) {
              return normalizeEntry(entry);
            }
            const accountName = entry.linkedAccountEntryId
              ? accountByEntryId.get(entry.linkedAccountEntryId) || 'Conto'
              : 'Conto';
            const description = getCashTransferDescription(accountName, entry.cashTransfer);
            return {
              ...entry,
              date: normalizeDateStrict(entry.date, current.year, `Data non valida (${entry.id})`),
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
      if (err?.message?.includes('Sessione non attiva')) {
        return;
      }
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

    updateDraft(key, formatAmount(value));
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
    const raw = value.trim();
    let day: number | null = null;
    let month: number | null = null;

    const slashOrDash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (slashOrDash) {
      day = Number(slashOrDash[1]);
      month = Number(slashOrDash[2]);
    } else {
      const compact = raw.match(/^(\d{2})(\d{2})$/);
      if (compact) {
        day = Number(compact[1]);
        month = Number(compact[2]);
      }
    }

    if (day === null || month === null || !Number.isFinite(day) || !Number.isFinite(month)) return null;

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

  const updateAccount = (accountId: string, updater: (draft: RendicontoFiscaleData) => RendicontoFiscaleData) => {
    setData(prev => (prev ? updater(prev) : prev));
  };

  const updateCash = (updater: (draft: RendicontoFiscaleData) => RendicontoFiscaleData) => {
    setData(prev => (prev ? updater(prev) : prev));
  };

  const generateEntryId = () => (crypto.randomUUID ? crypto.randomUUID() : `entry_${Date.now()}_${Math.random()}`);

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

  const handleRequestDeleteEntry = (tab: ActiveTab, entryId: string) => {
    setDeleteConfirmation({ tab, entryId });
  };

  const handleConfirmDeleteEntry = (tab: ActiveTab, entryId: string) => {
    setDeleteConfirmation(null);
    handleRemoveEntry(tab, entryId);
  };

  const handleCancelDeleteEntry = () => {
    setDeleteConfirmation(null);
  };

  const handleDuplicateEntry = (tab: ActiveTab, entryId: string) => {
    setData(prev => {
      if (!prev) return prev;

      if (tab === 'CASSA') {
        const source = prev.cash.entries.find(entry => entry.id === entryId);
        if (!source) return prev;

        const nextCashEntries = [...prev.cash.entries];
        const nextAccounts = prev.accounts.map(acc => ({ ...acc, entries: [...acc.entries] }));

        if (source.cashTransfer && source.linkedAccountEntryId) {
          const accountIndex = nextAccounts.findIndex(acc => acc.entries.some(entry => entry.id === source.linkedAccountEntryId));
          if (accountIndex >= 0) {
            const newAccountId = generateEntryId();
            const newCashId = `cash_${newAccountId}`;
            const accountEntries = nextAccounts[accountIndex].entries;
            const linkedAccountEntry = accountEntries.find(entry => entry.id === source.linkedAccountEntryId);
            if (linkedAccountEntry) {
              accountEntries.push({
                ...linkedAccountEntry,
                id: newAccountId,
                linkedCashEntryId: newCashId,
              });
              nextCashEntries.push({
                ...source,
                id: newCashId,
                linkedAccountEntryId: newAccountId,
              });
            }
          }
        } else {
          nextCashEntries.push({
            ...source,
            id: generateEntryId(),
          });
        }

        return {
          ...prev,
          accounts: nextAccounts,
          cash: {
            ...prev.cash,
            entries: nextCashEntries,
          },
        };
      }

      const accountId = tab === 'CONTO_1' ? '1' : tab === 'CONTO_2' ? '2' : '3';
      const nextAccounts = prev.accounts.map(acc => ({ ...acc, entries: [...acc.entries] }));
      const accountIndex = nextAccounts.findIndex(acc => acc.id === accountId);
      if (accountIndex < 0) return prev;
      const accountEntries = nextAccounts[accountIndex].entries;
      const source = accountEntries.find(entry => entry.id === entryId);
      if (!source) return prev;

      const nextCashEntries = [...prev.cash.entries];

      if (source.cashTransfer) {
        const newAccountId = generateEntryId();
        const newCashId = `cash_${newAccountId}`;
        accountEntries.push({
          ...source,
          id: newAccountId,
          linkedCashEntryId: newCashId,
        });

        const linkedCashEntry = source.linkedCashEntryId
          ? prev.cash.entries.find(entry => entry.id === source.linkedCashEntryId)
          : null;

        if (linkedCashEntry) {
          nextCashEntries.push({
            ...linkedCashEntry,
            id: newCashId,
            linkedAccountEntryId: newAccountId,
          });
        } else {
          nextCashEntries.push({
            ...source,
            id: newCashId,
            type: source.cashTransfer === 'OUT' ? 'ENTRATA' : 'USCITA',
            description: getCashTransferDescription(nextAccounts[accountIndex].name || `Conto ${accountIndex + 1}`, source.cashTransfer),
            categoryId: undefined,
            categoryLabel: '',
            section: 'A',
            linkedAccountEntryId: newAccountId,
          });
        }
      } else {
        accountEntries.push({
          ...source,
          id: generateEntryId(),
        });
      }

      return {
        ...prev,
        accounts: nextAccounts,
        cash: {
          ...prev.cash,
          entries: nextCashEntries,
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

  const dateKey = (value: string) => {
    const base = value.split(/[T\s]/)[0].trim();
    const parts = base.split('-');
    if (parts.length !== 3) return Number.MAX_SAFE_INTEGER;
    const [y, m, d] = parts.map(n => Number(n));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return Number.MAX_SAFE_INTEGER;
    return y * 10000 + m * 100 + d;
  };

  const sortEntriesByDate = (entries: FiscalEntry[]) => {
    return entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const dateCompare = dateKey(a.entry.date) - dateKey(b.entry.date);
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
      const sectionOrder: FiscalSection[] = ['A', 'B', 'C', 'D', 'E'];
      const categories = categoriesByType[baseType];
      const defaultSection = sectionOrder.find(section => categories[section].length > 0) || 'A';
      handleEntryChange(tab, entryId, {
        type: baseType,
        categoryId: undefined,
        categoryLabel: '',
        section: defaultSection,
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

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Rendiconto fiscale - ${selectedYear}`;
    window.print();
    document.title = originalTitle;
  };

  const renderEntryRow = (tab: ActiveTab, entry: FiscalEntry, progressivo: number, accountName?: string) => {
    const sectionOrder: FiscalSection[] = ['A', 'B', 'C', 'D', 'E'];
    const categoriesBySection = categoriesByType[entry.type];
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
    const isDeletePending =
      deleteConfirmation?.tab === tab && deleteConfirmation.entryId === entry.id;
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
            {sectionOrder.map(section => {
              const categories = categoriesBySection[section];
              if (!categories.length) return null;
              return (
                <React.Fragment key={section}>
                  <option disabled value={`__section_${entry.type}_${section}`}>
                    {`── ${section} · ${RENDICONTO_SECTION_LABELS[section]} ──`}
                  </option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </React.Fragment>
              );
            })}
          </select>
        </td>
        <td className="px-2 py-1 text-xs text-slate-600">
          {RENDICONTO_SECTION_LABELS[entry.section]}
        </td>
        <td className="px-2 py-1 text-right">
          {isDeletePending ? (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleConfirmDeleteEntry(tab, entry.id)}
                disabled={isCashTabLocked}
                className="text-emerald-600 hover:text-emerald-700 disabled:text-slate-300"
                title="Sì"
              >
                <Check size={16} />
              </button>
              <button
                onClick={handleCancelDeleteEntry}
                disabled={isCashTabLocked}
                className="text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                title="No"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleDuplicateEntry(tab, entry.id)}
                disabled={isCashTabLocked}
                className="text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                title="Duplica"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={() => handleRequestDeleteEntry(tab, entry.id)}
                onBlur={handleAutoSave}
                disabled={isCashTabLocked}
                className="text-red-600 hover:text-red-700 disabled:text-slate-300"
                title="Rimuovi"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
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

  const renderRendicontoTable = (tableClassName: string, headClassName: string, options?: { isPrint?: boolean }) => {
    const isPrint = options?.isPrint ?? false;
    const cellBase = 'px-3 py-2';
    const cellCompact = 'py-1.5 leading-tight print:py-1 print:leading-tight';
    const descClass = isPrint ? 'print:whitespace-normal print:break-words' : '';
    const amountColClass = isPrint ? 'print:w-[90px] print:px-1' : '';
    const descColClass = isPrint ? 'print:w-[65%]' : '';

    return (
      <table className={tableClassName}>
        <thead className={headClassName}>
          <tr>
            <th className={`${cellBase} ${cellCompact} ${descColClass} text-left`}>Descrizione</th>
            <th className={`${cellBase} ${cellCompact} ${amountColClass} text-right`}>Entrate</th>
            <th className={`${cellBase} ${cellCompact} ${amountColClass} text-right`}>Uscite</th>
            {isPrint && <th className={`${cellBase} ${cellCompact} ${amountColClass} text-right`}>Saldo</th>}
          </tr>
        </thead>
        <tbody>
          {(['A', 'B', 'C', 'D', 'E'] as FiscalSection[]).map(section => {
            const t = totalsBySection[section];
            const saldo = t.entrate - t.uscite;
            const categoryRows = (Array.from(categoryTotalsBySection[section].values()) as CategoryTotals[]).sort(
              (a, b) => a.label.localeCompare(b.label)
            );

            if (categoryRows.length > 0) {
              return (
                <React.Fragment key={section}>
                  <tr className="border-b border-slate-100">
                    <td className={`${cellBase} ${cellCompact} ${descClass} ${descColClass} font-semibold text-slate-800`}>{section} - {RENDICONTO_SECTION_LABELS[section]}</td>
                    <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />
                    <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />
                    {isPrint && <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />}
                  </tr>
                  {categoryRows.map(cat => {
                    const catSaldo = cat.entrate - cat.uscite;
                    return (
                      <tr key={`${section}-${cat.label}`} className="border-b border-slate-100">
                        <td className={`${cellBase} ${cellCompact} ${descClass} ${descColClass} text-slate-700 pl-8`}>{cat.label}</td>
                        <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right text-emerald-700`}>{formatEuro(cat.entrate)}</td>
                        <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right text-red-600`}>{formatEuro(cat.uscite)}</td>
                        {isPrint && <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right text-slate-900`}>{formatEuro(catSaldo)}</td>}
                      </tr>
                    );
                  })}
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <td className={`${cellBase} ${cellCompact} ${descClass} ${descColClass} font-semibold text-slate-700 pl-8`}>Totale sezione</td>
                    <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-emerald-700`}>{formatEuro(t.entrate)}</td>
                    <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-red-600`}>{formatEuro(t.uscite)}</td>
                    {isPrint && <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-slate-900`}>{formatEuro(saldo)}</td>}
                  </tr>
                  {!isPrint && (
                    <tr className="border-b border-slate-100">
                      <td className={`${cellBase} ${cellCompact} ${descClass} ${descColClass} text-slate-500 pl-8`}>Saldo sezione</td>
                      <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />
                      <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-medium text-slate-900`}>{formatEuro(saldo)}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={section}>
                <tr className="border-b border-slate-100">
                  <td className={`${cellBase} ${cellCompact} ${descClass} ${descColClass} font-semibold text-slate-800`}>{section} - {RENDICONTO_SECTION_LABELS[section]}</td>
                  <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />
                  <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />
                  {isPrint && <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />}
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <td className={`${cellBase} ${cellCompact} ${descClass} ${descColClass} font-semibold text-slate-700 pl-8`}>Totale sezione</td>
                  <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-emerald-700`}>{formatEuro(t.entrate)}</td>
                  <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-red-600`}>{formatEuro(t.uscite)}</td>
                  {isPrint && <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-slate-900`}>{formatEuro(saldo)}</td>}
                </tr>
                {!isPrint && (
                  <tr className="border-b border-slate-100">
                    <td className={`${cellBase} ${cellCompact} ${descClass} ${descColClass} text-slate-500 pl-8`}>Saldo sezione</td>
                    <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />
                    <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-medium text-slate-900`}>{formatEuro(saldo)}</td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-50">
          <tr>
            <td className={`${cellBase} ${cellCompact} ${descColClass} font-semibold`}>Totale complessivo</td>
            <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-emerald-700`}>{formatEuro(entriesTotals.entrate)}</td>
            <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-red-600`}>{formatEuro(entriesTotals.uscite)}</td>
            {isPrint && (
              <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-slate-900`}>
                {formatEuro(finalTotal)}
              </td>
            )}
          </tr>
          {!isPrint && (
            <tr className="bg-slate-50">
              <td className={`${cellBase} ${cellCompact} ${descColClass} font-semibold`}>Saldo complessivo</td>
              <td className={`${cellBase} ${cellCompact} ${amountColClass}`} />
              <td className={`${cellBase} ${cellCompact} ${amountColClass} text-right font-semibold text-slate-900`}>
                {formatEuro(finalTotal)}
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    );
  };

  const renderMovimentiTable = (
    entries: FiscalEntry[],
    label: string,
    initialBalance: number,
    accountByEntryId: Map<string, string>,
    isCashSection = false
  ) => {
    const orderedEntries = sortEntriesByDate(entries);
    const finalBalance = orderedEntries.reduce((sum, entry) => {
      const delta = entry.type === 'ENTRATA' ? entry.amount : -entry.amount;
      return sum + delta;
    }, initialBalance || 0);

    return (
      <div className="print-page-break-before print-page-break-avoid">
        {renderPrintHeader()}
        <h2 className="text-lg font-semibold text-slate-900 mb-2">{label}</h2>
        <div className="text-xs text-slate-700 mb-2 flex items-center justify-between">
          <div>Saldo iniziale: <span className="font-semibold">{formatEuro(initialBalance || 0)}</span></div>
          <div>Saldo finale: <span className="font-semibold">{formatEuro(finalBalance)}</span></div>
        </div>
        <table className="w-full text-xs border border-slate-200 print:table-fixed">
          <thead className="bg-slate-50">
          <tr>
              <th className="px-2 py-1 text-left print:px-1 print:w-[85px]">Data</th>
              <th className="px-2 py-1 text-left print:px-1 print:w-[40%]">Descrizione</th>
              <th className="px-2 py-1 text-left print:px-1 print:w-[22%]">Categoria contabile</th>
              <th className="px-2 py-1 text-left print:px-1 print:w-[75px]">Tipo</th>
              <th className="px-2 py-1 text-right print:px-1 print:w-[80px]">Importo</th>
              <th className="px-2 py-1 text-right print:px-1 print:w-[85px]">Saldo progressivo</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let running = initialBalance || 0;
            return orderedEntries.map(entry => {
              const typeLabel = isCashSection
                ? PRINT_TYPE_LABELS[entry.type] || entry.type
                : entry.cashTransfer
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
                <td className="px-2 py-1 print:px-1">{entry.date}</td>
                <td className="px-2 py-1 print:px-1 print:whitespace-nowrap">{description}</td>
                <td className="px-2 py-1 print:px-1 print:whitespace-nowrap">{categoryLabel}</td>
                <td className="px-2 py-1 print:px-1 print:whitespace-nowrap">{typeLabel}</td>
                <td className="px-2 py-1 print:px-1 text-right">{formatEuro(entry.amount)}</td>
                <td className={`px-2 py-1 print:px-1 text-right font-medium ${saldoClass}`}>{formatEuro(running)}</td>
              </tr>
            );
            });
          })()}
        </tbody>
      </table>
      </div>
    );
  };

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

  const accountFinalBalances = data.accounts.map(account => 
    (account.initialBalance || 0) + account.entries.reduce((sum, entry) => {
      const delta = entry.type === 'ENTRATA' ? entry.amount : -entry.amount;
      return sum + delta;
    }, 0)
  );
  
  const sumAccountsBalance = accountFinalBalances.reduce((sum, balance) => sum + balance, 0);
  const totalAccountsAndCash = cashFinalBalance + sumAccountsBalance;
  const balanceMatch = Math.abs(finalTotal - totalAccountsAndCash) < 0.01;
  const balanceDiff = finalTotal - totalAccountsAndCash;

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

      {!balanceMatch && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
          <div className="text-orange-900 font-medium">⚠️ Discrepanza bilancio</div>
          <div className="text-orange-800 mt-1 text-xs space-y-1">
            <div>Saldo Rendiconto: {formatEuro(finalTotal)}</div>
            <div>Somma saldi (Cassa + Conti): {formatEuro(totalAccountsAndCash)}</div>
            <div>Differenza: {formatEuro(balanceDiff)}</div>
          </div>
        </div>
      )}

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
            {renderRendicontoTable('w-full text-sm', 'bg-slate-50 text-slate-600')}
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
            <div className="print-page-break-after print-page-break-avoid">
              {renderPrintHeader()}
              <h1 className="text-xl font-bold text-slate-900">Rendiconto per cassa (Modello D)</h1>
              <p className="text-sm text-slate-600 mb-4">Anno {selectedYear}</p>
              {renderRendicontoTable('w-full text-sm print:text-xs border border-slate-200', 'bg-slate-50', { isPrint: true })}

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
                    ? renderMovimentiTable(data.cash.entries, 'Movimenti Cassa', data.cash.initialBalance || 0, accountByEntryId, true)
                    : null}
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
};
