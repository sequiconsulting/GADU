import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Database, Key, CheckCircle, ArrowRight, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { ITALIAN_PROVINCES } from '../constants';
import { lodgeRegistry } from '../services/lodgeRegistry';

interface SetupFormData {
  glriNumber: string;
  lodgeName: string;
  province: string;
  associationName: string;
  address: string;
  zipCode: string;
  city: string;
  taxCode: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  adminEmail: string;
}

export function SetupWizard() {
  const navigate = useNavigate();
  const { glriNumber: urlGlriNumber } = useParams<{ glriNumber?: string }>();
  
  console.log('[SETUP-WIZARD] Component mounted, urlGlriNumber:', urlGlriNumber);
  
  // Always start from step 1 (verification), even if glriNumber is provided
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  
  const [formData, setFormData] = useState<SetupFormData>({
    glriNumber: urlGlriNumber || '',
    lodgeName: '',
    province: '',
    associationName: '',
    address: '',
    zipCode: '',
    city: '',
    taxCode: '',
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

    // Step 1: verificare disclaimer e numero loggia
    if (currentStep === 1) {
      if (!disclaimerAccepted) {
        setError('Devi accettare il disclaimer GDPR per continuare');
        return;
      }
      
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
        if (!formData.associationName) {
          setError('Inserisci il nome dell\'associazione');
          return false;
        }
        if (!formData.address) {
          setError('Inserisci l\'indirizzo');
          return false;
        }
        if (!formData.zipCode || formData.zipCode.length !== 5) {
          setError('Inserisci un CAP valido (5 cifre)');
          return false;
        }
        if (!formData.city) {
          setError('Inserisci la città');
          return false;
        }
        if (!formData.province) {
          setError('Seleziona una provincia');
          return false;
        }
        if (!formData.taxCode || formData.taxCode.length !== 16) {
          setError('Inserisci un codice fiscale valido (16 caratteri)');
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
            <div className="space-y-6 animate-fadeIn">
              {/* GDPR Disclaimer */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Informativa GDPR e Responsabilità Legali</h3>
                <div className="text-sm text-blue-800 space-y-3 mb-4 max-h-[280px] overflow-y-auto">
                  <p><strong>Titolare del Trattamento (Art. 4(7) GDPR):</strong> L'associazione è il solo e unico titolare del trattamento dei dati personali gestiti attraverso GADU. GADU non è un titolare del trattamento né un contitolare ai sensi del GDPR, ma esclusivamente uno strumento tecnico messo a disposizione dell'associazione.</p>
                  
                  <p><strong>Responsabilità del Titolare (Art. 24 GDPR):</strong> L'associazione rimane completamente ed esclusivamente responsabile del rispetto di tutti gli obblighi previsti dal GDPR, inclusi ma non limitati a: raccolta del consenso degli interessati (Art. 6), garanzia dei diritti degli interessati (Art. 12-23), adozione di misure di sicurezza adeguate (Art. 32), notifica di violazioni dei dati (Art. 33-34), e tenuta del registro delle attività di trattamento (Art. 30).</p>
                  
                  <p><strong>Account Supabase e Chiavi di Accesso:</strong> L'associazione è responsabile della creazione autonoma di un account Supabase (supabase.com) per la conservazione dei propri dati. Fornendo a GADU le chiavi di accesso (anon key e service key) ottenute da Supabase, l'associazione delega GADU a gestire in modo anonimo i dati in lettura e scrittura esclusivamente per conto dell'associazione stessa. L'associazione prende atto che:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Nessuno, nemmeno gli amministratori di GADU, può accedere ai dati memorizzati sull'account Supabase dell'associazione senza le chiavi di accesso.</li>
                    <li>L'associazione è l'unica custode delle proprie chiavi di accesso e ne è completamente responsabile.</li>
                    <li>La perdita, compromissione o divulgazione non autorizzata delle chiavi comporta rischi per la sicurezza dei dati e rimane responsabilità esclusiva dell'associazione.</li>
                  </ul>
                  
                  <p><strong>Infrastruttura - Supabase.com:</strong> I dati sono conservati su server gestiti da Supabase Inc. (supabase.com). Supabase agisce come sub-responsabile del trattamento nei confronti dell'associazione. L'associazione è tenuta a verificare che Supabase offra garanzie sufficienti per attuare misure tecniche e organizzative adeguate (Art. 28 GDPR) e ad accettare le condizioni di servizio e le politiche sulla privacy di Supabase. Le <strong>data policy di Supabase</strong> si applicano alla conservazione tecnica dei dati.</p>
                  
                  <p><strong>Sicurezza del Trattamento (Art. 32 GDPR):</strong> L'associazione è responsabile di implementare misure tecniche e organizzative adeguate per garantire un livello di sicurezza adeguato al rischio, inclusi:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Conservazione sicura delle chiavi di accesso Supabase</li>
                    <li>Backup periodici dei dati</li>
                    <li>Procedure di disaster recovery</li>
                    <li>Controllo degli accessi agli account amministratori</li>
                    <li>Formazione del personale autorizzato al trattamento</li>
                  </ul>
                  
                  <p><strong>Funzione di GADU:</strong> GADU è esclusivamente uno strumento software di visualizzazione, modifica e gestione dati. GADU non raccoglie autonomamente dati personali, non li conserva permanentemente al di fuori di Supabase, non li trasferisce a terzi, e non effettua profilazione o trattamenti automatizzati con effetti giuridici (Art. 22 GDPR). Tutti i dati rimangono sotto il controllo tecnico e giuridico esclusivo dell'associazione.</p>
                  
                  <p><strong>Principi del Trattamento (Art. 5 GDPR):</strong> L'associazione è tenuta a garantire che i dati siano trattati in modo lecito, corretto e trasparente; raccolti per finalità determinate, esplicite e legittime; adeguati, pertinenti e limitati; esatti e aggiornati; conservati in modo da consentire l'identificazione per il tempo strettamente necessario; trattati in modo da garantire un'adeguata sicurezza.</p>
                  
                  <p><strong>Base Giuridica del Trattamento (Art. 6 GDPR):</strong> L'associazione è responsabile di individuare e documentare la base giuridica appropriata per il trattamento dei dati personali (es. consenso, interesse legittimo, obbligo di legge) e di informarne adeguatamente gli interessati mediante informativa privacy.</p>
                  
                  <p><strong>Diritti degli Interessati (Art. 12-23 GDPR):</strong> L'associazione è tenuta a garantire l'esercizio dei diritti degli interessati, tra cui: accesso, rettifica, cancellazione, limitazione del trattamento, portabilità, opposizione. GADU fornisce gli strumenti tecnici per esercitare tali diritti (es. modifica, cancellazione dati), ma la responsabilità della gestione delle richieste rimane dell'associazione.</p>
                  
                  <p><strong>Limitazione di Responsabilità:</strong> GADU, i suoi amministratori, sviluppatori e contributori non assumono alcuna responsabilità legale, civile o penale per:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Violazioni del GDPR o altre normative sulla privacy commesse dall'associazione</li>
                    <li>Perdita, corruzione, accesso non autorizzato o divulgazione di dati</li>
                    <li>Mancato rispetto degli obblighi di sicurezza, backup o disaster recovery</li>
                    <li>Indisponibilità o malfunzionamenti dei servizi Supabase</li>
                    <li>Danni diretti, indiretti, incidentali o consequenziali derivanti dall'uso di GADU</li>
                  </ul>
                </div>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disclaimerAccepted}
                    onChange={(e) => {
                      setDisclaimerAccepted(e.target.checked);
                      setError(null);
                    }}
                    className="w-5 h-5 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700">
                    <strong>Dichiaro di aver letto e compreso integralmente il presente disclaimer</strong> e di accettare che l'associazione è il solo responsabile del trattamento dei dati ai sensi del GDPR (Regolamento UE 2016/679), della creazione e gestione dell'account Supabase, della conservazione delle chiavi di accesso, della sicurezza, integrità e backup dei dati, e che GADU non assume alcuna responsabilità legale in relazione al trattamento dei dati personali.
                  </span>
                </label>
              </div>

              {/* Numero Loggia Input */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800">Numero Loggia GLRI</h2>
                <p className="text-slate-600 text-sm">Inserisci il numero ufficiale della tua loggia presso la Gran Loggia Regolare d'Italia</p>
                <input
                  type="text"
                  value={formData.glriNumber}
                  onChange={(e) => updateField('glriNumber', e.target.value)}
                  placeholder="es: 105"
                  maxLength={4}
                  disabled={!disclaimerAccepted}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none text-lg disabled:bg-slate-100 disabled:cursor-not-allowed"
                  autoFocus
                />
              </div>
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
              <h2 className="text-xl font-bold text-slate-800">Dati Associazione</h2>
              <p className="text-slate-600 text-sm">Informazioni ufficiali dell'associazione</p>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome Associazione</label>
                <input
                  type="text"
                  value={formData.associationName}
                  onChange={(e) => updateField('associationName', e.target.value)}
                  placeholder="es: Associazione Culturale Demo"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Indirizzo</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="es: Via Roma 123"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">CAP</label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => updateField('zipCode', e.target.value)}
                    placeholder="es: 00100"
                    maxLength={5}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Città</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="es: Roma"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Provincia</label>
                <select
                  value={formData.province}
                  onChange={(e) => updateField('province', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none"
                >
                  <option value="">Seleziona...</option>
                  {ITALIAN_PROVINCES.map(prov => (
                    <option key={prov.code} value={prov.code}>
                      {prov.name} ({prov.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Codice Fiscale</label>
                <input
                  type="text"
                  value={formData.taxCode}
                  onChange={(e) => updateField('taxCode', e.target.value.toUpperCase())}
                  placeholder="es: ABCDEF12G34H567I"
                  maxLength={16}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-masonic-gold focus:border-transparent outline-none font-mono"
                />
              </div>
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
                disabled={loading || (currentStep === 1 && !disclaimerAccepted)}
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
