import React, { useState, useEffect } from 'react';
import { AppUser, UserPrivilege } from '../types';
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
  canManage: boolean; // Can edit users
  canView: boolean;   // Can view users list
  onUsersChange: (users: AppUser[]) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  canManage,
  canView,
  onUsersChange,
}) => {
  const [localUsers, setLocalUsers] = useState<AppUser[]>(users);
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

    setNewUserEmail('');
    setNewUserName('');
    setSuccessMessage('Utente aggiunto con successo');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Sei sicuro di voler eliminare questo utente?')) {
      const updated = localUsers.filter(u => u.id !== userId);
      setLocalUsers(updated);
      onUsersChange(updated);
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
    const updated = localUsers.map(u =>
      u.id === userId
        ? { ...u, privileges: selectedPrivileges, updatedAt: new Date().toISOString() }
        : u
    );
    setLocalUsers(updated);
    onUsersChange(updated);
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

      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
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
    </div>
  );
};
