import React, { useEffect, useState } from 'react';
import { Building2, AlertCircle, Loader2, Lock, KeyRound } from 'lucide-react';
import { PublicLodgeConfig } from '../types/lodge';
import { lodgeRegistry } from '../services/lodgeRegistry';
import { AuthSession, signInWithPassword, loadActiveSession, changePassword } from '../utils/emailAuthService';

interface Props {
  onLoginSuccess: (config: PublicLodgeConfig, session?: AuthSession) => void;
  glriNumber: string;
}

export function LoginInterface({ onLoginSuccess, glriNumber }: Props) {
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lodgeConfig, setLodgeConfig] = useState<PublicLodgeConfig | null>(null);
  const [email, setEmail] = useState(glriNumber === '9999' ? 'demo@demo.app' : '');
  const [password, setPassword] = useState(glriNumber === '9999' ? 'demo' : '');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);
  
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
        
        // Riprendi sessione già attiva (Supabase ripristina i token automaticamente)
        const session = await loadActiveSession(config.supabaseUrl, config.supabaseAnonKey);
        if (session) {
          onLoginSuccess(config, session);
          return;
        }
      } catch (err) {
        setError('Errore di connessione. Riprova.');
        setLoading(false);
      }
    };
    
    loadLodge();
  }, [glriNumber, onLoginSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lodgeConfig) return;

    setError(null);
    setInfoMessage(null);
    setAuthenticating(true);

    try {
      let session = await signInWithPassword(
        email.trim(),
        password,
        lodgeConfig.supabaseUrl,
        lodgeConfig.supabaseAnonKey
      );
      
      if (session) {
        // Verifica se deve cambiare la password
        if (session.mustChangePassword) {
          setPendingSession(session);
          setShowPasswordChange(true);
          setAuthenticating(false);
          setInfoMessage('Devi cambiare la password al primo accesso');
          return;
        }

        // Per l'utente demo della loggia 9999, verifica e ripristina privilegi admin se mancanti
        if (glriNumber === '9999' && email.trim().toLowerCase() === 'demo@demo.app') {
          const privileges = session.privileges || [];
          const hasAdminPrivilege = privileges.includes('AD');
          
          if (!hasAdminPrivilege) {
            console.log('[DEMO] Ripristino privilegi admin per utente demo');
            try {
              const response = await fetch(`/.netlify/functions/manage-supabase-users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'updatePrivileges',
                  lodgeNumber: glriNumber,
                  userId: session.userId,
                  privileges: ['AD', 'CW', 'MW', 'AW', 'RW']
                })
              });
              
              if (response.ok) {
                // Ricarica la sessione per ottenere i privilegi aggiornati
                session = await loadActiveSession(lodgeConfig.supabaseUrl, lodgeConfig.supabaseAnonKey) || session;
              } else {
                console.warn('[DEMO] Errore ripristino privilegi, response status:', response.status);
              }
            } catch (updateErr) {
              console.warn('[DEMO] Errore ripristino privilegi:', updateErr);
              // Continua comunque con il login
            }
          }
        }
        
        onLoginSuccess(lodgeConfig, session);
      } else {
        setError('Email o password errati');
      }
    } catch (err: any) {
      console.error('[LOGIN] Login error:', err);
      setError(err.message || 'Impossibile effettuare l\'accesso, riprova.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lodgeConfig || !pendingSession) return;

    setError(null);
    setInfoMessage(null);

    if (newPassword.length < 8) {
      setError('La nuova password deve contenere almeno 8 caratteri');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }

    setAuthenticating(true);
    try {
      const updatedSession = await changePassword(
        newPassword,
        lodgeConfig.supabaseUrl,
        lodgeConfig.supabaseAnonKey,
        pendingSession.userId!
      );

      // Reset mustChangePassword flag via API
      if (pendingSession.userId) {
        try {
          await fetch(`/.netlify/functions/manage-supabase-users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'clearMustChangePassword',
              lodgeNumber: glriNumber,
              userId: pendingSession.userId
            })
          });
        } catch (updateErr) {
          console.warn('[PASSWORD_CHANGE] Errore reset flag mustChangePassword:', updateErr);
        }
      }

      setInfoMessage('Password cambiata con successo');
      setTimeout(() => {
        onLoginSuccess(lodgeConfig, updatedSession);
      }, 1000);
    } catch (err: any) {
      console.error('[PASSWORD_CHANGE] Error:', err);
      setError(err.message || 'Errore durante il cambio password');
    } finally {
      setAuthenticating(false);
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

  // Mostra form di cambio password obbligatorio
  if (showPasswordChange) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-masonic-gold rounded-full mb-4">
              <KeyRound size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 mb-1">
              Cambio Password Obbligatorio
            </h1>
            <p className="text-sm text-slate-500">Primo accesso - Imposta una nuova password</p>
          </div>

          <form className="space-y-4" onSubmit={handlePasswordChange}>
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm mb-4">
              Per motivi di sicurezza devi cambiare la password al primo accesso.
            </div>

            <div className="relative">
              <input
                type="password"
                className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-masonic-gold focus:border-transparent"
                placeholder="Nuova password (min. 8 caratteri)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={authenticating}
                minLength={8}
              />
              <Lock className="absolute right-3 top-3.5 text-slate-400" size={20} />
            </div>

            <div className="relative">
              <input
                type="password"
                className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-masonic-gold focus:border-transparent"
                placeholder="Conferma nuova password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={authenticating}
                minLength={8}
              />
              <Lock className="absolute right-3 top-3.5 text-slate-400" size={20} />
            </div>

            <button
              type="submit"
              disabled={authenticating}
              className="w-full bg-masonic-gold hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {authenticating ? <Loader2 size={18} className="animate-spin" /> : 'Cambia Password'}
            </button>

            {infoMessage && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                {infoMessage}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </form>
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

        <form className="space-y-4" onSubmit={handleLogin}>
          <label className="block text-sm font-semibold text-slate-700">Accedi</label>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="email"
                className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-masonic-gold focus:border-transparent"
                placeholder="email@esempio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={authenticating}
              />
            </div>

            <div className="relative">
              <input
                type="password"
                className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-masonic-gold focus:border-transparent"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={authenticating}
              />
              <Lock className="absolute right-3 top-3.5 text-slate-400" size={20} />
            </div>

            <button
              type="submit"
              disabled={authenticating}
              className="w-full bg-masonic-gold hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {authenticating ? <Loader2 size={18} className="animate-spin" /> : 'Accedi'}
            </button>
          </div>

          {infoMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
              {infoMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
