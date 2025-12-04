
import React, { useState, useEffect } from 'react';
import { DegreeEvent } from '../types';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

interface HistoryEditorProps {
  degrees: DegreeEvent[];
  degreeOptions: string[];
  onChange: (degrees: DegreeEvent[]) => void;
  branchColor: string;
  onValidate?: (degreeName: string) => string | null;
}

export const HistoryEditor: React.FC<HistoryEditorProps> = ({ degrees, degreeOptions, onChange, branchColor, onValidate }) => {
  const [newDegree, setNewDegree] = useState<DegreeEvent>({
    degreeName: degreeOptions[0] || '',
    date: '',
    meetingNumber: ''
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!newDegree.degreeName) {
        setValidationError(null);
        return;
    }

    // 1. Check for duplicates in the existing list
    const isDuplicate = degrees.some(d => d.degreeName === newDegree.degreeName);
    if (isDuplicate) {
        setValidationError("Questo grado è già stato registrato.");
        return;
    }

    // 2. Run external validation (prerequisites)
    if (onValidate) {
        setValidationError(onValidate(newDegree.degreeName));
    } else {
        setValidationError(null);
    }
  }, [newDegree.degreeName, degrees, onValidate]);

  const handleAdd = () => {
    if (newDegree.degreeName && newDegree.date && !validationError) {
      onChange([...degrees, newDegree]);
      setNewDegree({ degreeName: degreeOptions[0] || '', date: '', meetingNumber: '' });
    }
  };

  const handleDelete = (index: number) => {
    const updated = degrees.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Carriera Massonica</h3>
      
      {/* Existing Degrees */}
      <div className="space-y-2">
        {degrees.length === 0 && <p className="text-sm text-slate-400 italic">Nessun grado registrato.</p>}
        {degrees.map((deg, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
            <div>
              <span className={`font-serif font-bold ${branchColor.replace('bg-', 'text-')}`}>{deg.degreeName}</span>
              <div className="text-xs text-slate-500 flex gap-2 mt-1">
                <span>Data: {deg.date}</span>
                {deg.meetingNumber && <span>• Tornata N. {deg.meetingNumber}</span>}
              </div>
            </div>
            <button 
              onClick={() => handleDelete(idx)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add New Degree */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end pt-4 border-t border-slate-100">
        <div className="md:col-span-5">
          <label className="block text-xs font-medium text-slate-500 mb-1">Grado</label>
          <select 
            value={newDegree.degreeName}
            onChange={(e) => setNewDegree({...newDegree, degreeName: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-2 border"
          >
            {degreeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
          <input 
            type="date" 
            value={newDegree.date}
            onChange={(e) => setNewDegree({...newDegree, date: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-2 border"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">N. Tornata</label>
          <input 
            type="text" 
            placeholder="N."
            value={newDegree.meetingNumber}
            onChange={(e) => setNewDegree({...newDegree, meetingNumber: e.target.value})}
            className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-2 border"
          />
        </div>
        <div className="md:col-span-1">
          <button 
            onClick={handleAdd}
            disabled={!newDegree.date || !!validationError}
            className={`w-full p-2 flex justify-center items-center rounded-md text-white transition-colors ${!newDegree.date || !!validationError ? 'bg-slate-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
      {validationError && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
            <AlertTriangle size={14} />
            <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
