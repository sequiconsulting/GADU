
import React from 'react';
import { Shield, BookOpen } from 'lucide-react';
import { DEGREES, BRANCHES } from '../constants';

export const Legend: React.FC = () => {
    const allDegrees = Object.values(DEGREES).flat();

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fadeIn pb-8">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
                <BookOpen size={24} className="text-masonic-gold"/>
                <h2 className="text-xl font-serif font-bold">Legenda e Requisiti</h2>
            </div>
          </div>

          <div className="p-6 md:p-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-serif font-bold text-slate-800 mb-4 border-b pb-2">Requisiti di Grado</h3>
                    <div className="space-y-6">
                        {BRANCHES.map(branch => (
                            <div key={branch.type}>
                                <h4 className={`text-md font-bold text-white px-3 py-1 rounded-t-md flex items-center gap-2 ${branch.color} bg-opacity-80`}>
                                    <Shield size={16} /> {branch.label}
                                </h4>
                                <div className="border border-t-0 rounded-b-md p-4 text-sm">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="p-2 font-medium text-slate-600 w-1/2">Grado</th>
                                                <th className="p-2 font-medium text-slate-600">Requisito Minimo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {DEGREES[branch.type].map((degree, index) => {
                                                let prerequisite = <span className="text-slate-400 italic">Nessuno</span>;
                                                if (index > 0) {
                                                    prerequisite = <span>{DEGREES[branch.type][index - 1].name}</span>;
                                                }
                                                return (
                                                    <tr key={degree.name} className="border-b last:border-0">
                                                        <td className="p-2 font-medium">{degree.name}</td>
                                                        <td className="p-2">{prerequisite}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-serif font-bold text-slate-800 mb-4 border-b pb-2">Abbreviazioni Gradi</h3>
                    <div className="border rounded-md p-4 text-sm">
                         <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-2 font-medium text-slate-600 w-2/3">Grado</th>
                                    <th className="p-2 font-medium text-slate-600">Abbr.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allDegrees.map(degree => (
                                    <tr key={degree.name} className="border-b last:border-0">
                                        <td className="p-2 font-medium">{degree.name}</td>
                                        <td className="p-2 font-mono text-slate-500">{degree.abbreviation}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <div className="mt-8">
                         <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase">Note e Parametri</h4>
                         <p className="text-xs text-slate-500 italic">
                            Le regole di propedeuticità mostrate a sinistra sono implementate attivamente nei controlli dell'anagrafica.
                            <br/><br/>
                            Eventuali modifiche a questi parametri strutturali richiedono un aggiornamento dell'applicazione.
                         </p>
                     </div>
                </div>
             </div>
          </div>
        </div>
    );
};
