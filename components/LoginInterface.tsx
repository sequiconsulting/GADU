import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLodgeConfig } from '../types/lodge';
import { lodgeRegistry } from '../services/lodgeRegistry';
import { demoMode } from '../services/demoModeService';
import { Lock, Building2, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  onLoginSuccess: (config: PublicLodgeConfig) => void;
}

export function LoginInterface({ onLoginSuccess }: Props) {
  const [lodgeNumber, setLodgeNumber] = useState('');
  const [lodgeConfig, setLodgeConfig] = useState<PublicLodgeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleNumberSubmit = async () => {
    if (!lodgeNumber.trim()) {
      setError('Inserisci il numero della loggia');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const config = await lodgeRegistry.getLodgeConfig(lodgeNumber);
      
      if (!config) {
        setError('Numero loggia non trovato. Prima volta? Clicca "Attiva GADU"');
        return;
      }
      
      setLodgeConfig(config);
    } catch (err) {
      setError('Errore di connessione. Riprova.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDemoMode = () => {
    demoMode.activateDemoMode();
    onLoginSuccess(demoMode.getDemoConfig());
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNumberSubmit();
    }
  };
  
  // Step 1: Lodge selection
  if (!lodgeConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-masonic-gold rounded-full mb-4">
              <Building2 size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">G.A.D.U.</h1>
            <p className="text-slate-600">Gestione Associazioni Decisamente User-friendly</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Numero Loggia GLRI
              </label>
              <input
                type="text"
                value={lodgeNumber}
                onChange={(e) => setLodgeNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="es: 105"
                maxLength={4}
                autoFocus
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none text-lg text-center font-semibold"
              />
            </div>
            
            <button 
              onClick={handleNumberSubmit} 
              disabled={loading}
              className="w-full bg-masonic-gold hover:bg-yellow-600 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                'Caricamento...'
              ) : (
                <>
                  Continua <ArrowRight size={18} />
                </>
              )}
            </button>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
          
          <div className="my-6 border-t border-slate-200" />
          
          {demoMode.isDemoAvailable() && (
            <button 
              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-4"
              onClick={handleDemoMode}
            >
              <Sparkles size={18} />
              Modalità Demo
            </button>
          )}
          
          <div className="text-center">
            <p className="text-sm text-slate-600 mb-3">
              🆕 Prima volta? Attiva la tua loggia
            </p>
            <Link 
              to="/setup" 
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Attiva GADU
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Step 2: OAuth login (placeholder - TODO: implement OAuth)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-masonic-gold rounded-full mb-4">
            <Lock size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
            {lodgeRegistry.formatLodgeName(lodgeConfig)}
          </h1>
          <p className="text-slate-600">Accedi al sistema</p>
        </div>
        
        <div className="space-y-4">
          <button 
            className="w-full bg-white border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3"
            onClick={() => {
              // TODO: implement OAuth
              // Per ora, bypass diretto
              onLoginSuccess(lodgeConfig);
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Accedi con Google
          </button>
          
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
            ℹ️ Usa l'email Google autorizzata dal Segretario
          </div>
          
          <button 
            className="w-full text-slate-600 hover:text-slate-900 font-medium py-2 transition-colors"
            onClick={() => setLodgeConfig(null)}
          >
            ← Cambia loggia
          </button>
        </div>
      </div>
    </div>
  );
}
