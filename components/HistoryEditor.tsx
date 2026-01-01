

import React, { useState, useEffect } from 'react';
import { DegreeEvent } from '../types';
import { Plus, Trash2, AlertTriangle, Pencil } from 'lucide-react';

interface HistoryEditorProps {
  degrees: DegreeEvent[];
  degreeOptions: { name: string; abbreviation: string; }[];
  onChange: (degrees: DegreeEvent[]) => void;
  branchColor: string;
  onValidate?: (degreeName: string) => string | null;
}

export const HistoryEditor: React.FC<HistoryEditorProps> = ({ degrees, degreeOptions, onChange, branchColor, onValidate }) => {
  // Find next unassigned degree as default
  const getNextUnassignedDegree = () => {
    for (const opt of degreeOptions) {
      if (!degrees.some(d => d.degreeName === opt.name)) {
        return opt.name;
      }
    }
    return degreeOptions[0]?.name || '';
  };

  const [newDegree, setNewDegree] = useState<DegreeEvent>({
    degreeName: getNextUnassignedDegree(),
    date: '',
    meetingNumber: ''
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sort degrees based on hierarchy defined in degreeOptions
  const sortedDegrees = [...degrees].sort((a, b) => {
    const indexA = degreeOptions.findIndex(d => d.name === a.degreeName);
    const indexB = degreeOptions.findIndex(d => d.name === b.degreeName);
    return indexA - indexB;
  });

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

    // 2. Check that date is not in the future
    if (newDegree.date) {
      const degreeDate = new Date(newDegree.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (degreeDate > today) {
        setValidationError("La data del grado non può essere nel futuro.");
        return;
      }
    }

    // 3. Run external validation (prerequisites)
    if (onValidate) {
        setValidationError(onValidate(newDegree.degreeName));
    } else {
        setValidationError(null);
    }
  }, [newDegree.degreeName, newDegree.date, degrees, onValidate]);

  const handleAdd = () => {
    // Date and Meeting Number are now optional
    if (newDegree.degreeName && !validationError) {
      onChange([...degrees, newDegree]);
      
      // Auto-select next unassigned degree
      const nextUnassigned = degreeOptions.find(opt => 
        !degrees.some(d => d.degreeName === opt.name) && opt.name !== newDegree.degreeName
      );
      
      setNewDegree({ 
        degreeName: nextUnassigned?.name || degreeOptions[0]?.name || '', 
        date: '', 
        meetingNumber: '',
        location: undefined // Reset location field (issue #28)
      });
    }
  };

  const handleDelete = (degreeToDelete: string) => {
    const idx = degreeOptions.findIndex(d => d.name === degreeToDelete);
    // Check if a higher degree exists
    const hasHigherDegree = degrees.some(d => degreeOptions.findIndex(opt => opt.name === d.degreeName) > idx);

    if (hasHigherDegree) {
        alert("Impossibile eliminare questo grado perché esistono gradi superiori registrati. Eliminare prima i gradi successivi.");
        return;
    }

    const updated = degrees.filter(d => d.degreeName !== degreeToDelete);
    onChange(updated);
  };

  const handleEdit = (degree: DegreeEvent) => {
    // Populate the form with the existing degree data
    setNewDegree(degree);
    // Remove it from the list so it can be re-added/updated
    const updated = degrees.filter(d => d.degreeName !== degree.degreeName);
    onChange(updated);
  };

  const isDeleteDisabled = (degreeName: string) => {
     const idx = degreeOptions.findIndex(d => d.name === degreeName);
     return degrees.some(d => degreeOptions.findIndex(opt => opt.name === d.degreeName) > idx);
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      {/* Existing Degrees */}
      <div className="space-y-2">
        {sortedDegrees.length === 0 && <p className="text-xs text-slate-400 italic">Nessun grado registrato.</p>}
        {sortedDegrees.map((deg, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-md border border-slate-100">
            <div>
              <span className={`font-serif font-bold text-sm ${branchColor.replace('bg-', 'text-')}`}>{deg.degreeName}</span>
              <div className="text-[10px] text-slate-500 flex gap-2">
                <span>{deg.date ? `Data: ${deg.date}` : 'Data n.d.'}</span>
                <span>• {deg.meetingNumber ? `Tornata N. ${deg.meetingNumber}` : 'Tornata n.d.'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(deg)}
                  className="text-slate-400 hover:text-blue-500 transition-colors p-1"
                  title="Modifica"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(deg.degreeName)}
                  className={`transition-colors p-1 ${isDeleteDisabled(deg.degreeName) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-500'}`}
                  disabled={isDeleteDisabled(deg.degreeName)}
                  title={isDeleteDisabled(deg.degreeName) ? "Impossibile eliminare: grado propedeutico a uno esistente" : "Elimina"}
                >
                  <Trash2 size={14} />
                </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Degree */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex gap-2">
          {/* Left side: Two-row layout */}
          <div className="flex-1 space-y-2">
            {/* Row 1: Grado selector */}
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Grado</label>
              <select
                value={newDegree.degreeName}
                onChange={(e) => setNewDegree({...newDegree, degreeName: e.target.value})}
                className="w-full text-xs border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-1.5 border h-8"
              >
                {degreeOptions.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
              </select>
            </div>
            
            {/* Row 2: Data and N. Tornata */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Data (Opz.)</label>
                <input
                  type="date"
                  value={newDegree.date}
                  onChange={(e) => setNewDegree({...newDegree, date: e.target.value})}
                  className="w-full text-xs border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-1.5 border h-8"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">N. Tornata (Opz.)</label>
                <input
                  type="text"
                  placeholder="N."
                  value={newDegree.meetingNumber}
                  onChange={(e) => setNewDegree({...newDegree, meetingNumber: e.target.value})}
                  className="w-full text-xs border-slate-300 rounded-md shadow-sm focus:ring-slate-500 focus:border-slate-500 p-1.5 border h-8"
                />
              </div>
            </div>
          </div>
          
          {/* Right side: Button spanning both rows */}
          <div className="flex items-end pb-[1px]">
            <button
              onClick={handleAdd}
              disabled={!!validationError}
              className={`w-10 h-[calc(100%-22px)] flex justify-center items-center rounded-md text-slate-900 transition-colors ${!!validationError ? 'bg-slate-300 cursor-not-allowed' : 'bg-yellow-400 hover:bg-yellow-500'}`}
              title={validationError || 'Aggiungi grado'}
            >
              <Plus size={16} />
            </button>
          </div>
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