
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Save, Settings } from 'lucide-react';
import { ITALIAN_PROVINCES } from '../constants';

interface AdminPanelProps {
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

type Tab = 'CRAFT' | 'MARK_ARCH' | 'RAM';

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentSettings, onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('CRAFT');

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const handleSave = () => {
    onSave(settings);
    setMessage("Impostazioni salvate con successo.");
    setTimeout(() => setMessage(null), 3000);
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
    return (
        <div>
            <div className="mb-4 border-b border-gray-200">
                <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
                    <li className="mr-2">
                        <button onClick={() => setActiveTab('CRAFT')} className={`inline-block p-4 rounded-t-lg border-b-2 ${activeTab === 'CRAFT' ? 'text-masonic-gold border-masonic-gold' : 'hover:text-gray-600 hover:border-gray-300'}`}>
                            Craft
                        </button>
                    </li>
                    <li className="mr-2">
                        <button onClick={() => setActiveTab('MARK_ARCH')} className={`inline-block p-4 rounded-t-lg border-b-2 ${activeTab === 'MARK_ARCH' ? 'text-masonic-gold border-masonic-gold' : 'hover:text-gray-600 hover:border-gray-300'}`}>
                            Mark & Arch
                        </button>
                    </li>
                    <li className="mr-2">
                        <button onClick={() => setActiveTab('RAM')} className={`inline-block p-4 rounded-t-lg border-b-2 ${activeTab === 'RAM' ? 'text-masonic-gold border-masonic-gold' : 'hover:text-gray-600 hover:border-gray-300'}`}>
                            RAM
                        </button>
                    </li>
                </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
                {activeTab === 'CRAFT' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Rito</label>
                        <select
                            value={settings.preferences?.craft || 'Emulation'}
                            onChange={(e) => handlePreferenceChange('craft', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold bg-white"
                        >
                            <option value="Emulation">Emulation</option>
                            <option value="Giustinianeo">Giustinianeo</option>
                        </select>
                    </div>
                )}
                {activeTab === 'MARK_ARCH' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Rito</label>
                        <select
                            value={settings.preferences?.markAndArch || 'Irlandese'}
                            onChange={(e) => handlePreferenceChange('markAndArch', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold bg-white"
                        >
                            <option value="Irlandese">Irlandese</option>
                            <option value="Aldersgate">Aldersgate</option>
                        </select>
                    </div>
                )}
                {activeTab === 'RAM' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Rito</label>
                        <select
                            value={settings.preferences?.ram || 'Irlandese'}
                            onChange={(e) => handlePreferenceChange('ram', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold bg-white"
                        >
                            <option value="Irlandese">Irlandese</option>
                            <option value="Aldersgate">Aldersgate</option>
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn pb-8">
      <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
            <Settings size={24} className="text-masonic-gold"/>
            <h2 className="text-xl font-serif font-bold">Amministrazione</h2>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Dati Loggia</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Nome Loggia</label>
                    <input 
                        type="text" 
                        value={settings.lodgeName} 
                        onChange={(e) => handleChange('lodgeName', e.target.value)} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" 
                        placeholder="Es. G. Mazzini"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Numero</label>
                    <input 
                        type="text" 
                        value={settings.lodgeNumber} 
                        onChange={(e) => handleChange('lodgeNumber', e.target.value)} 
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold" 
                        placeholder="Es. 100"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Provincia</label>
                    <select
                        value={settings.province}
                        onChange={(e) => handleChange('province', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-masonic-gold bg-white"
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
      </div>
    </div>
  );
};
