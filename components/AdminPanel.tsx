
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
        
        <div className="p-6 bg-white border border-slate-200 border-t-0 rounded-b-lg space-y-6">
          {/* Casa Massonica */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800">Casa Massonica</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Città</label>
                <input
                  type="text"
                  value={currentBranchPrefs.città || ''}
                  onChange={(e) => handleBranchPrefChange('città', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent text-slate-800"
                  placeholder="es. Roma"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Indirizzo</label>
                <input
                  type="text"
                  value={currentBranchPrefs.indirizzo || ''}
                  onChange={(e) => handleBranchPrefChange('indirizzo', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent text-slate-800"
                  placeholder="es. Via Roma 123"
                />
              </div>
            </div>
          </div>

          {/* Motto */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Motto</label>
            <input
              type="text"
              value={currentBranchPrefs.motto || ''}
              onChange={(e) => handleBranchPrefChange('motto', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent text-slate-800"
              placeholder="es. Libertà, Uguaglianza, Fraternità"
            />
          </div>

          {/* Logo Obbedienza */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Logo Obbedienza</label>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-slate-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload('logoObbedienzaUrl')}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 text-slate-600">
                    <Upload size={18} />
                    <span className="text-sm">Carica immagine</span>
                  </div>
                </label>
              </div>
              {currentBranchPrefs.logoObbedienzaUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={currentBranchPrefs.logoObbedienzaUrl}
                    alt="Logo Obbedienza"
                    className="h-12 w-12 object-contain border border-slate-200 rounded"
                  />
                  <button
                    onClick={() => handleClearLogo('logoObbedienzaUrl')}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Cancella logo"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Logo Regionale */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Logo Regionale</label>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-slate-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload('logoRegionaleUrl')}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 text-slate-600">
                    <Upload size={18} />
                    <span className="text-sm">Carica immagine</span>
                  </div>
                </label>
              </div>
              {currentBranchPrefs.logoRegionaleUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={currentBranchPrefs.logoRegionaleUrl}
                    alt="Logo Regionale"
                    className="h-12 w-12 object-contain border border-slate-200 rounded"
                  />
                  <button
                    onClick={() => handleClearLogo('logoRegionaleUrl')}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Cancella logo"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Logo Loggia */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Logo Loggia</label>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-slate-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload('logoLoggiaUrl')}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 text-slate-600">
                    <Upload size={18} />
                    <span className="text-sm">Carica immagine</span>
                  </div>
                </label>
              </div>
              {currentBranchPrefs.logoLoggiaUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={currentBranchPrefs.logoLoggiaUrl}
                    alt="Logo Loggia"
                    className="h-12 w-12 object-contain border border-slate-200 rounded"
                  />
                  <button
                    onClick={() => handleClearLogo('logoLoggiaUrl')}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Cancella logo"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
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
