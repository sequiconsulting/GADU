import React, { useState, useEffect } from 'react';
import { AppUser, UserPrivilege, UserChangeLogEntry } from '../types';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';

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

interface UserManagementProps {
  users: AppUser[];
  changelog?: UserChangeLogEntry[];
  canManage: boolean; // Can edit users
  canView: boolean;   // Can view users list
  currentUserEmail?: string; // Current logged-in user (for changelog tracking)
  onUsersChange: (users: AppUser[]) => void;
  onChangelogChange?: (changelog: UserChangeLogEntry[]) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  changelog = [],
  canManage,
  canView,
  currentUserEmail = 'Admin', // Placeholder, will be actual email when auth is enabled
  onUsersChange,
  onChangelogChange,
}) => {
  const [localUsers, setLocalUsers] = useState<AppUser[]>(users);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPrivilegeSelector, setShowPrivilegeSelector] = useState(false);
  const [selectedPrivileges, setSelectedPrivileges] = useState<UserPrivilege[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  const addToChangelog = (action: string, userEmail: string, details: string) => {
    const newEntry: UserChangeLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      userEmail,
      performedBy: currentUserEmail,
      details,
    };

    let updatedChangelog = [newEntry, ...changelog];
    // Keep only last 100 entries
    if (updatedChangelog.length > 100) {
      updatedChangelog = updatedChangelog.slice(0, 100);
    }

    if (onChangelogChange) {
      onChangelogChange(updatedChangelog);
    }
  };

  const handleAddUser = () => {
    setErrorMessage(null);

    if (!newUserEmail || !newUserName) {
      setErrorMessage('Email e nome sono obbligatori');
      return;
    }

    if (localUsers.some(u => u.email === newUserEmail)) {
      setErrorMessage('Un utente con questa email esiste già');
      return;
    }

    const newUser: AppUser = {
      id: `user_${Date.now()}`,
      email: newUserEmail,
      name: newUserName,
      privileges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...localUsers, newUser];
    setLocalUsers(updated);
    onUsersChange(updated);

    addToChangelog('CREATE', newUserEmail, `Utente creato: ${newUserName}`);

    setNewUserEmail('');
    setNewUserName('');
    setSuccessMessage('Utente aggiunto con successo');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo utente?')) {
      const deletedUser = localUsers.find(u => u.id === userId);
      const updated = localUsers.filter(u => u.id !== userId);
      setLocalUsers(updated);
      onUsersChange(updated);

      if (deletedUser) {
        addToChangelog('DELETE', deletedUser.email, `Utente eliminato: ${deletedUser.name}`);
      }

      setSuccessMessage('Utente eliminato');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleStartEdit = (userId: string) => {
    const user = localUsers.find(u => u.id === userId);
    if (user) {
      setEditingId(userId);
      setSelectedPrivileges([...user.privileges]);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedPrivileges([]);
  };

  const handleTogglePrivilege = (privilege: UserPrivilege) => {
    setSelectedPrivileges(prev =>
      prev.includes(privilege)
        ? prev.filter(p => p !== privilege)
        : [...prev, privilege]
    );
  };

  const handleSavePrivileges = (userId: string) => {
    const user = localUsers.find(u => u.id === userId);
    const updated = localUsers.map(u =>
      u.id === userId
        ? { ...u, privileges: selectedPrivileges, updatedAt: new Date().toISOString() }
        : u
    );
    setLocalUsers(updated);
    onUsersChange(updated);

    if (user) {
      const privString = selectedPrivileges.length > 0 ? selectedPrivileges.join(', ') : 'Nessuno';
      addToChangelog('PRIVILEGE_CHANGE', user.email, `Privilegi modificati: ${privString}`);
    }

    setEditingId(null);
    setSelectedPrivileges([]);
    setSuccessMessage('Privilegi aggiornati');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  if (!canView) {
    return <div className="text-center text-slate-500 p-4">Non hai permessi per visualizzare la gestione utenti</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Gestione Utenti</h3>

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

      {canManage && (
        <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
          <h4 className="font-semibold text-slate-700 mb-3">Aggiungi Nuovo Utente</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
            <button
              onClick={handleAddUser}
              className="bg-masonic-gold hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors text-sm"
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
            {localUsers.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="text-center px-4 py-4 text-slate-500">
                  Nessun utente configurato
                </td>
              </tr>
            ) : (
              localUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{user.email}</td>
                  <td className="px-4 py-3 text-slate-800">{user.name}</td>
                  <td className="px-4 py-3">
                    {editingId === user.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 max-w-3xl">
                          {AVAILABLE_PRIVILEGES.map(priv => (
                            <label key={priv.code} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedPrivileges.includes(priv.code)}
                                onChange={() => handleTogglePrivilege(priv.code)}
                                className="rounded"
                              />
                              <span className="text-xs text-slate-700">{priv.code}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSavePrivileges(user.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
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
                      <div className="flex gap-1 flex-wrap">
                        {user.privileges.length === 0 ? (
                          <span className="text-slate-400 italic text-xs">Nessuno</span>
                        ) : (
                          user.privileges.map(priv => (
                            <span
                              key={priv}
                              className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-semibold"
                            >
                              {priv}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-center">
                      {editingId !== user.id && (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleStartEdit(user.id)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Modifica privilegi"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Elimina utente"
                          >
                            <Trash2 size={16} />
                          </button>
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

      <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h4 className="font-semibold text-slate-700 mb-2 text-xs">Legenda Privilegi</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {AVAILABLE_PRIVILEGES.map(priv => (
            <div key={priv.code} className="text-xs">
              <span className="font-semibold text-slate-800">{priv.label}</span>
              <p className="text-slate-600">{priv.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Storico Modifiche Utenti</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-md bg-slate-50">
          <table className="w-full text-[10px] leading-tight">
            <thead className="bg-slate-200">
              <tr>
                <th className="text-left px-2 py-1 font-semibold text-slate-700 w-40">Timestamp UTC</th>
                <th className="text-left px-2 py-1 font-semibold text-slate-700">Descrizione</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const sorted = [...changelog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const pageItems = sorted.slice(start, end);
                
                if (pageItems.length === 0) {
                  return (
                    <tr>
                      <td colSpan={2} className="text-center px-2 py-2 text-slate-500">
                        Nessuna modifica registrata
                      </td>
                    </tr>
                  );
                }
                
                return pageItems.map((entry, idx) => {
                  const description = `[${entry.action}] ${entry.userEmail} (modificato da ${entry.performedBy || 'Admin'}): ${entry.details}`;
                  return (
                    <tr key={idx} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'}`}>
                      <td className="px-2 py-1 text-slate-600 font-mono whitespace-nowrap">{entry.timestamp}</td>
                      <td className="px-2 py-1 text-slate-700">{description}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        {changelog.length > 5 && (
          <div className="flex justify-between items-center mt-2 text-[10px] text-slate-600">
            <button 
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
            >
              ← Precedente
            </button>
            <span>Pagina {currentPage + 1} di {Math.ceil(changelog.length / itemsPerPage)}</span>
            <button 
              onClick={() => setCurrentPage(Math.min(Math.ceil(changelog.length / itemsPerPage) - 1, currentPage + 1))}
              disabled={(currentPage + 1) * itemsPerPage >= changelog.length}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
            >
              Successivo →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
