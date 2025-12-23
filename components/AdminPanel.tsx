
import React, { useState, useEffect } from 'react';
import { AppSettings, BranchType } from '../types';
import { Save, Settings, X, Upload } from 'lucide-react';
import { ITALIAN_PROVINCES, BRANCHES } from '../constants';
import { UserManagement } from './UserManagement';

interface AdminPanelProps {
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void> | void;
}

type Tab = 'CRAFT' | 'MARK' | 'CHAPTER' | 'RAM';

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentSettings, onSave }) => {
  const withDefaults = (s: AppSettings): AppSettings => ({
    ...s,
    userChangelog: s.userChangelog || [],
  });

  const [settings, setSettings] = useState<AppSettings>(withDefaults(currentSettings));
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('CRAFT');
  const [usersTab, setUsersTab] = useState(false);

  // Always sync local settings to the latest from parent
  useEffect(() => {
    setSettings(withDefaults(currentSettings));
  }, [currentSettings]);

  const handleSave = async () => {
    await Promise.resolve(onSave(settings));
    setMessage("Impostazioni salvate con successo.");
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUsersChange = async (users: any[]) => {
    let next: AppSettings | undefined;
    setSettings(prev => {
      next = { ...prev, users };
      return next;
    });
    if (next) {
      await onSave(next);
    }
    setMessage('Utenti aggiornati');
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

  const handlePreferenceChange = (branch: keyof AppSettings['preferences'], value: string) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...(prev.preferences || { craft: 'Emulation', markAndArch: 'Irlandese', ram: 'Irlandese' }),
        [branch]: value,
      },
    }));
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

          {/* Default Quote */}
          <div className="border-t border-slate-200 pt-3 mt-3">
            <label className="block text-xs font-medium text-slate-700 mb-2">Default Quote</label>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Capitazione</th>
                    <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">{activeTab === 'CRAFT' ? 'Gran Loggia' : 'Gran Capitolo'}</th>
                    <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Regionale</th>
                    <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Loggia</th>
                    <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Totale</th>
                    <th className="text-center py-0.5 px-1 border border-slate-300 font-medium text-slate-700">Cerimonia</th>
                  </tr>
                </thead>
                <tbody>
                  {(['Ordinaria', 'Ridotta Settembre', 'Doppia Appartenenza', 'Ridotta Studenti', 'Ridotta Ministri di Culto', 'Onorario'] as const).map(tipo => {
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
                                handleBranchPrefChange('defaultQuote', newQuote);
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
                                handleBranchPrefChange('defaultQuote', newQuote);
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
                                handleBranchPrefChange('defaultQuote', newQuote);
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
                                handleBranchPrefChange('defaultQuote', newQuote);
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
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button
            onClick={() => setUsersTab(false)}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              !usersTab
                ? 'border-masonic-gold text-masonic-gold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Configurazione
          </button>
          <button
            onClick={() => setUsersTab(true)}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
              usersTab
                ? 'border-masonic-gold text-masonic-gold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Gestione Utenti
          </button>
        </div>

        {!usersTab ? (
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
                <Save size={18} /> Salva Configurazione
              </button>
            </div>
          </>
        ) : (
          <>
            {/* USERS TAB */}
            <UserManagement
              users={settings.users || []}
              changelog={settings.userChangelog || []}
              canManage={true}  // In future, check if current user is admin
              canView={true}
              currentUserEmail="Admin" // Will be replaced with actual current user email when auth is enabled
              onUsersChange={handleUsersChange}
              onChangelogChange={handleUserChangelogChange}
            />
            {message && (
              <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
                <span className="text-green-600 font-medium text-sm animate-pulse">{message}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
