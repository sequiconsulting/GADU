import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Database, Key, CheckCircle, ArrowRight, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { ITALIAN_PROVINCES } from '../constants';
import { lodgeRegistry } from '../services/lodgeRegistry';

interface SetupFormData {
  glriNumber: string;
  lodgeName: string;
  province: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  adminEmail: string;
}

export function SetupWizard() {
  const navigate = useNavigate();
  const { glriNumber: urlGlriNumber } = useParams<{ glriNumber?: string }>();
  
  console.log('[SETUP-WIZARD] Component mounted, urlGlriNumber:', urlGlriNumber);
  
  // If glriNumber from URL, pre-fill form
  const [currentStep, setCurrentStep] = useState(urlGlriNumber ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<SetupFormData>({
    glriNumber: urlGlriNumber || '',
    lodgeName: '',
    province: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceKey: '',
    adminEmail: ''
  });

  const updateField = (field: keyof SetupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleNext = async () => {
    console.log(`[SETUP-WIZARD] handleNext called, currentStep: ${currentStep}`);
    
    if (!validateStep(currentStep)) {
      console.log(`[SETUP-WIZARD] Validation failed for step ${currentStep}`);
      return;
    }

    // Step 1: verifica che il numero loggia non sia già registrato
    if (currentStep === 1) {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`[SETUP-WIZARD] Checking if lodge ${formData.glriNumber} exists...`);
        const response = await fetch(`/.netlify/functions/get-lodge-config?glriNumber=${formData.glriNumber}`);
        console.log(`[SETUP-WIZARD] Response status: ${response.status}`);
        
        if (response.ok) {
          const existingLodge = await response.json();
          if (existingLodge) {
            setError(`La loggia numero ${formData.glriNumber} è già registrata nel sistema`);
            setLoading(false);
            return;
          }
        }
        // 404 = non trovata, quindi possiamo proseguire
      } catch (err) {
        console.error('[SETUP-WIZARD] Error checking lodge number:', err);
        // In caso di errore di rete, permettiamo di proseguire
      } finally {
        setLoading(false);
      }
    }

    setCurrentStep(prev => Math.min(prev + 1, 7));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.glriNumber || formData.glriNumber.length < 1) {
          setError('Inserisci il numero della loggia');
          return false;
        }
        return true;
      case 2:
        if (!formData.lodgeName) {
          setError('Inserisci il nome della loggia');
          return false;
        }
        return true;
      case 3:
        if (!formData.province) {
          setError('Seleziona una provincia');
          return false;
        }
        return true;
      case 4:
        if (!formData.supabaseUrl || !formData.supabaseUrl.startsWith('https://')) {
          setError('Inserisci un URL Supabase valido (deve iniziare con https://)');
          return false;
        }
        return true;
      case 5:
        if (!formData.supabaseAnonKey || formData.supabaseAnonKey.length < 20) {
          setError('Inserisci una chiave Anon valida');
          return false;
        }
        return true;
      case 6:
        if (!formData.supabaseServiceKey || formData.supabaseServiceKey.length < 20) {
          setError('Inserisci una chiave Service Role valida');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Registra la loggia nel registry
      const setupResponse = await fetch('/.netlify/functions/setup-lodge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!setupResponse.ok) {
        const errorData = await setupResponse.json();
        throw new Error(errorData.error || 'Errore durante la registrazione');
      }

      // 2. Inizializza lo schema del database
      const schemaResponse = await fetch('/.netlify/functions/initialize-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: formData.supabaseUrl,
          supabaseServiceKey: formData.supabaseServiceKey
        })
      });

      if (!schemaResponse.ok) {
        const errorData = await schemaResponse.json();
        throw new Error(errorData.error || 'Errore durante l\'inizializzazione del database');
      }

      // 3. Successo! Vai al login
      setCurrentStep(7);
      
      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, title: 'Numero Loggia', icon: Building2 },
    { num: 2, title: 'Nome Loggia', icon: Building2 },
    { num: 3, title: 'Provincia', icon: Building2 },
    { num: 4, title: 'Database URL', icon: Database },
    { num: 5, title: 'Anon Key', icon: Key },
    { num: 6, title: 'Service Key', icon: Key },
    { num: 7, title: 'Completo!', icon: CheckCircle }
  ];

  console.log('[SETUP-WIZARD] Rendering, currentStep:', currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-masonic-gold rounded-full mb-4">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">Attiva GADU</h1>
          <p className="text-slate-600">Configurazione guidata in {steps.length} step</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {steps.map((step, idx) => (
              <div key={step.num} className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-colors ${
                  currentStep > step.num ? 'bg-green-500 text-white' :
                  currentStep === step.num ? 'bg-masonic-gold text-white' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {currentStep > step.num ? <CheckCircle size={20} /> : step.num}
                </div>
                <span className="text-xs text-slate-600 hidden sm:block text-center">{step.title}</span>
                {idx < steps.length - 1 && (
                  <div className={`absolute w-full h-0.5 top-5 -z-10 ${
                    currentStep > step.num ? 'bg-green-500' : 'bg-slate-200'
                  }`} style={{ left: '50%', width: `calc(100% / ${steps.length})` }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[300px] mb-8">
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800">Numero Loggia GLRI</h2>
              <p className="text-slate-600 text-sm">Inserisci il numero ufficiale della tua loggia presso la Gran Loggia Regolare d'Italia</p>
              <input
                type="text"
                value={formData.glriNumber}
                onChange={(e) => updateField('glriNumber', e.target.value)}
                placeholder="es: 105"
                maxLength={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none text-lg"
                autoFocus
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800">Nome Loggia</h2>
              <p className="text-slate-600 text-sm">Come si chiama la tua loggia?</p>
              <input
                type="text"
                value={formData.lodgeName}
                onChange={(e) => updateField('lodgeName', e.target.value)}
                placeholder="es: I Lapicidi"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                autoFocus
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800">Provincia</h2>
              <p className="text-slate-600 text-sm">Seleziona la provincia della loggia</p>
              <select
                value={formData.province}
                onChange={(e) => updateField('province', e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                autoFocus
              >
                <option value="">Seleziona...</option>
                {ITALIAN_PROVINCES.map(prov => (
                  <option key={prov.code} value={prov.code}>
                    {prov.name} ({prov.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800">Database Supabase - URL</h2>
              <p className="text-slate-600 text-sm">
                Crea un progetto su <a href="https://supabase.com" target="_blank" rel="noopener" className="text-masonic-gold hover:underline">supabase.com</a> e inserisci l'URL del progetto
              </p>
              <input
                type="url"
                value={formData.supabaseUrl}
                onChange={(e) => updateField('supabaseUrl', e.target.value)}
                placeholder="https://xxx.supabase.co"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none font-mono text-sm"
                autoFocus
              />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                💡 Trovi l'URL in <strong>Project Settings → API → Project URL</strong>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800">Chiave Anon (Pubblica)</h2>
              <p className="text-slate-600 text-sm">Chiave pubblica per l'accesso da browser</p>
              <textarea
                value={formData.supabaseAnonKey}
                onChange={(e) => updateField('supabaseAnonKey', e.target.value)}
                placeholder="eyJ..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none font-mono text-xs"
                autoFocus
              />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                💡 Trovi la chiave in <strong>Project Settings → API → anon public</strong>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800">Chiave Service Role (Privata)</h2>
              <p className="text-slate-600 text-sm">Chiave privata per operazioni amministrative (NON condividere!)</p>
              <textarea
                value={formData.supabaseServiceKey}
                onChange={(e) => updateField('supabaseServiceKey', e.target.value)}
                placeholder="eyJ..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none font-mono text-xs"
                autoFocus
              />
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                ⚠️ Questa chiave è <strong>privata</strong>. Trovala in <strong>Project Settings → API → service_role secret</strong>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Amministratore (opzionale)</label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="text-center py-12 animate-fadeIn">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-6">
                <CheckCircle size={48} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Configurazione Completata!</h2>
              <p className="text-slate-600 mb-2">La tua loggia <strong>{formData.lodgeName} n. {formData.glriNumber}</strong> è stata attivata.</p>
              <p className="text-slate-500 text-sm">Verrai reindirizzato al login...</p>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 7 && (
          <div className="flex justify-between gap-4">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              Indietro
            </button>

            {currentStep < 6 ? (
              <button
                onClick={handleNext}
                disabled={loading}
                className="px-6 py-3 bg-masonic-gold hover:bg-yellow-600 disabled:bg-slate-400 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                {loading ? 'Verifica...' : 'Avanti'}
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                {loading ? 'Configurazione...' : 'Completa Setup'}
                <CheckCircle size={18} />
              </button>
            )}
          </div>
        )}

        {/* Cancel link */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              lodgeRegistry.clearCurrentLodge();
              navigate('/');
            }}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Annulla e torna al login
          </button>
        </div>
      </div>
    </div>
  );
}
