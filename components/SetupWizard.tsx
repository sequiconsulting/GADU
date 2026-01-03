import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    lodgeName: '',
    glriNumber: '',
    province: '',
    gdprAccepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleNext = () => setCurrentStep((s) => s + 1);
  const handleBack = () => setCurrentStep((s) => s - 1);
  const updateField = (field: keyof typeof formData, value: string | boolean) => 
    setFormData((prev) => ({ ...prev, [field]: value }));
  
  const isStep2Valid = formData.lodgeName.trim() && formData.glriNumber.trim() && formData.province.trim();

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulazione invio richiesta
      await new Promise((res) => setTimeout(res, 1000));
      setSuccessId('RICHIESTA-' + Math.floor(Math.random() * 100000));
      setCurrentStep(4);
    } catch (e) {
      setError('Errore durante l\'invio della richiesta.');
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Approvazione legale (GDPR)</h3>
              <p className="text-sm text-blue-800">
                Per procedere devi dichiarare di aver verificato gli adempimenti GDPR e la base giuridica per il trattamento dei dati.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="gdpr-checkbox"
                checked={formData.gdprAccepted}
                onChange={(e) => updateField('gdprAccepted', e.target.checked)}
                className="mt-1"
                disabled={loading}
              />
              <label htmlFor="gdpr-checkbox" className="text-sm text-slate-700">
                Confermo l'approvazione legale GDPR e autorizzo l'invio della richiesta di attivazione.
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="Nome loggia"
                disabled={loading}
              />
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
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="123"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="province" className="block text-sm font-semibold text-slate-700 mb-2">
                Provincia
              </label>
              <input
                type="text"
                id="province"
                value={formData.province}
                onChange={(e) => updateField('province', e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                placeholder="Provincia"
                disabled={loading}
              />
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
              disabled={loading || 
                (currentStep === 1 && !formData.gdprAccepted) ||
                (currentStep === 2 && !isStep2Valid)
              }
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
