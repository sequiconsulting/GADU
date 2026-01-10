
import React, { useState, useEffect } from 'react';
import { AppSettings, BranchType } from '../types';
import { Save, Settings, X, Upload, Trash2, Database } from 'lucide-react';
import { ITALIAN_PROVINCES, BRANCHES } from '../constants';
import { UserManagement } from './UserManagement';
import { dataService } from '../services/dataService';

interface AdminPanelProps {
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void> | void;
  onDataChange?: () => Promise<void>;
  currentUserEmail?: string;
  currentUserToken?: string;
}

type Tab = 'CRAFT' | 'MARK' | 'ARCH' | 'RAM';
type MainTab = 'GENERALE' | 'PREFERENZE_RAMI' | 'DEFAULT_QUOTE' | 'GESTIONE_UTENTI' | 'EXTRA';

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentSettings, onSave, onDataChange, currentUserEmail, currentUserToken }) => {
  const withDefaults = (s: AppSettings): AppSettings => ({
    ...s,
    userChangelog: s.userChangelog || [],
  });

  const [settings, setSettings] = useState<AppSettings>(withDefaults(currentSettings));
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('CRAFT');
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('GENERALE');
  const [showClearDbConfirm, setShowClearDbConfirm] = useState<boolean>(false);
  const [showLoadDemoConfirm, setShowLoadDemoConfirm] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Verifica se la loggia corrente è la demo (9999)
  const isDemoLodge = dataService.getCurrentLodgeConfig()?.glriNumber === '9999';

  // Always sync local settings to the latest from parent
  useEffect(() => {
    setSettings(withDefaults(currentSettings));
  }, [currentSettings]);

  const handleSave = async () => {
    await Promise.resolve(onSave(settings));
    setMessage("Impostazioni salvate con successo.");
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUserChangelogChange = async (changelog: any[]) => {
    let next: AppSettings | undefined;
    setSettings(prev => {
      next = { ...prev, userChangelog: changelog };
      return next;
    });
    if (next) {
      await onSave(next);
    }
  };

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleClearDatabase = async () => {
    setIsProcessing(true);
    try {
      await dataService.clearDatabase();
      setMessage("Database cancellato con successo.");
      setShowClearDbConfirm(false);
      if (onDataChange) {
        await onDataChange();
      }
    } catch (error) {
      console.error('Errore nella cancellazione del database:', error);
      setMessage("Errore durante la cancellazione del database.");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleLoadDemoData = async () => {
    setIsProcessing(true);
    try {
      await dataService.loadDemoData();
      setMessage("Dati di esempio caricati con successo.");
      setShowLoadDemoConfirm(false);
      if (onDataChange) {
        await onDataChange();
      }
    } catch (error) {
      console.error('Errore nel caricamento dei dati di esempio:', error);
      setMessage("Errore durante il caricamento dei dati di esempio.");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const renderPreferences = () => {
    const currentBranchPrefs = settings.branchPreferences?.[activeTab] || {};
    
    const handleBranchPrefChange = (field: string, value: any) => {
      setSettings(prev => ({
        ...prev,
        branchPreferences: {
          ...(prev.branchPreferences || {}),
          [activeTab]: {
            ...currentBranchPrefs,
            [field]: value,
          },
        },
      }));
    };

    const handleFileUpload = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          handleBranchPrefChange(field, dataUrl);
        };
        reader.readAsDataURL(file);
      }
      // Reset input value so the same file can be selected again (issue #32)
      e.target.value = '';
    };

    const handleClearLogo = (field: string) => {
      handleBranchPrefChange(field, undefined);
    };

    return (
      <div>
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto rounded-t-lg scrollbar-hide mb-4">
          {BRANCHES.map(b => (
            <button
              key={b.type}
              onClick={() => setActiveTab(b.type as Tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${
                activeTab === b.type
                  ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white`
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${b.color}`} />
              {b.label}
            </button>
          ))}
        </div>
        
        <div className="p-3 bg-white border border-slate-200 border-t-0 rounded-b-lg space-y-4">
          {/* Casa Massonica */}
          <div className="space-y-2">
            <h4 className="font-semibold text-xs text-slate-700">Casa Massonica</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Città</label>
                <input
                  type="text"
                  value={currentBranchPrefs.città || ''}
                  onChange={(e) => handleBranchPrefChange('città', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-masonic-gold focus:border-transparent text-slate-800"
                  placeholder="Roma"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Indirizzo</label>
                <input
                  type="text"
                  value={currentBranchPrefs.indirizzo || ''}
                  onChange={(e) => handleBranchPrefChange('indirizzo', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-masonic-gold focus:border-transparent text-slate-800"
                  placeholder="Via Roma 123"
                />
              </div>
            </div>
          </div>

          {/* Motto */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motto</label>
            <input
              type="text"
              value={currentBranchPrefs.motto || ''}
              onChange={(e) => handleBranchPrefChange('motto', e.target.value)}
              className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-masonic-gold focus:border-transparent text-slate-800"
              placeholder="Libertà, Uguaglianza, Fraternità"
            />
          </div>

          {/* Logos */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Logos</label>
            <div className="grid grid-cols-3 gap-2">
              {/* Logo Obbedienza */}
              <div className="flex flex-col items-center space-y-1">
                <div className="w-full aspect-square border border-slate-300 rounded flex items-center justify-center hover:border-slate-400 transition-colors bg-slate-50 relative overflow-hidden group">
                  {currentBranchPrefs.logoObbedienzaUrl ? (
                    <>
                      <img
                        src={currentBranchPrefs.logoObbedienzaUrl}
                        alt="Logo Obbedienza"
                        className="h-full w-full object-contain p-1"
                      />
                      <button
                        onClick={() => handleClearLogo('logoObbedienzaUrl')}
                        className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Cancella logo"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload('logoObbedienzaUrl')}
                        className="hidden"
                      />
                      <Upload size={16} className="text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 text-center px-1">Carica</span>
                    </label>
                  )}
                </div>
                <span className="text-xs text-slate-600">Obbedienza</span>
              </div>

              {/* Logo Regionale */}
              <div className="flex flex-col items-center space-y-1">
                <div className="w-full aspect-square border border-slate-300 rounded flex items-center justify-center hover:border-slate-400 transition-colors bg-slate-50 relative overflow-hidden group">
                  {currentBranchPrefs.logoRegionaleUrl ? (
                    <>
                      <img
                        src={currentBranchPrefs.logoRegionaleUrl}
                        alt="Logo Regionale"
                        className="h-full w-full object-contain p-1"
                      />
                      <button
                        onClick={() => handleClearLogo('logoRegionaleUrl')}
                        className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Cancella logo"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload('logoRegionaleUrl')}
                        className="hidden"
                      />
                      <Upload size={16} className="text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 text-center px-1">Carica</span>
                    </label>
                  )}
                </div>
                <span className="text-xs text-slate-600">Regionale</span>
              </div>

              {/* Logo Loggia */}
              <div className="flex flex-col items-center space-y-1">
                <div className="w-full aspect-square border border-slate-300 rounded flex items-center justify-center hover:border-slate-400 transition-colors bg-slate-50 relative overflow-hidden group">
                  {currentBranchPrefs.logoLoggiaUrl ? (
                    <>
                      <img
                        src={currentBranchPrefs.logoLoggiaUrl}
                        alt="Logo Loggia"
                        className="h-full w-full object-contain p-1"
                      />
                      <button
                        onClick={() => handleClearLogo('logoLoggiaUrl')}
                        className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Cancella logo"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload('logoLoggiaUrl')}
                        className="hidden"
                      />
                      <Upload size={16} className="text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 text-center px-1">Carica</span>
                    </label>
                  )}
                </div>
                <span className="text-xs text-slate-600">Loggia</span>
              </div>
            </div>
          </div>


        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn pb-8">
      <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
            <Settings size={24} className="text-masonic-gold"/>
            <h2 className="text-xl font-serif font-bold">Amministrazione</h2>
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-2 mb-6 border-b border-slate-200 flex-wrap">
          {['GENERALE', 'PREFERENZE_RAMI', 'DEFAULT_QUOTE', 'GESTIONE_UTENTI', ...(isDemoLodge ? ['EXTRA'] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveMainTab(tab as MainTab)}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeMainTab === tab
                  ? 'border-masonic-gold text-masonic-gold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'GENERALE' && 'Generale'}
              {tab === 'PREFERENZE_RAMI' && 'Preferenze Rami'}
              {tab === 'DEFAULT_QUOTE' && 'Default Quote'}
              {tab === 'GESTIONE_UTENTI' && 'Gestione Utenti'}
              {tab === 'EXTRA' && 'Extra'}
            </button>
          ))}
        </div>

        {activeMainTab === 'GENERALE' && (
          <>
            {/* CONFIGURAZIONE TAB */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Dati Loggia</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Nome Loggia</label>
                    <input 
                        type="text" 
                        value={settings.lodgeName} 
                        onChange={(e) => handleChange('lodgeName', e.target.value)} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold bg-slate-50 cursor-not-allowed" 
                        placeholder="Es. G. Mazzini"
                        readOnly
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Numero</label>
                    <input 
                        type="text" 
                        value={settings.lodgeNumber} 
                        onChange={(e) => handleChange('lodgeNumber', e.target.value)} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold bg-slate-50 cursor-not-allowed" 
                        placeholder="Es. 100"
                        readOnly
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Provincia</label>
                    <select
                        value={settings.province}
                        onChange={(e) => handleChange('province', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold bg-slate-50 cursor-not-allowed"
                        disabled
                    >
                        <option value="">Seleziona...</option>
                        {ITALIAN_PROVINCES.map(prov => (
                            <option key={prov.code} value={prov.code}>{prov.name} ({prov.code})</option>
                        ))}
                    </select>
                </div>
              </div>
            </div>

            {/* DATI ASSOCIAZIONE (Read-only from registry) */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Dati Associazione</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-800">
                ℹ️ I seguenti dati sono stati configurati durante il setup e non possono essere modificati qui. Per cambiarli, contatta il super-admin.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Nome Associazione</label>
                    <input 
                        type="text" 
                        value={settings.associationName || ''} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none bg-slate-50 cursor-not-allowed text-slate-700" 
                        readOnly
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Codice Fiscale</label>
                    <input 
                        type="text" 
                        value={settings.taxCode || ''} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none bg-slate-50 cursor-not-allowed text-slate-700 font-mono" 
                        readOnly
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Indirizzo</label>
                    <input 
                        type="text" 
                        value={settings.address || ''} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none bg-slate-50 cursor-not-allowed text-slate-700" 
                        readOnly
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">CAP</label>
                    <input 
                        type="text" 
                        value={settings.zipCode || ''} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none bg-slate-50 cursor-not-allowed text-slate-700" 
                        readOnly
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Città</label>
                    <input 
                        type="text" 
                        value={settings.city || ''} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none bg-slate-50 cursor-not-allowed text-slate-700" 
                        readOnly
                    />
                </div>
              </div>
            </div>
            <div className="flex justify-end items-center gap-4 border-t border-slate-100 pt-6">
              {message && <span className="text-green-600 font-medium text-sm animate-pulse">{message}</span>}
              <button 
                onClick={handleSave} 
                className="bg-masonic-gold hover:bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-colors"
              >
                <Save size={18} /> Salva Configurazione
              </button>
            </div>
          </>
        )}

        {activeMainTab === 'PREFERENZE_RAMI' && (
          <>
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Preferenze Rami</h3>
              {renderPreferences()}
            </div>
            <div className="flex justify-end items-center gap-4 border-t border-slate-100 pt-6">
              {message && <span className="text-green-600 font-medium text-sm animate-pulse">{message}</span>}
              <button 
                onClick={handleSave} 
                className="bg-masonic-gold hover:bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-colors"
              >
                <Save size={18} /> Salva Preferenze
              </button>
            </div>
          </>
        )}

        {activeMainTab === 'DEFAULT_QUOTE' && (
          <>
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Quote di Default per Ramo</h3>
              <div>
                <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto rounded-t-lg scrollbar-hide mb-4">
                  {BRANCHES.filter(b => b.type !== 'MARK').map(b => (
                    <button
                      key={b.type}
                      onClick={() => setActiveTab(b.type as Tab)}
                      className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${
                        activeTab === b.type
                          ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white`
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${b.color}`} />
                      {b.type === 'ARCH' ? 'Arch (Marchio + Arco Reale)' : b.label}
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-white border border-slate-200 border-t-0 rounded-b-lg">
                  <label className="block text-xs font-medium text-slate-700 mb-2">Default Quote</label>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="text-left py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Capitazione</th>
                          <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">{activeTab === 'CRAFT' ? 'Gran Loggia' : 'Gran Arco Reale'}</th>
                          <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Regionale</th>
                          <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Loggia</th>
                          <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Totale</th>
                          <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Cerimonia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['Ordinaria', 'Ridotta Settembre', 'Doppia Appartenenza', 'Ridotta Studenti', 'Ridotta Ministri di Culto', 'Onorario'] as const).map(tipo => {
                          const currentBranchPrefs = settings.branchPreferences?.[activeTab] || {};
                          const quotaGL = currentBranchPrefs.defaultQuote?.quotaGLGC?.[tipo] || 0;
                          const quotaReg = currentBranchPrefs.defaultQuote?.quotaRegionale?.[tipo] || 0;
                          const quotaLog = currentBranchPrefs.defaultQuote?.quotaLoggia?.[tipo] || 0;
                          const totale = quotaGL + quotaReg + quotaLog;
                          return (
                            <tr key={tipo} className="hover:bg-slate-50">
                              <td className="py-0.5 px-1 border border-slate-300 text-slate-700">{tipo}</td>
                              <td className="py-0.5 px-1 border border-slate-300">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-slate-500 text-xs">€</span>
                                  <input
                                    type="number"
                                    value={quotaGL}
                                    onChange={(e) => {
                                      const newQuote = { ...(currentBranchPrefs.defaultQuote || { quotaRegionale: {}, quotaLoggia: {}, quotaCerimonia: {}, quotaGLGC: {} }) };
                                      newQuote.quotaGLGC = { ...newQuote.quotaGLGC, [tipo]: parseInt(e.target.value) || 0 };
                                      setSettings(prev => ({
                                        ...prev,
                                        branchPreferences: {
                                          ...(prev.branchPreferences || {}),
                                          [activeTab]: {
                                            ...currentBranchPrefs,
                                            defaultQuote: newQuote,
                                          },
                                        },
                                      }));
                                    }}
                                    className="flex-1 px-0.5 py-0 border border-slate-300 rounded text-xs text-slate-800 text-right focus:ring-1 focus:ring-masonic-gold focus:border-transparent w-12"
                                    placeholder="0"
                                    step="1"
                                  />
                                </div>
                              </td>
                              <td className="py-0.5 px-1 border border-slate-300">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-slate-500 text-xs">€</span>
                                  <input
                                    type="number"
                                    value={quotaReg}
                                    onChange={(e) => {
                                      const newQuote = { ...(currentBranchPrefs.defaultQuote || { quotaGLGC: {}, quotaLoggia: {}, quotaCerimonia: {} }) };
                                      newQuote.quotaRegionale = { ...newQuote.quotaRegionale, [tipo]: parseInt(e.target.value) || 0 };
                                      setSettings(prev => ({
                                        ...prev,
                                        branchPreferences: {
                                          ...(prev.branchPreferences || {}),
                                          [activeTab]: {
                                            ...currentBranchPrefs,
                                            defaultQuote: newQuote,
                                          },
                                        },
                                      }));
                                    }}
                                    className="flex-1 px-0.5 py-0 border border-slate-300 rounded text-xs text-slate-800 text-right focus:ring-1 focus:ring-masonic-gold focus:border-transparent w-12"
                                    placeholder="0"
                                    step="1"
                                  />
                                </div>
                              </td>
                              <td className="py-0.5 px-1 border border-slate-300">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-slate-500 text-xs">€</span>
                                  <input
                                    type="number"
                                    value={quotaLog}
                                    onChange={(e) => {
                                      const newQuote = { ...(currentBranchPrefs.defaultQuote || { quotaGLGC: {}, quotaRegionale: {}, quotaCerimonia: {} }) };
                                      newQuote.quotaLoggia = { ...newQuote.quotaLoggia, [tipo]: parseInt(e.target.value) || 0 };
                                      setSettings(prev => ({
                                        ...prev,
                                        branchPreferences: {
                                          ...(prev.branchPreferences || {}),
                                          [activeTab]: {
                                            ...currentBranchPrefs,
                                            defaultQuote: newQuote,
                                          },
                                        },
                                      }));
                                    }}
                                    className="flex-1 px-0.5 py-0 border border-slate-300 rounded text-xs text-slate-800 text-right focus:ring-1 focus:ring-masonic-gold focus:border-transparent w-12"
                                    placeholder="0"
                                    step="1"
                                  />
                                </div>
                              </td>
                              <td className="py-0.5 px-1 border border-slate-300 bg-slate-50">
                                <div className="flex items-center gap-0.5 justify-end">
                                  <span className="text-slate-500 text-xs">€</span>
                                  <span className="text-slate-800 font-medium text-xs">{totale}</span>
                                </div>
                              </td>
                              <td className="py-0.5 px-1 border border-slate-300">
                                <div className="flex items-center gap-0.5">
                                  <span className="text-slate-500 text-xs">€</span>
                                  <input
                                    type="number"
                                    value={currentBranchPrefs.defaultQuote?.quotaCerimonia?.[tipo] || 0}
                                    onChange={(e) => {
                                      const newQuote = { ...(currentBranchPrefs.defaultQuote || { quotaGLGC: {}, quotaRegionale: {}, quotaLoggia: {} }) };
                                      newQuote.quotaCerimonia = { ...newQuote.quotaCerimonia, [tipo]: parseInt(e.target.value) || 0 };
                                      setSettings(prev => ({
                                        ...prev,
                                        branchPreferences: {
                                          ...(prev.branchPreferences || {}),
                                          [activeTab]: {
                                            ...currentBranchPrefs,
                                            defaultQuote: newQuote,
                                          },
                                        },
                                      }));
                                    }}
                                    className="flex-1 px-0.5 py-0 border border-slate-300 rounded text-xs text-slate-800 text-right focus:ring-1 focus:ring-masonic-gold focus:border-transparent w-12"
                                    placeholder="0"
                                    step="1"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end items-center gap-4 border-t border-slate-100 pt-6">
              {message && <span className="text-green-600 font-medium text-sm animate-pulse">{message}</span>}
              <button 
                onClick={handleSave} 
                className="bg-masonic-gold hover:bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-colors"
              >
                <Save size={18} /> Salva Quote
              </button>
            </div>
          </>
        )}

        {activeMainTab === 'GESTIONE_UTENTI' && (
          <>
            <UserManagement
              lodgeNumber={settings.lodgeNumber}
              changelog={settings.userChangelog || []}
              canManage={true}
              canView={true}
              currentUserEmail={currentUserEmail || 'Admin'}
              authToken={currentUserToken}
              onChangelogChange={handleUserChangelogChange}
            />
            {message && (
              <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
                <span className="text-green-600 font-medium text-sm animate-pulse">{message}</span>
              </div>
            )}
          </>
        )}

        {activeMainTab === 'EXTRA' && isDemoLodge && (
          <>
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-red-800 border-b border-red-200 pb-2 mb-4">Gestione Database (Solo Demo)</h3>
              <p className="text-sm text-slate-600 mb-4">
                Attenzione: queste operazioni sono irreversibili. Assicurati di avere un backup prima di procedere.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowLoadDemoConfirm(true)}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-colors"
                >
                  <Database size={18} /> Carica Dati di Esempio
                </button>
                <button
                  onClick={() => setShowClearDbConfirm(true)}
                  disabled={isProcessing}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={18} /> Cancella Database
                </button>
              </div>
            </div>
          </>
        )}

        {activeMainTab === 'EXTRA' && !isDemoLodge && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-slate-600">Il tab Extra è disponibile solo per la loggia demo (numero 9999).</p>
          </div>
        )}
      </div>

      {/* Modal Conferma Cancellazione Database */}
      {showClearDbConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-fadeIn">
            <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
              <Trash2 size={24} />
              Conferma Cancellazione Database
            </h3>
            <p className="text-slate-700 mb-4">
              Sei sicuro di voler cancellare <strong>TUTTI i dati</strong> del database?
            </p>
            <p className="text-red-600 font-semibold mb-6">
              Questa operazione è irreversibile e cancellerà tutti i membri e le convocazioni.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearDbConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleClearDatabase}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? 'Cancellazione...' : 'Conferma Cancellazione'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conferma Caricamento Dati Demo */}
      {showLoadDemoConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-fadeIn">
            <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
              <Database size={24} />
              Conferma Caricamento Dati di Esempio
            </h3>
            <p className="text-slate-700 mb-4">
              Sei sicuro di voler caricare i dati di esempio nel database?
            </p>
            <p className="text-amber-600 font-semibold mb-6">
              Verranno aggiunti 50 membri demo e 5 convocazioni di esempio.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLoadDemoConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleLoadDemoData}
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? 'Caricamento...' : 'Conferma Caricamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
