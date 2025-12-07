/**
 * LoginPage Component - PREPARED FOR FUTURE IMPLEMENTATION
 * 
 * Displayed when user is not authenticated.
 * Currently NOT USED - will be activated when Auth0 is enabled.
 */

import React from 'react';
import { Layout } from 'lucide-react';

interface LoginPageProps {
  onLogin?: () => void;
  isLoading?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isLoading = false }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="bg-masonic-gold p-4 rounded-full">
              <Layout size={40} className="text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">G.A.D.U.</h1>
          <p className="text-sm text-slate-500 mb-6">
            Gestione Associazioni Decisamente User-friendly
          </p>

          {/* Description */}
          <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
            <p className="text-sm text-slate-700">
              Sistema di gestione delle iscrizioni per Logge Massoniche
            </p>
          </div>

          {/* Login Button */}
          <button
            onClick={onLogin}
            disabled={isLoading}
            className="w-full bg-masonic-gold hover:bg-yellow-600 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            {isLoading ? 'Accesso in corso...' : 'Accedi con Auth0'}
          </button>

          {/* Footer Info */}
          <p className="text-xs text-slate-500 mt-6">
            Accedi con il tuo account Auth0 per gestire i dati della Loggia
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 text-white text-sm">
          <p className="font-semibold mb-2">Ruoli disponibili:</p>
          <ul className="space-y-1 text-white/80 text-xs">
            <li>• <strong>Globale</strong> - Accesso completo</li>
            <li>• <strong>Craft</strong> - Loggia</li>
            <li>• <strong>Mark+Arch</strong> - Marchio e Capitolo</li>
            <li>• <strong>RAM</strong> - Reali Archi</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
