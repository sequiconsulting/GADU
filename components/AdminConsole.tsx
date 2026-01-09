import React, { useEffect, useMemo, useState } from 'react';
import { Shield, RefreshCw, Plus, Trash2, Save, Users, Upload, Download } from 'lucide-react';
import { LodgeConfig } from '../types/lodge';

interface RegistryResponse {
  success: boolean;
  registry: Record<string, LodgeConfig>;
  error?: string;
}

type Tab = 'lodges' | 'registry' | 'users' | 'requests';

const ADMIN_PASSWORD_KEY = 'gadu_admin_session';
const ADMIN_API_BASE = (import.meta as any)?.env?.VITE_ADMIN_API_BASE ? ((import.meta as any).env.VITE_ADMIN_API_BASE as string).replace(/\/$/, '') : '';

function buildApiUrl(path: string) {
  return `${ADMIN_API_BASE}${path}`;
}

export const SuperadminConsole: React.FC = () => {
  const [auth, setAuth] = useState<string | null>(() => sessionStorage.getItem(ADMIN_PASSWORD_KEY));
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('lodges');
  // Stato richieste attivazione
  const [activationRequests, setActivationRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('pending');
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
    // Helpers richieste attivazione
    async function loadActivationRequests(status: string = 'pending') {
      setLoading(true);
      setRequestMessage(null);
      try {
        const res = await authorizedFetch(buildApiUrl('/.netlify/functions/admin-activation-requests'), {
          method: 'POST',
          body: JSON.stringify({ action: 'list', status })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Errore caricamento richieste');
        setActivationRequests(data.requests || []);
        setSelectedRequest(null);
      } catch (err: any) {
        setRequestMessage(err.message);
        setActivationRequests([]);
      } finally {
        setLoading(false);
      }
    }

    async function getActivationRequest(id: string) {
      setLoading(true);
      setRequestMessage(null);
      try {
        const res = await authorizedFetch(buildApiUrl('/.netlify/functions/admin-activation-requests'), {
          method: 'POST',
          body: JSON.stringify({ action: 'get', id })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Errore caricamento richiesta');
        setSelectedRequest(data.request);
      } catch (err: any) {
        setRequestMessage(err.message);
      } finally {
        setLoading(false);
      }
    }

    async function updateActivationRequest(id: string, update: any) {
      setLoading(true);
      setRequestMessage(null);
      try {
        const res = await authorizedFetch(buildApiUrl('/.netlify/functions/admin-activation-requests'), {
          method: 'POST',
          body: JSON.stringify({ action: 'update', id, update })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Errore salvataggio richiesta');
        setSelectedRequest(data.request);
        setRequestMessage('Richiesta aggiornata');
        await loadActivationRequests(requestStatusFilter);
      } catch (err: any) {
        setRequestMessage(err.message);
      } finally {
        setLoading(false);
      }
    }

    async function setActivationRequestStatus(id: string, status: string) {
      setLoading(true);
      setRequestMessage(null);
      try {
        const res = await authorizedFetch(buildApiUrl('/.netlify/functions/admin-activation-requests'), {
          method: 'POST',
          body: JSON.stringify({ action: 'setStatus', id, status })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Errore aggiornamento stato');
        setRequestMessage('Stato aggiornato');
        setSelectedRequest(null);
        await loadActivationRequests(requestStatusFilter);
      } catch (err: any) {
        setRequestMessage(err.message);
      } finally {
        setLoading(false);
      }
    }
  const [loading, setLoading] = useState(false);
  const [registry, setRegistry] = useState<Record<string, LodgeConfig>>({});
  const [selectedLodge, setSelectedLodge] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPassword, setUserPassword] = useState('123456789');
  const [form, setForm] = useState<Partial<LodgeConfig>>({ isActive: true });
  const [createLodgeMessage, setCreateLodgeMessage] = useState<string | null>(null);

  const [showCreateLodgeModal, setShowCreateLodgeModal] = useState(false);
  const [createLodgeDraft, setCreateLodgeDraft] = useState<Partial<LodgeConfig> & { secretaryEmail?: string }>({ isActive: true });
  const [createLodgeErrors, setCreateLodgeErrors] = useState<Record<string, string>>({});
  // Considera autenticato se esiste una password in sessione; la validazione vera è lato funzione (Bearer === ADMIN_INTERFACE_PASSWORD)
  const isAuthenticated = Boolean(auth);

  useEffect(() => {
    if (isAuthenticated) {
      void loadRegistry();
    }
  }, [isAuthenticated]);

  const sortedLodges = useMemo(() => (Object.values(registry) as LodgeConfig[]).sort((a, b) => a.glriNumber.localeCompare(b.glriNumber)), [registry]);

  async function authorizedFetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (!auth) throw new Error('Sessione admin mancante');
    headers.set('Authorization', `Bearer ${auth}`);
    return fetch(url, { ...options, headers });
  }

  async function loadRegistry() {
    setLoading(true);
    try {
      const res = await authorizedFetch(buildApiUrl('/.netlify/functions/admin-registry'), { method: 'POST', body: JSON.stringify({ action: 'list' }) });
      const data = await res.json() as RegistryResponse;
      if (res.status === 401) {
        setAuth(null);
        sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
        throw new Error('Unauthorized: verifica la password admin');
      }
      if (!res.ok || !data.success) throw new Error(data.error || 'Errore caricamento registry');
      setRegistry(data.registry || {});
      setAuthError(null);
      if (!selectedLodge) {
        const first = Object.keys(data.registry || {})[0];
        if (first) setSelectedLodge(first);
      }
    } catch (err: any) {
      setAuthError(err.message);
      setRegistry({});
    } finally {
      setLoading(false);
    }
  }

  async function saveLodge() {
    setLoading(true);
    try {
      const res = await authorizedFetch(buildApiUrl('/.netlify/functions/admin-registry'), { method: 'POST', body: JSON.stringify({ action: 'upsert', lodge: form }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Errore salvataggio');
      setRegistry(data.registry || {});
      setForm({ isActive: true });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteLodge(glriNumber: string) {
    if (!confirm(`Eliminare la loggia ${glriNumber}?`)) return;
    setLoading(true);
    try {
      const res = await authorizedFetch(buildApiUrl('/.netlify/functions/admin-registry'), { method: 'POST', body: JSON.stringify({ action: 'delete', lodge: { glriNumber } }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Errore eliminazione');
      setRegistry(data.registry || {});
      if (selectedLodge === glriNumber) setSelectedLodge('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers(glriNumber: string) {
    setLoading(true);
    try {
      const res = await authorizedFetch(buildApiUrl(`/.netlify/functions/manage-supabase-users?lodge=${glriNumber}`), { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento utenti');
      setUsers(data.users || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    if (!selectedLodge) return alert('Seleziona una loggia');
    setLoading(true);
    try {
      const res = await authorizedFetch(buildApiUrl('/.netlify/functions/manage-supabase-users'), {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          lodgeNumber: selectedLodge,
          email: userEmail,
          name: userName,
          password: userPassword,
          privileges: ['AD'],
          mustChangePassword: true,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Errore creazione utente');
      await loadUsers(selectedLodge);
      setUserEmail('');
      setUserName('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function validateCreateLodgeDraft(draft: Partial<LodgeConfig> & { secretaryEmail?: string }) {
    const errors: Record<string, string> = {};
    const required: Array<[keyof (Partial<LodgeConfig> & { secretaryEmail?: string }), string]> = [
      ['glriNumber', 'GLRI Number obbligatorio'],
      ['lodgeName', 'Nome loggia obbligatorio'],
      ['province', 'Provincia obbligatoria'],
      ['supabaseUrl', 'Supabase URL obbligatorio'],
      ['supabaseAnonKey', 'Anon key obbligatoria'],
      ['supabaseServiceKey', 'Service key obbligatoria'],
      ['databasePassword', 'Database password obbligatoria'],
      ['secretaryEmail', 'Email Segretario obbligatoria'],
    ];
    for (const [key, msg] of required) {
      const val = (draft as any)[key];
      if (!val || String(val).trim() === '') errors[String(key)] = msg;
    }
    if (draft.supabaseUrl && !/^https:\/\/.+\.supabase\.co$/.test(String(draft.supabaseUrl).trim())) {
      errors.supabaseUrl = 'Supabase URL non valido';
    }
    if (draft.secretaryEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(draft.secretaryEmail).trim())) {
        errors.secretaryEmail = 'Email Segretario non valida';
      }
    }
    return errors;
  }

  function openCreateLodgeModalFromForm() {
    setCreateLodgeMessage(null);
    setCreateLodgeErrors({});
    setCreateLodgeDraft({
      ...form,
      isActive: true,
      secretaryEmail: ((form as any).lodgeEmail || '').trim(),
    } as any);
    setShowCreateLodgeModal(true);
  }

  async function createNewLodge() {
    setCreateLodgeMessage(null);
    setLoading(true);
    try {
      const secretaryEmail = (createLodgeDraft.secretaryEmail || '').trim();
      const payload = {
        glriNumber: (createLodgeDraft.glriNumber || '').trim(),
        lodgeName: (createLodgeDraft.lodgeName || '').trim(),
        province: (createLodgeDraft.province || '').trim(),
        supabaseUrl: (createLodgeDraft.supabaseUrl || '').trim(),
        supabaseAnonKey: createLodgeDraft.supabaseAnonKey,
        supabaseServiceKey: createLodgeDraft.supabaseServiceKey,
        databasePassword: createLodgeDraft.databasePassword,
        secretaryEmail,
        associationName: createLodgeDraft.associationName,
        address: createLodgeDraft.address,
        zipCode: createLodgeDraft.zipCode,
        city: createLodgeDraft.city,
        taxCode: createLodgeDraft.taxCode,
      };

      const res = await authorizedFetch(buildApiUrl('/.netlify/functions/create-lodge'), {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409) {
        throw new Error(data.error || 'Loggia già esistente');
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Errore creazione loggia');
      }

      setCreateLodgeMessage(`Loggia ${data.glriNumber} creata con successo`);
      setShowCreateLodgeModal(false);
      await loadRegistry();
    } catch (err: any) {
      setCreateLodgeMessage(err.message || 'Errore creazione loggia');
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-masonic-gold/10 flex items-center justify-center"><Shield className="text-masonic-gold" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Accesso Superadmin</h1>
              <p className="text-sm text-slate-600">Inserisci la password amministrativa</p>
            </div>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-masonic-gold"
            placeholder="Password"
            autoFocus
          />
          {authError && <div className="mt-3 text-sm text-red-600">{authError}</div>}
          <button
            onClick={() => {
              if (!password) {
                setAuthError('Inserisci la password');
                return;
              }
              sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
              setAuth(password);
              setAuthError(null);
            }}
            className="mt-4 w-full bg-masonic-gold text-white font-semibold py-2 rounded-lg hover:bg-yellow-600"
          >
            Entra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {authError && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3">
            <div className="font-semibold">Errore</div>
            <div className="text-sm whitespace-pre-line">{authError}</div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Console Superadmin</h1>
            <p className="text-sm text-slate-500">Gestione registry, logge e utenti</p>
          </div>
          <button onClick={loadRegistry} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-100"><RefreshCw size={16}/> Aggiorna</button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setActiveTab('lodges')} className={`px-4 py-2 rounded-lg ${activeTab==='lodges'?'bg-slate-900 text-white':'bg-white border border-slate-200 text-slate-700'}`}>Logge</button>
          <button onClick={() => setActiveTab('registry')} className={`px-4 py-2 rounded-lg ${activeTab==='registry'?'bg-slate-900 text-white':'bg-white border border-slate-200 text-slate-700'}`}>Registry</button>
          <button onClick={() => { setActiveTab('users'); if (selectedLodge) void loadUsers(selectedLodge); }} className={`px-4 py-2 rounded-lg ${activeTab==='users'?'bg-slate-900 text-white':'bg-white border border-slate-200 text-slate-700'}`}>Utenti</button>
          <button onClick={() => { setActiveTab('requests'); void loadActivationRequests(requestStatusFilter); }} className={`px-4 py-2 rounded-lg ${activeTab==='requests'?'bg-slate-900 text-white':'bg-white border border-slate-200 text-slate-700'}`}>Richieste</button>
        </div>
        {activeTab === 'requests' && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Shield size={16}/> <h3 className="font-semibold">Richieste attivazione</h3></div>
              <div className="flex gap-2">
                <select value={requestStatusFilter} onChange={e=>{setRequestStatusFilter(e.target.value); void loadActivationRequests(e.target.value);}} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                  <option value="pending">Pendenti</option>
                  <option value="completed">Completate</option>
                  <option value="cancelled">Annullate</option>
                  <option value="all">Tutte</option>
                </select>
                <button onClick={()=>loadActivationRequests(requestStatusFilter)} className="px-3 py-1 border border-slate-200 rounded-lg text-xs">Aggiorna</button>
              </div>
            </div>
            {requestMessage && <div className="mb-2 text-sm text-red-600">{requestMessage}</div>}
            {!selectedRequest ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto text-sm">
                {activationRequests.map(r => (
                  <div key={r.id} className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{r.lodgeName} ({r.glriNumber})</div>
                      <div className="text-xs text-slate-500">{r.associationName} - {r.city} ({r.province})</div>
                      <div className="text-xs text-slate-400">Stato: {r.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-slate-600 hover:text-slate-900" onClick={()=>getActivationRequest(r.id)}>Apri</button>
                    </div>
                  </div>
                ))}
                {activationRequests.length === 0 && <div className="text-slate-500 text-sm">Nessuna richiesta</div>}
              </div>
            ) : (
              <div className="space-y-4">
                <button className="text-xs text-slate-500 underline" onClick={()=>setSelectedRequest(null)}>← Torna all'elenco</button>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="GLRI Number" value={selectedRequest.glriNumber || ''} onChange={e=>setSelectedRequest({...selectedRequest, glriNumber:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                  <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="Nome loggia" value={selectedRequest.lodgeName || ''} onChange={e=>setSelectedRequest({...selectedRequest, lodgeName:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                  <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="Provincia" value={selectedRequest.province || ''} onChange={e=>setSelectedRequest({...selectedRequest, province:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                  <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="Associazione" value={selectedRequest.associationName || ''} onChange={e=>setSelectedRequest({...selectedRequest, associationName:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                  <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Indirizzo" value={selectedRequest.address || ''} onChange={e=>setSelectedRequest({...selectedRequest, address:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                  <input className="border border-slate-200 rounded-lg px-3 py-2" placeholder="CAP" value={selectedRequest.zipCode || ''} onChange={e=>setSelectedRequest({...selectedRequest, zipCode:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                  <input className="border border-slate-200 rounded-lg px-3 py-2" placeholder="Città" value={selectedRequest.city || ''} onChange={e=>setSelectedRequest({...selectedRequest, city:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                  <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Codice Fiscale" value={selectedRequest.taxCode || ''} onChange={e=>setSelectedRequest({...selectedRequest, taxCode:e.target.value})} disabled={selectedRequest.status!=='pending'}/>
                </div>
                <div className="flex gap-2 mt-2">
                  {selectedRequest.status==='pending' && <button disabled={loading} onClick={()=>updateActivationRequest(selectedRequest.id, selectedRequest)} className="bg-slate-900 text-white rounded-lg py-2 px-4 flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50">Salva</button>}
                  {selectedRequest.status==='pending' && <button disabled={loading} onClick={()=>setActivationRequestStatus(selectedRequest.id, 'completed')} className="bg-green-600 text-white rounded-lg py-2 px-4 flex items-center gap-2 hover:bg-green-700 disabled:opacity-50">Segna completata</button>}
                  {selectedRequest.status==='pending' && <button disabled={loading} onClick={()=>setActivationRequestStatus(selectedRequest.id, 'cancelled')} className="bg-red-600 text-white rounded-lg py-2 px-4 flex items-center gap-2 hover:bg-red-700 disabled:opacity-50">Annulla</button>}
                  {(selectedRequest.status==='completed'||selectedRequest.status==='cancelled') && <span className="text-xs text-slate-500">Richiesta {selectedRequest.status}</span>}
                </div>
                <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto max-h-[300px]">{JSON.stringify(selectedRequest, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'lodges' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Elenco Logge</h3>
                <span className="text-xs text-slate-500">{sortedLodges.length} logge</span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {sortedLodges.map(l => (
                  <div key={l.glriNumber} className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{l.glriNumber} - {l.lodgeName}</div>
                      <div className="text-xs text-slate-500">{l.supabaseUrl}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setForm(l)} className="text-slate-600 hover:text-slate-900"><Save size={16}/></button>
                      <button onClick={() => deleteLodge(l.glriNumber)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
                {sortedLodges.length === 0 && <div className="text-sm text-slate-500">Nessuna loggia</div>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2"><Plus size={16}/> <h3 className="font-semibold">Nuova/Modifica Loggia</h3></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="GLRI Number" value={form.glriNumber || ''} onChange={(e)=>setForm({...form, glriNumber:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="Nome loggia" value={form.lodgeName || ''} onChange={(e)=>setForm({...form, lodgeName:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="Provincia" value={form.province || ''} onChange={(e)=>setForm({...form, province:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-1" placeholder="Associazione" value={form.associationName || ''} onChange={(e)=>setForm({...form, associationName:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Indirizzo" value={form.address || ''} onChange={(e)=>setForm({...form, address:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2" placeholder="CAP" value={form.zipCode || ''} onChange={(e)=>setForm({...form, zipCode:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2" placeholder="Città" value={form.city || ''} onChange={(e)=>setForm({...form, city:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Codice Fiscale" value={form.taxCode || ''} onChange={(e)=>setForm({...form, taxCode:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Supabase URL" value={form.supabaseUrl || ''} onChange={(e)=>setForm({...form, supabaseUrl:e.target.value})}/>
                <textarea className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Anon key" value={form.supabaseAnonKey || ''} onChange={(e)=>setForm({...form, supabaseAnonKey:e.target.value})}/>
                <textarea className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Service key" value={form.supabaseServiceKey || ''} onChange={(e)=>setForm({...form, supabaseServiceKey:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Database password" value={form.databasePassword || ''} onChange={(e)=>setForm({...form, databasePassword:e.target.value})}/>
                <input className="border border-slate-200 rounded-lg px-3 py-2 col-span-2" placeholder="Email Segretario" value={(form as any).lodgeEmail || ''} onChange={(e)=>setForm({...form, lodgeEmail:e.target.value} as any)}/>
              </div>
              {createLodgeMessage && (
                <div className={`text-sm rounded-lg px-3 py-2 ${createLodgeMessage.toLowerCase().includes('successo') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  {createLodgeMessage}
                </div>
              )}
              <button disabled={loading} onClick={saveLodge} className="w-full bg-slate-900 text-white rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50"><Save size={16}/> Salva loggia</button>
              <button disabled={loading} onClick={openCreateLodgeModalFromForm} className="w-full bg-masonic-gold text-white rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-yellow-600 disabled:opacity-50"><Plus size={16}/> Crea nuova loggia…</button>
            </div>
          </div>
        )}

        {showCreateLodgeModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold">Crea nuova loggia</div>
                  <div className="text-xs text-slate-500">Verifica credenziali DB → registry (inattiva) → schema → utente Segretario → attivazione.</div>
                </div>
                <button
                  disabled={loading}
                  onClick={() => { setShowCreateLodgeModal(false); setCreateLodgeErrors({}); }}
                  className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Chiudi
                </button>
              </div>

              <div className="p-5 space-y-4">
                {createLodgeMessage && (
                  <div className={`text-sm rounded-lg px-3 py-2 ${createLodgeMessage.toLowerCase().includes('successo') ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                    {createLodgeMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <input className={`w-full border rounded-lg px-3 py-2 ${createLodgeErrors.glriNumber ? 'border-red-300' : 'border-slate-200'}`} placeholder="GLRI Number" value={createLodgeDraft.glriNumber || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, glriNumber: e.target.value }))}/>
                    {createLodgeErrors.glriNumber && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.glriNumber}</div>}
                  </div>
                  <div>
                    <input className={`w-full border rounded-lg px-3 py-2 ${createLodgeErrors.province ? 'border-red-300' : 'border-slate-200'}`} placeholder="Provincia" value={createLodgeDraft.province || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, province: e.target.value }))}/>
                    {createLodgeErrors.province && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.province}</div>}
                  </div>
                  <div className="md:col-span-2">
                    <input className={`w-full border rounded-lg px-3 py-2 ${createLodgeErrors.lodgeName ? 'border-red-300' : 'border-slate-200'}`} placeholder="Nome loggia" value={createLodgeDraft.lodgeName || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, lodgeName: e.target.value }))}/>
                    {createLodgeErrors.lodgeName && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.lodgeName}</div>}
                  </div>

                  <div>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="Associazione (opzionale)" value={createLodgeDraft.associationName || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, associationName: e.target.value }))}/>
                  </div>
                  <div>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="Codice Fiscale (opzionale)" value={createLodgeDraft.taxCode || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, taxCode: e.target.value }))}/>
                  </div>
                  <div className="md:col-span-2">
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="Indirizzo (opzionale)" value={createLodgeDraft.address || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, address: e.target.value }))}/>
                  </div>
                  <div>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="CAP (opzionale)" value={createLodgeDraft.zipCode || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, zipCode: e.target.value }))}/>
                  </div>
                  <div>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="Città (opzionale)" value={createLodgeDraft.city || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, city: e.target.value }))}/>
                  </div>

                  <div className="md:col-span-2">
                    <input className={`w-full border rounded-lg px-3 py-2 ${createLodgeErrors.supabaseUrl ? 'border-red-300' : 'border-slate-200'}`} placeholder="Supabase URL" value={createLodgeDraft.supabaseUrl || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, supabaseUrl: e.target.value }))}/>
                    {createLodgeErrors.supabaseUrl && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.supabaseUrl}</div>}
                  </div>
                  <div className="md:col-span-2">
                    <textarea className={`w-full border rounded-lg px-3 py-2 h-20 ${createLodgeErrors.supabaseAnonKey ? 'border-red-300' : 'border-slate-200'}`} placeholder="Anon key" value={createLodgeDraft.supabaseAnonKey || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, supabaseAnonKey: e.target.value }))}/>
                    {createLodgeErrors.supabaseAnonKey && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.supabaseAnonKey}</div>}
                  </div>
                  <div className="md:col-span-2">
                    <textarea className={`w-full border rounded-lg px-3 py-2 h-20 ${createLodgeErrors.supabaseServiceKey ? 'border-red-300' : 'border-slate-200'}`} placeholder="Service key" value={createLodgeDraft.supabaseServiceKey || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, supabaseServiceKey: e.target.value }))}/>
                    {createLodgeErrors.supabaseServiceKey && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.supabaseServiceKey}</div>}
                  </div>
                  <div className="md:col-span-2">
                    <input className={`w-full border rounded-lg px-3 py-2 ${createLodgeErrors.databasePassword ? 'border-red-300' : 'border-slate-200'}`} placeholder="Database password" value={createLodgeDraft.databasePassword || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, databasePassword: e.target.value }))}/>
                    {createLodgeErrors.databasePassword && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.databasePassword}</div>}
                  </div>
                  <div className="md:col-span-2">
                    <input className={`w-full border rounded-lg px-3 py-2 ${createLodgeErrors.secretaryEmail ? 'border-red-300' : 'border-slate-200'}`} placeholder="Email Segretario" value={createLodgeDraft.secretaryEmail || ''} onChange={(e)=>setCreateLodgeDraft(prev=>({ ...prev, secretaryEmail: e.target.value }))}/>
                    {createLodgeErrors.secretaryEmail && <div className="text-xs text-red-600 mt-1">{createLodgeErrors.secretaryEmail}</div>}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    disabled={loading}
                    onClick={() => { setShowCreateLodgeModal(false); setCreateLodgeErrors({}); }}
                    className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Annulla
                  </button>
                  <button
                    disabled={loading}
                    onClick={async () => {
                      const errors = validateCreateLodgeDraft(createLodgeDraft);
                      setCreateLodgeErrors(errors);
                      if (Object.keys(errors).length > 0) return;
                      await createNewLodge();
                    }}
                    className="px-4 py-2 rounded-lg bg-masonic-gold text-white font-semibold hover:bg-yellow-600 disabled:opacity-50"
                  >
                    {loading ? 'Creazione in corso…' : 'Crea loggia'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'registry' && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Download size={16}/> <h3 className="font-semibold">Registry corrente</h3></div>
              <div className="flex gap-2">
                <button onClick={loadRegistry} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">Ricarica</button>
              </div>
            </div>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto max-h-[500px]">{JSON.stringify(registry, null, 2)}</pre>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Users size={16}/> Seleziona loggia</h3>
              <select value={selectedLodge} onChange={(e)=>{setSelectedLodge(e.target.value); if (e.target.value) void loadUsers(e.target.value);}} className="w-full border border-slate-200 rounded-lg px-3 py-2">
                <option value="">-- Seleziona --</option>
                {sortedLodges.map(l => (
                  <option key={l.glriNumber} value={l.glriNumber}>{l.glriNumber} - {l.lodgeName}</option>
                ))}
              </select>
              <div className="space-y-2">
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="Email" value={userEmail} onChange={(e)=>setUserEmail(e.target.value)}/>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="Nome" value={userName} onChange={(e)=>setUserName(e.target.value)}/>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="Password" value={userPassword} onChange={(e)=>setUserPassword(e.target.value)}/>
                <div className="text-xs text-slate-500 px-1">Privilegio assegnato: <span className="font-semibold text-slate-700">AD</span></div>
                <button disabled={!selectedLodge || loading} onClick={createUser} className="w-full bg-slate-900 text-white rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50"><Upload size={16}/> Crea utente</button>
              </div>
            </div>
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Utenti loggia {selectedLodge || '-'}</h3>
                {selectedLodge && <button onClick={()=>loadUsers(selectedLodge)} className="px-3 py-1 border border-slate-200 rounded-lg text-xs">Aggiorna</button>}
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto text-sm">
                {users.map(u => (
                  <div key={u.email} className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{u.user_metadata?.name ? `${u.user_metadata.name} — ${u.email}` : u.email}</div>
                      <div className="text-xs text-slate-500">Privilegi: {(((u.user_metadata?.privileges || u.privileges) || []) as any[]).join(', ')}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-red-500 hover:text-red-700" onClick={async ()=>{
                        if (!confirm(`Eliminare ${u.email}?`)) return;
                        setLoading(true);
                        try {
                          const res = await authorizedFetch(buildApiUrl('/.netlify/functions/manage-supabase-users'), { method:'POST', body: JSON.stringify({ action:'delete', lodgeNumber: selectedLodge, email: u.email }) });
                          const data = await res.json();
                          if (!res.ok || !data.success) throw new Error(data.error || 'Errore eliminazione');
                          await loadUsers(selectedLodge);
                        } catch (err:any) { alert(err.message); } finally { setLoading(false);} 
                      }}><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="text-slate-500 text-sm">Nessun utente</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminConsole;
