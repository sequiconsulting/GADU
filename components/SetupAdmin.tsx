import React, { useMemo, useState } from 'react';
import { Shield, Check, XCircle } from 'lucide-react';
import { dataService } from '../services/dataService';
import { UserPrivilege } from '../types';

interface SetupAdminProps {
  onComplete?: () => void;
}

export const SetupAdmin: React.FC<SetupAdminProps> = ({ onComplete }) => {
  const secretParam = useMemo(() => new URLSearchParams(window.location.search).get('setup'), []);
  const envSecret = (import.meta as any).env?.VITE_SETUP_SECRET;
  const isAuthorized = !!envSecret && secretParam === envSecret;

  const [lodgeName, setLodgeName] = useState('');
  const [lodgeNumber, setLodgeNumber] = useState('');
  const [province, setProvince] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPrivileges, setAdminPrivileges] = useState<UserPrivilege[]>(['AD']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const togglePrivilege = (p: UserPrivilege) => {
    setAdminPrivileges(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleBootstrap = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      if (!lodgeName || !lodgeNumber || !province || !adminEmail || !adminName) {
        setError('Compila tutti i campi richiesti.');
        setLoading(false);
        return;
      }
      // Setup minimale: salva le impostazioni della loggia.
      // La creazione/gestione utenti avviene tramite Supabase Auth (vedi AdminPanel → Gestione Utenti).
      const current = await dataService.getSettings();
      await dataService.saveSettings({
        ...current,
        lodgeName,
        lodgeNumber,
        province,
      });
      setSuccess(true);
      if (onComplete) onComplete();
    } catch (e: any) {
      setError(e?.message || 'Errore durante la configurazione iniziale.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-lg p-6 w-[520px] text-center">
          <XCircle className="mx-auto text-red-600" />
          <h2 className="mt-2 text-lg font-semibold text-slate-800">Accesso Negato</h2>
          <p className="text-sm text-slate-600 mt-1">URL segreto mancante o token non valido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white border border-slate-200 rounded-lg p-6 w-[720px]">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="text-masonic-gold" />
          <h1 className="text-xl font-bold text-slate-800">Setup Amministratore GADU</h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-300 text-green-700 rounded p-3 text-sm flex items-center gap-2">
            <Check />
            Configurazione completata con successo.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome Loggia</label>
            <input value={lodgeName} onChange={e => setLodgeName(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Numero</label>
            <input value={lodgeNumber} onChange={e => setLodgeNumber(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Provincia</label>
            <input value={province} onChange={e => setProvince(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
        </div>

        <h2 className="mt-6 text-base font-semibold text-slate-800">Utente Amministratore</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input value={adminName} onChange={e => setAdminName(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">Privilegi</label>
          <div className="flex flex-wrap gap-2 text-xs">
            {(['AD','CR','MR','AR','RR','CW','MW','AW','RW'] as UserPrivilege[]).map(p => (
              <button key={p} type="button" onClick={() => togglePrivilege(p)}
                className={`px-2 py-1 rounded border ${adminPrivileges.includes(p) ? 'bg-masonic-gold text-white border-masonic-gold' : 'bg-white text-slate-700 border-slate-300'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleBootstrap} disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold disabled:opacity-50">
            {loading ? 'Inizializzazione…' : 'Inizializza Loggia'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupAdmin;
