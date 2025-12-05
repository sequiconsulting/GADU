
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Save, Settings, Shield } from 'lucide-react';
import { ITALIAN_PROVINCES, BRANCHES } from '../constants';

interface AdminPanelProps {
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentSettings, onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [activeTab, setActiveTab] = useState<string>(BRANCHES[0].type);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const handleSave = () => {
    onSave(settings);
    setMessage("Impostazioni salvate con successo.");
    setTimeout(() => setMessage(null), 3000);
  };

  const handleChange = (field: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const currentBranch = BRANCHES.find(b => b.type === activeTab);

  const renderDegreeTable = () => {
    switch (activeTab) {
        case 'CRAFT':
            return (
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-200">
                        <tr>
                            <th className="p-2">Grado</th>
                            <th className="p-2 w-16">Abbr.</th>
                            <th className="p-2">Requisito</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr><td className="p-2 font-medium">Apprendista Ammesso</td><td className="p-2 font-mono text-slate-500">AA</td><td className="p-2 italic">- Nessuno</td></tr>
                        <tr><td className="p-2 font-medium">Compagno di Mestiere</td><td className="p-2 font-mono text-slate-500">CdM</td><td className="p-2">- AA (Craft)</td></tr>
                        <tr><td className="p-2 font-medium">Maestro Muratore</td><td className="p-2 font-mono text-slate-500">MM</td><td className="p-2">- CdM (Craft)</td></tr>
                        <tr><td className="p-2 font-medium">Maestro Installato</td><td className="p-2 font-mono text-slate-500">MI</td><td className="p-2">- MM (Craft)</td></tr>
                    </tbody>
                </table>
            );
        case 'MARK':
            return (
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-200">
                        <tr>
                            <th className="p-2">Grado</th>
                            <th className="p-2 w-16">Abbr.</th>
                            <th className="p-2">Requisito</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr>
                            <td className="p-2 font-medium">Uomo del Marchio</td>
                            <td className="p-2 font-mono text-slate-500">UdM</td>
                            <td className="p-2">
                                <div>- CdM (Craft)</div>
                                <div className="text-red-500 italic mt-1">(Attualmente non Attivo)</div>
                            </td>
                        </tr>
                        <tr>
                            <td className="p-2 font-medium">Maestro del Marchio</td>
                            <td className="p-2 font-mono text-slate-500">MMM</td>
                            <td className="p-2">- MM (Craft)</td>
                        </tr>
                        <tr>
                            <td className="p-2 font-medium">Venerabile della Loggia del Marchio</td>
                            <td className="p-2 font-mono text-slate-500">MVM</td>
                            <td className="p-2">
                                <div>- MI (Craft)</div>
                                <div>- MMM (Marchio)</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        case 'CHAPTER':
            return (
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-200">
                        <tr>
                            <th className="p-2">Grado</th>
                            <th className="p-2 w-16">Abbr.</th>
                            <th className="p-2">Requisito</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr>
                            <td className="p-2 font-medium">Compagno dell'Arco Reale</td>
                            <td className="p-2 font-mono text-slate-500">CAR</td>
                            <td className="p-2">- MMM (Marchio)</td>
                        </tr>
                        <tr>
                            <td className="p-2 font-medium">Principale dell'Arco Reale</td>
                            <td className="p-2 font-mono text-slate-500">PAR</td>
                            <td className="p-2">
                                <div>- MI (Craft)</div>
                                <div>- CAR (Arco Reale)</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        case 'RAM':
            return (
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-200">
                        <tr>
                            <th className="p-2">Grado</th>
                            <th className="p-2 w-16">Abbr.</th>
                            <th className="p-2">Requisito</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr>
                            <td className="p-2 font-medium">Marinaio dell'Arca Reale</td>
                            <td className="p-2 font-mono text-slate-500">MAR</td>
                            <td className="p-2">- MMM (Marchio)</td>
                        </tr>
                    </tbody>
                </table>
            );
        default:
            return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn pb-8">
      {/* Header */}
      <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
            <Settings size={24} className="text-masonic-gold"/>
            <h2 className="text-xl font-serif font-bold">Amministrazione</h2>
        </div>
      </div>

      <div className="p-6">
        {/* Intestazione Loggia */}
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

        {/* Tabbed Interface for Branch Parameters */}
        <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Parametri Rami</h3>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto rounded-t-lg">
                {BRANCHES.map(b => (
                    <button 
                        key={b.type} 
                        onClick={() => setActiveTab(b.type)}
                        className={`px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 outline-none ${activeTab === b.type ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white` : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${b.color}`} /> {b.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="border-x border-b border-slate-200 rounded-b-lg p-6 bg-white min-h-[200px] flex gap-8">
                 <div className="w-full md:w-1/2">
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className={currentBranch?.color.replace('bg-', 'text-')} size={20} />
                        <h4 className="text-base font-bold text-slate-700">Requisiti Gradi {currentBranch?.label}</h4>
                    </div>
                    
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        {renderDegreeTable()}
                    </div>
                 </div>

                 <div className="hidden md:block w-1/2 border-l border-slate-100 pl-8">
                     <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase">Note e Parametri</h4>
                     <p className="text-xs text-slate-500 italic">
                        Le regole di propedeuticità mostrate a sinistra sono implementate attivamente nei controlli dell'anagrafica.
                        <br/><br/>
                        Eventuali modifiche a questi parametri strutturali richiedono un aggiornamento dell'applicazione.
                     </p>
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
      </div>
    </div>
  );
};
