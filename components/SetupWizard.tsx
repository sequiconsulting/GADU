import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    lodgeName: '',
    glriNumber: '',
    province: '',
    associationName: '',
    address: '',
    zipCode: '',
    city: '',
    taxCode: '',
    secretaryEmail: '',
    gdprAccepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep === 2) {
      const errors = validateStep2();
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }
      setValidationErrors({});
    }
    setCurrentStep((s) => s + 1);
  };

  const validateStep2 = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // Validazione campi obbligatori
    if (!formData.lodgeName.trim()) errors.lodgeName = 'Nome loggia obbligatorio';
    if (!formData.glriNumber.trim()) errors.glriNumber = 'Numero GLRI obbligatorio';
    if (!formData.province.trim()) errors.province = 'Provincia obbligatoria';
    if (!formData.associationName.trim()) errors.associationName = 'Nome associazione obbligatorio';
    if (!formData.address.trim()) errors.address = 'Indirizzo obbligatorio';
    if (!formData.zipCode.trim()) errors.zipCode = 'CAP obbligatorio';
    if (!formData.city.trim()) errors.city = 'Città obbligatoria';
    if (!formData.taxCode.trim()) errors.taxCode = 'Codice fiscale obbligatorio';
    if (!formData.secretaryEmail.trim()) errors.secretaryEmail = 'Email segretario obbligatoria';
    
    // Validazione formato glriNumber
    if (formData.glriNumber.trim() && !/^\d{1,10}$/.test(formData.glriNumber.trim())) {
      errors.glriNumber = 'Numero loggia non valido (massimo 10 cifre)';
    }
    
    // Validazione formato province
    if (formData.province.trim() && !/^[A-Z]{2}$/.test(formData.province.trim().toUpperCase())) {
      errors.province = 'Provincia non valida (2 lettere, es. RM)';
    }
    
    // Validazione formato zipCode
    if (formData.zipCode.trim() && !/^\d{5}$/.test(formData.zipCode.trim())) {
      errors.zipCode = 'CAP non valido (5 cifre)';
    }
    
    // Validazione formato taxCode
    if (formData.taxCode.trim() && !/^\d{15}$/.test(formData.taxCode.trim())) {
      errors.taxCode = 'Codice fiscale non valido (15 caratteri numerici)';
    }
    
    // Validazione formato email
    if (formData.secretaryEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.secretaryEmail.trim())) {
      errors.secretaryEmail = 'Formato email non valido';
    }
    
    return errors;
  };

  const handleBack = () => setCurrentStep((s) => s - 1);
  const updateField = (field: keyof typeof formData, value: string | boolean) => 
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/.netlify/functions/submit-lodge-activation-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gdprAccepted: formData.gdprAccepted,
          glriNumber: formData.glriNumber.trim(),
          lodgeName: formData.lodgeName.trim(),
          province: formData.province.trim().toUpperCase(),
          associationName: formData.associationName.trim(),
          address: formData.address.trim(),
          zipCode: formData.zipCode.trim(),
          city: formData.city.trim(),
          taxCode: formData.taxCode.trim(),
          secretaryEmail: formData.secretaryEmail.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'invio della richiesta');
      }
      setSuccessId(data.requestId);
      setCurrentStep(4);
    } catch (e: any) {
      setError(e.message || 'Errore durante l\'invio della richiesta.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToDashboard = () => {
    navigate('/');
  };

  return (
    <div className="max-w-xl mx-auto mt-12 bg-white rounded-lg shadow p-8 animate-fadeIn">
      <h1 className="text-2xl font-bold mb-6 text-center">Richiesta Attivazione Loggia</h1>
      <div className="mb-8 flex justify-center gap-2">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`w-8 h-2 rounded-full transition-all duration-300 ${
              currentStep === step ? 'bg-masonic-gold' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <div className="min-h-[260px]">
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <h3 className="font-bold text-blue-900 mb-3 text-lg">Informativa Privacy e Dichiarazione di Responsabilità (GDPR)</h3>
              <div className="text-xs text-blue-900 space-y-3 leading-relaxed max-h-96 overflow-y-auto pr-2">
                <p className="font-semibold">
                  Prima di procedere, è obbligatorio prendere visione delle seguenti condizioni e dichiarazioni, ai sensi del Regolamento (UE) 2016/679 ("GDPR") e della normativa italiana applicabile in materia di protezione dei dati personali (D.Lgs. 196/2003 e s.m.i.):
                </p>
                
                <div>
                  <p className="font-semibold underline mb-1">1. Natura del Servizio GADU</p>
                  <p>
                    GADU (Gestione Associazioni Decisamente User-friendly) è un software fornito "AS-IS" come strumento tecnico per la gestione amministrativa di Associazioni. GADU NON è né Titolare né Responsabile del trattamento dei dati personali delle Associazioni utilizzatrici ai sensi degli artt. 4(7) e 4(8) GDPR.
                  </p>
                </div>

                <div>
                  <p className="font-semibold underline mb-1">2. Titolarità e Responsabilità del Trattamento</p>
                  <p>
                    Ciascuna Associazione utilizzatrice del servizio GADU è UNICO ED ESCLUSIVO TITOLARE DEL TRATTAMENTO dei dati personali dei propri membri, ai sensi dell'art. 4(7) GDPR. L'Associazione richiedente è pertanto l'unica responsabile di:
                  </p>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Individuare e documentare le basi giuridiche del trattamento (art. 6 GDPR)</li>
                    <li>Garantire il rispetto dei principi di liceità, correttezza, trasparenza, minimizzazione e limitazione della conservazione (art. 5 GDPR)</li>
                    <li>Fornire adeguate informative privacy agli interessati (artt. 13-14 GDPR)</li>
                    <li>Gestire i diritti degli interessati (artt. 15-22 GDPR: accesso, rettifica, cancellazione, portabilità, opposizione)</li>
                    <li>Implementare misure tecniche e organizzative adeguate (art. 32 GDPR)</li>
                    <li>Notificare eventuali violazioni dei dati personali (data breach) all'Autorità Garante entro 72 ore (art. 33 GDPR)</li>
                    <li>Mantenere il Registro delle attività di trattamento (art. 30 GDPR)</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold underline mb-1">3. Ruolo di Supabase Inc.</p>
                  <p>
                    L'infrastruttura di storage e database è fornita da Supabase Inc., società di diritto statunitense, che agisce quale RESPONSABILE DEL TRATTAMENTO (Data Processor) ai sensi dell'art. 28 GDPR per conto dell'Associazione. Ciascuna Associazione stipula autonomamente e direttamente con Supabase Inc. il contratto di servizio (Data Processing Agreement - DPA) e ne è l'unica responsabile. I dati sono ospitati su server ubicati nella regione geografica selezionata dall'Associazione stessa in sede di configurazione del progetto Supabase.
                  </p>
                </div>

                <div>
                  <p className="font-semibold underline mb-1">4. Esclusione di Responsabilità di GADU</p>
                  <p className="font-semibold">GADU declina OGNI responsabilità per:</p>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Violazioni GDPR o della normativa privacy commesse dall'Associazione utilizzatrice</li>
                    <li>Trattamenti illeciti, non autorizzati o non conformi operati dall'Associazione</li>
                    <li>Mancata adozione di misure di sicurezza adeguate da parte dell'Associazione</li>
                    <li>Data breach, perdite, alterazioni, distruzioni o divulgazioni non autorizzate di dati personali</li>
                    <li>Interruzioni del servizio, perdita di dati, malfunzionamenti hardware/software di Supabase o dell'infrastruttura cloud</li>
                    <li>Mancata esecuzione o esecuzione difettosa di operazioni di backup e disaster recovery</li>
                    <li>Indisponibilità, corruzione o perdita definitiva dei backup</li>
                    <li>Violazioni di sicurezza, accessi abusivi, attacchi informatici o compromissione delle credenziali</li>
                    <li>Qualsiasi danno diretto, indiretto, consequenziale, patrimoniale o non patrimoniale derivante dall'uso del software GADU o del servizio Supabase</li>
                    <li>Sanzioni amministrative irrogate dall'Autorità Garante per la protezione dei dati personali</li>
                    <li>Azioni legali, richieste di risarcimento danni o contenziosi promossi da interessati o da terzi</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold underline mb-1">5. Obblighi dell'Associazione Richiedente</p>
                  <p>L'Associazione si impegna a:</p>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Designare un Responsabile della protezione dei dati (DPO) ove obbligatorio (art. 37 GDPR)</li>
                    <li>Effettuare, se necessaria, la Valutazione d'Impatto sulla Protezione dei Dati (DPIA) ai sensi dell'art. 35 GDPR</li>
                    <li>Conservare evidenza documentale del consenso degli interessati (ove applicabile come base giuridica)</li>
                    <li>Adottare policy interne di gestione e sicurezza dei dati</li>
                    <li>Formare adeguatamente gli utenti autorizzati all'accesso e al trattamento dei dati tramite GADU</li>
                    <li>Verificare periodicamente la conformità del proprio trattamento alla normativa privacy vigente</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold underline mb-1">6. Dichiarazione del Richiedente</p>
                  <p>Selezionando la casella di accettazione sottostante, il richiedente dichiara formalmente e irrevocabilmente di:</p>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Essere legalmente autorizzato dall'Associazione a presentare la richiesta di attivazione del servizio GADU e a vincolare l'Associazione alle presenti condizioni</li>
                    <li>Aver preso piena e completa visione della presente informativa</li>
                    <li>Aver compreso la natura del servizio e le responsabilità derivanti dal GDPR</li>
                    <li>Accettare integralmente e senza riserve ogni clausola di esclusione di responsabilità qui contenuta</li>
                    <li>Sollevare e manlevare GADU, i suoi sviluppatori, collaboratori e fornitori da qualsiasi responsabilità, pretesa, azione legale o richiesta risarcitoria derivante dall'uso del software</li>
                    <li>Assumere in via esclusiva ogni responsabilità civile, penale e amministrativa derivante dal trattamento dei dati personali tramite GADU</li>
                  </ul>
                </div>

                <p className="font-semibold text-red-900 mt-3 pt-3 border-t border-blue-300">
                  ⚠️ ATTENZIONE: La richiesta di attivazione non potrà essere inviata senza l'accettazione esplicita delle presenti condizioni mediante selezione della casella sottostante. L'accettazione costituisce dichiarazione formale vincolante ai sensi degli artt. 1341 e 1342 c.c.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white border-2 border-blue-300 rounded-lg p-4">
              <input
                type="checkbox"
                id="gdpr-checkbox"
                checked={formData.gdprAccepted}
                onChange={(e) => updateField('gdprAccepted', e.target.checked)}
                className="mt-1 w-5 h-5 flex-shrink-0"
                disabled={loading}
              />
              <label htmlFor="gdpr-checkbox" className="text-sm text-slate-900 font-semibold cursor-pointer select-none">
                Dichiaro di essere legalmente autorizzato dall'Associazione a presentare questa richiesta, di aver letto integralmente e compreso la presente informativa, di accettare tutte le condizioni e clausole di esclusione di responsabilità ivi contenute, e di assumere in via esclusiva ogni responsabilità derivante dal trattamento dei dati personali ai sensi del GDPR (Regolamento UE 2016/679) e della normativa italiana applicabile.
              </label>
            </div>
          </div>
        )}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="lodge-name" className="block text-sm font-semibold text-slate-700 mb-2">
                Nome Loggia
              </label>
              <input
                type="text"
                id="lodge-name"
                value={formData.lodgeName}
                onChange={(e) => updateField('lodgeName', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${
                  validationErrors.lodgeName ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="Nome loggia"
                disabled={loading}
              />
              {validationErrors.lodgeName && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.lodgeName}</p>
              )}
            </div>
            <div>
              <label htmlFor="glri-number" className="block text-sm font-semibold text-slate-700 mb-2">
                Numero Loggia (GLRI)
              </label>
              <input
                type="text"
                id="glri-number"
                value={formData.glriNumber}
                onChange={(e) => updateField('glriNumber', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${
                  validationErrors.glriNumber ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="123"
                disabled={loading}
              />
              {validationErrors.glriNumber && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.glriNumber}</p>
              )}
            </div>
            <div>
              <label htmlFor="province" className="block text-sm font-semibold text-slate-700 mb-2">
                Provincia
              </label>
              <input
                type="text"
                id="province"
                value={formData.province}
                onChange={(e) => updateField('province', e.target.value.toUpperCase())}
                className={`w-full px-4 py-2 border rounded-lg ${
                  validationErrors.province ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="RM"
                maxLength={2}
                disabled={loading}
              />
              {validationErrors.province && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.province}</p>
              )}
            </div>
            <div>
              <label htmlFor="association-name" className="block text-sm font-semibold text-slate-700 mb-2">
                Nome Associazione
              </label>
              <input
                type="text"
                id="association-name"
                value={formData.associationName}
                onChange={(e) => updateField('associationName', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${
                  validationErrors.associationName ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="Nome dell'associazione"
                disabled={loading}
              />
              {validationErrors.associationName && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.associationName}</p>
              )}
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-slate-700 mb-2">
                Indirizzo
              </label>
              <input
                type="text"
                id="address"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${
                  validationErrors.address ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="Via, numero"
                disabled={loading}
              />
              {validationErrors.address && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.address}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="zip-code" className="block text-sm font-semibold text-slate-700 mb-2">
                  CAP
                </label>
                <input
                  type="text"
                  id="zip-code"
                  value={formData.zipCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                    updateField('zipCode', value);
                  }}
                  className={`w-full px-4 py-2 border rounded-lg ${
                    validationErrors.zipCode ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="00000"
                  maxLength={5}
                  disabled={loading}
                />
                {validationErrors.zipCode && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.zipCode}</p>
                )}
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-semibold text-slate-700 mb-2">
                  Città
                </label>
                <input
                  type="text"
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${
                    validationErrors.city ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="Città"
                  disabled={loading}
                />
                {validationErrors.city && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.city}</p>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="tax-code" className="block text-sm font-semibold text-slate-700 mb-2">
                Codice Fiscale (15 caratteri numerici)
              </label>
              <input
                type="text"
                id="tax-code"
                value={formData.taxCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                  updateField('taxCode', value);
                }}
                className={`w-full px-4 py-2 border rounded-lg ${
                  validationErrors.taxCode ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="123456789012345"
                maxLength={15}
                disabled={loading}
              />
              {validationErrors.taxCode && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.taxCode}</p>
              )}
            </div>
            <div>
              <label htmlFor="secretary-email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email Segretario
              </label>
              <input
                type="email"
                id="secretary-email"
                value={formData.secretaryEmail}
                onChange={(e) => updateField('secretaryEmail', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg ${
                  validationErrors.secretaryEmail ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="segretario@esempio.it"
                disabled={loading}
              />
              {validationErrors.secretaryEmail && (
                <p className="text-red-600 text-xs mt-1">{validationErrors.secretaryEmail}</p>
              )}
            </div>
          </div>
        )}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">Conferma dati inseriti</h3>
              <ul className="text-slate-700 text-sm space-y-1">
                <li><strong>Nome loggia:</strong> {formData.lodgeName}</li>
                <li><strong>Numero GLRI:</strong> {formData.glriNumber}</li>
                <li><strong>Provincia:</strong> {formData.province}</li>
                <li><strong>Nome Associazione:</strong> {formData.associationName}</li>
                <li><strong>Indirizzo:</strong> {formData.address}</li>
                <li><strong>CAP:</strong> {formData.zipCode}</li>
                <li><strong>Città:</strong> {formData.city}</li>
                <li><strong>Codice Fiscale:</strong> {formData.taxCode}</li>
                <li><strong>Email Segretario:</strong> {formData.secretaryEmail}</li>
                <li><strong>GDPR accettato:</strong> {formData.gdprAccepted ? 'Sì' : 'No'}</li>
              </ul>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
            )}
          </div>
        )}
        {currentStep === 4 && successId && (
          <div className="space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto">
              <CheckCircle className="text-green-700" size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Richiesta inviata</h2>
              <p className="text-sm text-slate-600 mt-2">
                La richiesta di attivazione è stata registrata e verrà processata dall'amministrazione.
              </p>
            </div>
            <div className="text-xs text-slate-500">ID richiesta: <span className="font-mono">{successId}</span></div>
            <button
              onClick={handleReturnToDashboard}
              className="mt-4 px-6 py-3 bg-masonic-gold hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
            >
              Torna alla Dashboard
            </button>
          </div>
        )}
      </div>
      {/* Navigation */}
      {currentStep < 4 && (
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={handleBack}
            disabled={currentStep === 1 || loading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={16} /> Indietro
          </button>
          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              disabled={loading || (currentStep === 1 && !formData.gdprAccepted)}
              className="flex items-center gap-2 px-6 py-3 bg-masonic-gold hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Avanti <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-masonic-gold hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Invio...' : 'Invia richiesta'}
              {!loading && <ArrowRight size={16} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
