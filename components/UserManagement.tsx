import React, { useState, useEffect } from 'react';
import { UserPrivilege, UserChangeLogEntry } from '../types';
import { Plus, Trash2, Edit2, Check, X, Loader2, Key } from 'lucide-react';

const AVAILABLE_PRIVILEGES: { code: UserPrivilege; label: string; description: string }[] = [
  { code: 'AD', label: 'Admin', description: 'Accesso totale, gestione utenti' },
  { code: 'CR', label: 'Craft Read', description: 'Lettura Craft' },
  { code: 'CW', label: 'Craft Write', description: 'Lettura e modifica Craft' },
  { code: 'MR', label: 'Mark Read', description: 'Lettura Marchio' },
  { code: 'MW', label: 'Mark Write', description: 'Lettura e modifica Marchio' },
  { code: 'AR', label: 'Ark Read', description: 'Lettura Arco' },
  { code: 'AW', label: 'Ark Write', description: 'Lettura e modifica Arco' },
  { code: 'RR', label: 'RAM Read', description: 'Lettura RAM' },
  { code: 'RW', label: 'RAM Write', description: 'Lettura e modifica RAM' },
];

interface SupabaseUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata: {
    name?: string;
    privileges?: UserPrivilege[];
  };
}

interface UserManagementProps {
  lodgeNumber: string;
  changelog?: UserChangeLogEntry[];
  canManage: boolean;
  canView: boolean;
  currentUserEmail?: string;
  authToken?: string;
  onChangelogChange?: (changelog: UserChangeLogEntry[]) => Promise<void> | void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  lodgeNumber,
  changelog = [],
  canManage,
  canView,
  currentUserEmail = 'Admin',
  authToken,
  onChangelogChange,
}) => {
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrivileges, setEditingPrivileges] = useState<UserPrivilege[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localChangelog, setLocalChangelog] = useState<UserChangeLogEntry[]>(changelog);
  const [deleteConfirmingUserId, setDeleteConfirmingUserId] = useState<string | null>(null);

  useEffect(() => {
    if ((changelog?.length || 0) >= localChangelog.length) {
      setLocalChangelog(changelog);
    }
  }, [changelog, localChangelog.length]);

  useEffect(() => {
    if (!lodgeNumber) {
      setUsers([]);
      setLoading(false);
      return;
    }
    loadUsers();
  }, [lodgeNumber]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const response = await fetch(`/.netlify/functions/manage-supabase-users?lodge=${lodgeNumber}`, { headers });
      const result = await response.json();

      if (result.success && result.users) {
        setUsers(result.users);
        setErrorMessage(null);
      } else if (result.error) {
        setErrorMessage(`Errore: ${result.error}`);
      } else {
        setErrorMessage('Errore nel caricamento utenti');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore nel caricamento utenti');
    } finally {
      setLoading(false);
    }
  };

  const addToChangelog = async (action: string, userEmail: string, details: string) => {
    const performedByEmail = currentUserEmail || 'system';
    const newEntry: UserChangeLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      userEmail,
      performedBy: performedByEmail,
      details,
    };

    let updatedChangelog = [newEntry, ...localChangelog];
    if (updatedChangelog.length > 100) {
      updatedChangelog = updatedChangelog.slice(0, 100);
    }

    setLocalChangelog(updatedChangelog);

    if (onChangelogChange) {
      await onChangelogChange(updatedChangelog);
    }
  };

  const handleAddUser = async () => {
    setErrorMessage(null);

    if (!newUserEmail || !newUserName || !newUserPassword) {
      setErrorMessage('Email, nome e password sono obbligatori');
      return;
    }

    if (newUserPassword.length < 8) {
      setErrorMessage('La password deve essere di almeno 8 caratteri');
      return;
    }

    try {
      setLoading(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const response = await fetch('/.netlify/functions/manage-supabase-users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create',
          lodgeNumber,
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          privileges: []
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Errore durante la creazione utente');
      }

      await loadUsers();
      await addToChangelog('CREATE', newUserEmail, `Utente creato: ${newUserName}`);

      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setSuccessMessage('Utente aggiunto con successo');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante la creazione utente');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: SupabaseUser) => {
    // If not confirming yet, just set the confirmation state
    if (deleteConfirmingUserId !== user.id) {
      setDeleteConfirmingUserId(user.id);
      return;
    }

    // If we're here, user has confirmed deletion
    try {
      setLoading(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const response = await fetch('/.netlify/functions/manage-supabase-users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'delete',
          lodgeNumber,
          email: user.email
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Errore durante l\'eliminazione utente');
      }

      await loadUsers();
      await addToChangelog('DELETE', user.email, `Utente eliminato: ${user.user_metadata?.name || user.email}`);

      setSuccessMessage('Utente eliminato con successo');
      setDeleteConfirmingUserId(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante l\'eliminazione utente');
      setDeleteConfirmingUserId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (user: SupabaseUser) => {
    setEditingId(user.id);
    setEditingName(user.user_metadata?.name || user.email);
    setEditingPrivileges(user.user_metadata?.privileges || []);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingPrivileges([]);
  };

  const handleTogglePrivilege = (privilege: UserPrivilege) => {
    setEditingPrivileges(prev =>
      prev.includes(privilege)
        ? prev.filter(p => p !== privilege)
        : [...prev, privilege]
    );
  };

  const handleSavePrivileges = async (user: SupabaseUser) => {
    try {
      setLoading(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const response = await fetch('/.netlify/functions/manage-supabase-users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'updatePrivileges',
          lodgeNumber,
          userId: user.id,
          email: user.email,
          name: editingName,
          privileges: editingPrivileges
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Errore durante l\'aggiornamento privilegi');
      }

      await loadUsers();
      const privString = editingPrivileges.length > 0 ? editingPrivileges.join(', ') : 'Nessuno';
      await addToChangelog('PRIVILEGE_CHANGE', user.email, `Privilegi modificati: ${privString}`);

      setEditingId(null);
      setEditingName('');
      setEditingPrivileges([]);
      setSuccessMessage('Privilegi aggiornati con successo');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante l\'aggiornamento privilegi');
    } finally {
      setLoading(false);
    }
  };

  const adminSelected = editingPrivileges.includes('AD');

  const getBranchLevel = (readCode: UserPrivilege, writeCode: UserPrivilege, privileges: UserPrivilege[]): 'none' | 'read' | 'write' => {
    if (privileges.includes(writeCode)) return 'write';
    if (privileges.includes(readCode)) return 'read';
    return 'none';
  };

  const setBranchLevel = (readCode: UserPrivilege, writeCode: UserPrivilege, level: 'none' | 'read' | 'write') => {
    setEditingPrivileges(prev => {
      let next = prev.filter(p => p !== readCode && p !== writeCode && p !== 'AD');
      if (adminSelected) {
        return ['AD'];
      }
      if (level === 'read') next = [...next, readCode];
      if (level === 'write') next = [...next, readCode, writeCode];
      return next;
    });
  };

  const toggleAdmin = (value: boolean) => {
    setEditingPrivileges(value ? ['AD'] : []);
  };

  if (!canView) {
    return <div className="text-center text-slate-500 p-4">Non hai permessi per visualizzare la gestione utenti</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Gestione Utenti Supabase</h3>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {successMessage}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="animate-spin" size={20} />
          <span className="text-slate-600">Caricamento...</span>
        </div>
      )}

      {canManage && (
        <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
          <h4 className="font-semibold text-slate-700 mb-3">Aggiungi Nuovo Utente</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <input
              type="email"
              placeholder="Email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-masonic-gold"
            />
            <input
              type="text"
              placeholder="Nome"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-masonic-gold"
            />
            <input
              type="password"
              placeholder="Password (min 8 car.)"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-masonic-gold"
            />
            <button
              onClick={handleAddUser}
              disabled={loading}
              className="bg-masonic-gold hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors text-sm disabled:opacity-50"
            >
              <Plus size={16} /> Aggiungi
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Privilegi</th>
              {canManage && <th className="text-center px-4 py-3 font-semibold text-slate-700">Azioni</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.length === 0 && !loading ? (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="text-center px-4 py-4 text-slate-500">
                  Nessun utente configurato
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{user.email}</td>
                  <td className="px-4 py-3">
                    {editingId === user.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                      />
                    ) : (
                      <span className="text-slate-800">{user.user_metadata?.name || user.email}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === user.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={adminSelected}
                              onChange={(e) => toggleAdmin(e.target.checked)}
                            />
                            <span className="font-semibold">Admin (accesso totale)</span>
                          </label>
                        </div>
                        {!adminSelected && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                              { label: 'Craft', r: 'CR', w: 'CW' },
                              { label: 'Mark', r: 'MR', w: 'MW' },
                              { label: 'Chapter', r: 'AR', w: 'AW' },
                              { label: 'RAM', r: 'RR', w: 'RW' }
                            ].map(({ label, r, w }) => (
                              <div key={label} className="flex flex-col gap-1 border border-slate-200 p-2 rounded">
                                <span className="font-semibold">{label}</span>
                                <label className="flex items-center gap-1">
                                  <input
                                    type="radio"
                                    checked={getBranchLevel(r as UserPrivilege, w as UserPrivilege, editingPrivileges) === 'none'}
                                    onChange={() => setBranchLevel(r as UserPrivilege, w as UserPrivilege, 'none')}
                                  />
                                  Nessuno
                                </label>
                                <label className="flex items-center gap-1">
                                  <input
                                    type="radio"
                                    checked={getBranchLevel(r as UserPrivilege, w as UserPrivilege, editingPrivileges) === 'read'}
                                    onChange={() => setBranchLevel(r as UserPrivilege, w as UserPrivilege, 'read')}
                                  />
                                  Read
                                </label>
                                <label className="flex items-center gap-1">
                                  <input
                                    type="radio"
                                    checked={getBranchLevel(r as UserPrivilege, w as UserPrivilege, editingPrivileges) === 'write'}
                                    onChange={() => setBranchLevel(r as UserPrivilege, w as UserPrivilege, 'write')}
                                  />
                                  Write
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSavePrivileges(user)}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check size={14} /> Salva
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
                          >
                            <X size={14} /> Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.user_metadata?.privileges && user.user_metadata.privileges.length > 0 ? (
                          user.user_metadata.privileges.map(p => (
                            <span key={p} className="px-2 py-1 bg-masonic-gold/10 text-masonic-gold rounded text-xs font-medium">
                              {AVAILABLE_PRIVILEGES.find(priv => priv.code === p)?.label || p}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-xs">Nessun privilegio</span>
                        )}
                      </div>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-center">
                      {editingId !== user.id && (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleStartEdit(user)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
                            title="Modifica privilegi"
                          >
                            <Edit2 size={16} />
                          </button>
                          {deleteConfirmingUserId === user.id ? (
                            <div className="flex flex-col gap-0.5 items-center">
                              <div className="text-[9px] text-slate-600 font-semibold whitespace-nowrap">Sicuro?</div>
                              <div className="flex gap-0.5">
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={loading}
                                  className="bg-red-500 hover:bg-red-600 disabled:bg-slate-400 text-white px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
                                >
                                  Sì
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmingUserId(null)}
                                  disabled={loading}
                                  className="bg-slate-300 hover:bg-slate-400 disabled:bg-slate-400 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                              title="Elimina utente"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Changelog */}
      {localChangelog.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Log Modifiche Utenti</h4>
          <div className="overflow-x-auto border border-slate-200 rounded-md bg-slate-50">
            <table className="w-full text-[10px] leading-tight">
              <thead className="bg-slate-200">
                <tr>
                  <th className="text-left px-2 py-1 font-semibold text-slate-700 w-32">Timestamp UTC</th>
                  <th className="text-left px-2 py-1 font-semibold text-slate-700">Descrizione</th>
                </tr>
              </thead>
              <tbody>
                {localChangelog.slice(0, 10).map((entry, idx) => (
                  <tr key={idx} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
                    <td className="px-2 py-1 text-slate-600 font-mono whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-2 py-1 text-slate-700">
                      {entry.action} per {entry.userEmail} da {entry.performedBy}
                      {entry.details && ` - ${entry.details}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
