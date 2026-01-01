import React, { useState, useEffect } from 'react';
import { PublicLodgeConfig } from '../types/lodge';
import { lodgeRegistry } from '../services/lodgeRegistry';
import { 
  initiateGoogleLogin, 
  getAuthCodeFromUrl, 
  cleanAuthCodeFromUrl,
  exchangeCodeForEmail 
} from '../utils/googleOAuthService';
import { verifyEmailAndCreateSession, saveSession } from '../utils/emailAuthService';
import { Building2, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  onLoginSuccess: (config: PublicLodgeConfig) => void;
  glriNumber: string;
}

export function LoginInterface({ onLoginSuccess, glriNumber }: Props) {
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lodgeConfig, setLodgeConfig] = useState<PublicLodgeConfig | null>(null);
  
  // Check for OAuth callback
  useEffect(() => {
    const authCode = getAuthCodeFromUrl();
    if (authCode) {
      handleOAuthCallback(authCode);
    }
  }, []);
  
  // Load lodge config
  useEffect(() => {
    const loadLodge = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const config = await lodgeRegistry.getLodgeConfig(glriNumber);
        
        if (!config) {
          setError('Loggia non trovata. Controlla il numero nella URL.');
          setLoading(false);
          return;
        }
        
        setLodgeConfig(config);
        setLoading(false);
        
        // Auto-login for demo mode (lodge 9999)
        if (glriNumber === '9999') {
          setTimeout(() => onLoginSuccess(config), 500);
        }
      } catch (err) {
        setError('Errore di connessione. Riprova.');
        setLoading(false);
      }
    };
    
    loadLodge();
  }, [glriNumber, onLoginSuccess]);
  
  const handleGoogleLogin = async () => {
    try {
      setAuthenticating(true);
      const redirectUri = `${window.location.origin}/?glriNumber=${glriNumber}`;
      initiateGoogleLogin(redirectUri);
    } catch (err: any) {
      setError(err.message);
      setAuthenticating(false);
    }
  };
  
  const handleOAuthCallback = async (code: string) => {
    try {
      setAuthenticating(true);
      
      if (!lodgeConfig) {
        setError('Configurazione loggia non trovata');
        return;
      }
      
      // Exchange code for email via backend
      const googleUser = await exchangeCodeForEmail(code, window.location.origin);
      
      // Verify email in this lodge's Supabase and create session
      const session = await verifyEmailAndCreateSession(
        googleUser.email,
        googleUser.name,
        googleUser.picture,
        lodgeConfig.supabaseUrl,
        lodgeConfig.supabaseAnonKey,
        lodgeConfig.lodgeName,
        lodgeConfig.glriNumber
      );
      
      // Save session to localStorage
      saveSession(session);
      
      // Clean URL and complete login
      cleanAuthCodeFromUrl();
      onLoginSuccess(lodgeConfig);
    } catch (err: any) {
      console.error('[LOGIN] OAuth callback error:', err);
      setError(err.message || 'Errore autenticazione Google');
      setAuthenticating(false);
      cleanAuthCodeFromUrl();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-masonic-gold mx-auto mb-4"></div>
          <p className="text-slate-300">Caricamento loggia...</p>
        </div>
      </div>
    );
  }

  if (error || !lodgeConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            {error?.includes('non abilitato') ? 'Accesso Negato' : 'Loggia non trovata'}
          </h2>
          <div className="text-slate-600 mb-4 whitespace-pre-line">
            {error || 'La loggia non esiste nel sistema'}
          </div>
          {!error?.includes('non abilitato') && (
            <p className="text-sm text-slate-500">
              Controlla che il numero nella URL sia corretto: <span className="font-mono text-masonic-gold">{glriNumber}</span>
            </p>
          )}
          {error?.includes('non abilitato') && (
            <button
              onClick={() => {
                setError(null);
                setAuthenticating(false);
              }}
              className="mt-4 px-6 py-2 bg-masonic-gold hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
            >
              Riprova con altro account
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-masonic-gold rounded-full mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 mb-1">
            {lodgeConfig.lodgeName}
          </h1>
          <p className="text-sm text-slate-500">Loggia {lodgeConfig.glriNumber}</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={authenticating}
            className="w-full bg-white border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3"
          >
            {authenticating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Autenticazione in corso...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Accedi con Google
              </>
            )}
          </button>

          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
            ℹ️ Usa l'email Google autorizzata dal Segretario
          </div>
        </div>
      </div>
    </div>
  );
}
