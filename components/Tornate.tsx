import React, { useState } from 'react';
import { BranchType, AppSettings, Convocazione } from '../types';
import { BRANCHES } from '../constants';
import { dataService } from '../services/dataService';
import { BookOpen, Plus, Edit2, Lock, Unlock, Trash2, Save, X, Printer } from 'lucide-react';

interface TornateProps {
  settings: AppSettings;
  selectedYear: number;
  onUpdate: () => void;
}

export const Tornate: React.FC<TornateProps> = ({ settings, selectedYear, onUpdate }) => {
  const [activeBranch, setActiveBranch] = useState<BranchType>('CRAFT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Convocazione> | null>(null);
  const [loading, setLoading] = useState(false);

  const convocazioni = (settings.convocazioni || []).filter(
    c => c.branchType === activeBranch && c.yearStart === selectedYear
  );

  const getNextNumero = (): number => {
    // Find max numero across ALL years for this branch
    const allBranchConvocazioni = (settings.convocazioni || []).filter(c => c.branchType === activeBranch);
    const maxNumero = allBranchConvocazioni.reduce((max, c) => Math.max(max, c.numeroConvocazione), 0);
    return maxNumero + 1;
  };

  const isNumeroUnique = (numero: number, excludeId?: string): boolean => {
    return !(settings.convocazioni || []).some(
      c => c.branchType === activeBranch && c.numeroConvocazione === numero && c.id !== excludeId
    );
  };

  const handlePrint = (convocazione: Convocazione, options: { mostraPiedilista: boolean; nomiCriptati: boolean }) => {
    // TODO: Generate PDF with specified options
    // For now, open print dialog
    const data = JSON.stringify({ convocazione, options }, null, 2);
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`<pre>${data}</pre>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleNewConvocazione = () => {
    setEditingId('new');
    setEditingData({
      branchType: activeBranch,
      yearStart: selectedYear,
      numeroConvocazione: getNextNumero(),
      dataConvocazione: new Date().toISOString().split('T')[0],
      dataOraApertura: new Date().toISOString().slice(0, 16),
      luogo: '',
      ordineDelGiorno: '',
      note: '',
      formatoGrafico: 'standard',
      bloccata: false,
    });
  };

  const handleEdit = (convocazione: Convocazione) => {
    setEditingId(convocazione.id);
    setEditingData({ ...convocazione });
  };

  const handleSave = async () => {
    if (!editingData) return;
    setLoading(true);
    try {
      const updated = { ...settings, convocazioni: settings.convocazioni || [] };
      const now = new Date().toISOString();

      if (editingId === 'new') {
        const newConvocazione: Convocazione = {
          id: `conv_${Date.now()}`,
          ...editingData,
          bloccata: true,
          createdAt: now,
          updatedAt: now,
        };
        updated.convocazioni = [...updated.convocazioni, newConvocazione];
      } else {
        updated.convocazioni = updated.convocazioni.map(c =>
          c.id === editingId
            ? { ...editingData, id: editingId, createdAt: c.createdAt, updatedAt: now } as Convocazione
            : c
        );
      }

      await dataService.saveSettings(updated);
      setEditingId(null);
      setEditingData(null);
      await onUpdate();
    } catch (e) {
      console.error('Error saving convocazione', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa convocazione?')) return;
    setLoading(true);
    try {
      const updated = { ...settings, convocazioni: settings.convocazioni?.filter(c => c.id !== id) || [] };
      await dataService.saveSettings(updated);
      await onUpdate();
    } catch (e) {
      console.error('Error deleting convocazione', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (convocazione: Convocazione) => {
    setLoading(true);
    try {
      const updated = { ...settings, convocazioni: settings.convocazioni || [] };
      updated.convocazioni = updated.convocazioni.map(c =>
        c.id === convocazione.id
          ? { ...c, bloccata: !c.bloccata, updatedAt: new Date().toISOString() }
          : c
      );
      await dataService.saveSettings(updated);
      await onUpdate();
    } catch (e) {
      console.error('Error toggling lock', e);
    } finally {
      setLoading(false);
    }
  };

  const branchConfig = BRANCHES.find(b => b.type === activeBranch);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn">
      <div className="bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={24} className="text-masonic-gold" />
          <h2 className="text-xl font-serif font-bold">Tornate - Anno {selectedYear}-{selectedYear + 1}</h2>
        </div>
        <p className="text-slate-400 text-sm">Gestisci convocazioni e ordini del giorno per ogni ramo.</p>
      </div>

      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto scrollbar-hide">
        {BRANCHES.map(b => (
          <button
            key={b.type}
            onClick={() => setActiveBranch(b.type)}
            className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex items-center gap-2 flex-shrink-0 ${
              activeBranch === b.type
                ? `${b.color.replace('bg-', 'border-')} ${b.color.replace('bg-', 'text-')} bg-white`
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${b.color}`} />
            {b.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {editingId ? (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
            <h3 className="font-semibold text-slate-800">
              {editingId === 'new' ? 'Nuova Convocazione' : 'Modifica Convocazione'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Numero Convocazione</label>
                <input
                  type="number"
                  value={editingData?.numeroConvocazione || ''}
                  onChange={(e) => setEditingData(prev => prev ? { ...prev, numeroConvocazione: parseInt(e.target.value) || 0 } : prev)}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-masonic-gold"
                  min="1"
                />
                {editingData && !isNumeroUnique(editingData.numeroConvocazione, editingId === 'new' ? undefined : editingId) && (
                  <p className="text-red-600 text-xs mt-1">Numero già utilizzato per questo ramo</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Data Convocazione</label>
                <input
                  type="date"
                  value={editingData?.dataConvocazione || ''}
                  onChange={(e) => setEditingData(prev => prev ? { ...prev, dataConvocazione: e.target.value } : prev)}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-masonic-gold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Data e Ora Apertura Tornata</label>
                <input
                  type="datetime-local"
                  value={editingData?.dataOraApertura || ''}
                  onChange={(e) => setEditingData(prev => prev ? { ...prev, dataOraApertura: e.target.value } : prev)}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-masonic-gold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Luogo</label>
                <input
                  type="text"
                  value={editingData?.luogo || ''}
                  onChange={(e) => setEditingData(prev => prev ? { ...prev, luogo: e.target.value } : prev)}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-masonic-gold text-sm"
                  placeholder="Inserisci il luogo della tornata..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Formato Grafico</label>
                <select
                  value={editingData?.formatoGrafico || 'standard'}
                  onChange={(e) => setEditingData(prev => prev ? { ...prev, formatoGrafico: e.target.value as any } : prev)}
                  className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-masonic-gold text-sm"
                >
                  <option value="standard">Standard</option>
                  <option value="alternativo">Alternativo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Ordine del Giorno</label>
              <textarea
                value={editingData?.ordineDelGiorno || ''}
                onChange={(e) => setEditingData(prev => prev ? { ...prev, ordineDelGiorno: e.target.value } : prev)}
                className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-masonic-gold text-sm"
                rows={5}
                placeholder="Inserisci l'ordine del giorno..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Note</label>
              <textarea
                value={editingData?.note || ''}
                onChange={(e) => setEditingData(prev => prev ? { ...prev, note: e.target.value } : prev)}
                className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-masonic-gold text-sm"
                rows={3}
                placeholder="Note aggiuntive..."
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Save size={16} /> Salva
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditingData(null);
                }}
                className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                <X size={16} /> Annulla
              </button>
            </div>
          </div>
        ) : null}

        <div className="mb-4">
          <button
            onClick={handleNewConvocazione}
            disabled={loading}
            className="bg-masonic-gold hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus size={16} /> Nuova Convocazione
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">N.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Data Convocazione</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Data/Ora Tornata</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Luogo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Formato</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {convocazioni.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-slate-400 italic text-sm">
                    Nessuna convocazione per questo anno
                  </td>
                </tr>
              ) : (
                convocazioni.map(conv => (
                  <tr key={conv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{conv.numeroConvocazione}</td>
                    <td className="px-4 py-3 text-slate-700">{conv.dataConvocazione}</td>
                    <td className="px-4 py-3 text-slate-700">{conv.dataOraApertura.replace('T', ' ')}</td>
                    <td className="px-4 py-3 text-slate-700 text-sm">{conv.luogo}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{conv.formatoGrafico}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handlePrint(conv, { mostraPiedilista: true, nomiCriptati: false })}
                          disabled={loading}
                          className="text-green-600 hover:text-green-800 disabled:opacity-50 transition-colors"
                          title="Stampa completa"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => handlePrint(conv, { mostraPiedilista: false, nomiCriptati: false })}
                          disabled={loading}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                          title="Stampa senza piedilista"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => handlePrint(conv, { mostraPiedilista: false, nomiCriptati: true })}
                          disabled={loading}
                          className="text-purple-600 hover:text-purple-800 disabled:opacity-50 transition-colors"
                          title="Stampa senza piedilista e con nomi criptati"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(conv)}
                          disabled={conv.bloccata || loading}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                          title="Modifica"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleLock(conv)}
                          disabled={loading}
                          className="transition-colors"
                          title={conv.bloccata ? 'Sblocca' : 'Blocca'}
                        >
                          {conv.bloccata ? (
                            <Lock size={16} className="text-red-600 hover:text-red-800" />
                          ) : (
                            <Unlock size={16} className="text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(conv.id)}
                          disabled={conv.bloccata || loading}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
