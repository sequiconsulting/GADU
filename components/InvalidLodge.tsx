import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home, Sparkles } from 'lucide-react';

export function InvalidLodge({
  title = 'Numero Loggia Mancante',
  message = "Per accedere a G.A.D.U., devi aggiungere il numero della loggia nell'URL.",
}: {
  title?: string;
  message?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <AlertCircle size={32} className="text-red-600" />
        </div>
        
        <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-slate-600 mb-6">{message}</p>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm font-mono text-slate-700">
            gadu.netlify.app/<span className="text-masonic-gold font-bold">105</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Sostituisci <span className="font-semibold">105</span> con il numero della tua loggia GLRI
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              const glriNumber = prompt('Inserisci il numero della loggia GLRI:');
              if (glriNumber) {
                navigate(`/${glriNumber}`);
              }
            }}
            className="w-full bg-masonic-gold hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Home size={18} />
            Accedi alla Loggia
          </button>

          <button
            onClick={() => navigate('/9999')}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Prova la Modalità Demo
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Se non hai ancora attivato la loggia, contatta l'amministratore
        </p>
      </div>
    </div>
  );
}
