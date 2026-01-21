import React, { useEffect, useMemo, useState } from 'react';
import { Member } from '../types';
import { PublicLodgeConfig } from '../types/lodge';
import { BRANCHES, isMemberActiveInYear } from '../constants';

interface RicevuteProps {
  members: Member[];
  selectedYear: number;
  lodge?: PublicLodgeConfig | null;
}

// Helper to format currency in EUR (it-IT)
const formatEuro = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

// Qualifiche rimosse secondo richiesta

const getMemberFull = (m: Member) => `${m.lastName} ${m.firstName} (Matr. ${m.matricula})`;

export const Ricevute: React.FC<RicevuteProps> = ({ members, selectedYear, lodge }) => {
  const activeMembers = useMemo(() => {
    return members
      .filter(m => BRANCHES.some(b => isMemberActiveInYear(m[b.type.toLowerCase() as 'craft' | 'mark' | 'arch' | 'ram'], selectedYear)))
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [members, selectedYear]);

  const [payer, setPayer] = useState<'ASSOCIAZIONE' | 'MEMBER'>('ASSOCIAZIONE');
  const [payerMemberId, setPayerMemberId] = useState<string>('');
  const [receiver, setReceiver] = useState<'ASSOCIAZIONE' | 'MEMBER'>('MEMBER');
  const [receiverMemberId, setReceiverMemberId] = useState<string>('');
  const [date, setDate] = useState<string>(() => `${selectedYear}-01-01`);
  const [amountInput, setAmountInput] = useState<string>('0');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    // Update default date when year changes
    setDate(`${selectedYear}-01-01`);
  }, [selectedYear]);

  const amount = useMemo(() => {
    const cleaned = amountInput.replace(',', '.').trim();
    const n = Number(cleaned);
    return isFinite(n) ? n : NaN;
  }, [amountInput]);

  const payerMember = useMemo(() => activeMembers.find(m => m.id === payerMemberId), [activeMembers, payerMemberId]);
  const receiverMember = useMemo(() => activeMembers.find(m => m.id === receiverMemberId), [activeMembers, receiverMemberId]);

  const allValid =
    ((payer === 'ASSOCIAZIONE') || (payer === 'MEMBER' && !!payerMember)) &&
    ((receiver === 'ASSOCIAZIONE') || (receiver === 'MEMBER' && !!receiverMember)) &&
    !!date &&
    !!reason.trim() &&
    isFinite(amount) && amount > 0;

  const handlePrint = () => {
    const originalTitle = document.title;
    const titleWho = receiver === 'ASSOCIAZIONE' ? (lodge?.associationName || 'Associazione') : (receiverMember ? getMemberFull(receiverMember) : 'Ricevuta');
    document.title = `Ricevuta - ${titleWho} - ${date}`;
    window.print();
    document.title = originalTitle;
  };

  const renderPartyDetails = (kind: 'payer' | 'receiver') => {
    const isAssoc = kind === 'payer' ? payer === 'ASSOCIAZIONE' : receiver === 'ASSOCIAZIONE';
    const member = kind === 'payer' ? payerMember : receiverMember;
    return (
      <div className="space-y-1">
        <div className="font-semibold text-slate-900">{kind === 'receiver' ? 'Ricevuto da' : 'Pagato da'}:</div>
        {isAssoc ? (
          <div className="text-sm text-slate-700">
            <div>{lodge?.associationName || 'Associazione'}</div>
            {(lodge?.address || lodge?.zipCode || lodge?.city) && (
              <div>{[lodge?.address, [lodge?.zipCode, lodge?.city].filter(Boolean).join(' ')].filter(Boolean).join(' - ')}</div>
            )}
            {lodge?.taxCode && <div>CF: {lodge.taxCode}</div>}
          </div>
        ) : member ? (
          <div className="text-sm text-slate-700">
            <div>{member.lastName} {member.firstName}</div>
            <div>Matr. {member.matricula}{member.city ? ` - ${member.city}` : ''}</div>
            {member.email && <div>Email: {member.email}</div>}
            {member.phone && <div>Telefono: {member.phone}</div>}
          </div>
        ) : (
          <div className="text-sm italic text-slate-400">Seleziona un nominativo</div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <h3 className="text-xl font-serif font-bold text-slate-900 mb-4 print:hidden">Gestione Ricevute di cassa</h3>
      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pagato da */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="font-semibold text-slate-800 mb-2">Pagato da</div>
            <div className="space-y-2">
              <select
                value={payer}
                onChange={(e) => setPayer(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="ASSOCIAZIONE">Associazione</option>
                <option value="MEMBER">Fratello</option>
              </select>
              {payer === 'MEMBER' && (
                <select
                  value={payerMemberId}
                  onChange={(e) => setPayerMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                >
                  <option value="">Seleziona fratello...</option>
                  {activeMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.lastName} {m.firstName} (Matr. {m.matricula})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Ricevuto da */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="font-semibold text-slate-800 mb-2">Ricevuto da</div>
            <div className="space-y-2">
              <select
                value={receiver}
                onChange={(e) => setReceiver(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                <option value="ASSOCIAZIONE">Associazione</option>
                <option value="MEMBER">Fratello</option>
              </select>
              {receiver === 'MEMBER' && (
                <select
                  value={receiverMemberId}
                  onChange={(e) => setReceiverMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                >
                  <option value="">Seleziona fratello...</option>
                  {activeMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.lastName} {m.firstName} (Matr. {m.matricula})</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {/* Importo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Importo (EUR)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Motivo (obbligatorio)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Descrivi il motivo del pagamento..."
          />
        </div>

        {/* Anteprima compatta */}
        {allValid && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
            <div className="font-semibold mb-2">Anteprima stampa</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              {renderPartyDetails('receiver')}
              {renderPartyDetails('payer')}
            </div>
            <div className="mt-1">Data: <span className="font-medium">{date}</span></div>
            <div className="mt-1">Importo: <span className="font-medium">{isFinite(amount) ? formatEuro(amount) : '-'}</span></div>
          </div>
        )}

        <div className="flex justify-end">
          {allValid ? (
            <button onClick={handlePrint} className="px-5 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm">Stampa ricevuta</button>
          ) : (
            <button disabled className="px-5 py-2 rounded-lg bg-slate-200 text-slate-500 cursor-not-allowed">Compila tutti i campi</button>
          )}
        </div>
      </div>

      {/* PRINT AREA */}
      <div className="hidden print:block bg-white text-slate-900">
        <div className="max-w-2xl mx-auto p-8">
          {/* Intestazioni delle parti senza riferimenti a GADU */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            {renderPartyDetails('receiver')}
            {renderPartyDetails('payer')}
          </div>

          <div className="text-sm text-slate-700 mb-6">Data: <span className="font-medium">{date}</span></div>

          <p className="leading-7 text-slate-800 whitespace-pre-wrap">
            {(() => {
              const receiverLabel = receiver === 'ASSOCIAZIONE'
                ? (lodge?.associationName || 'Associazione')
                : receiverMember ? `${receiverMember.lastName} ${receiverMember.firstName} (Matr. ${receiverMember.matricula})` : '';
              const payerLabel = payer === 'ASSOCIAZIONE'
                ? (lodge?.associationName || 'Associazione')
                : payerMember ? `${payerMember.lastName} ${payerMember.firstName} (Matr. ${payerMember.matricula})` : '';
              return `Io sottoscritto ${receiverLabel} ricevo in data odierna la somma di ${isFinite(amount) ? formatEuro(amount) : ''} da ${payerLabel} per il seguente motivo:`;
            })()}
          </p>

          <div className="border border-slate-300 rounded-md p-4 my-4 min-h-24">
            <div className="whitespace-pre-wrap">{reason}</div>
          </div>

          <div className="text-right text-base font-semibold mt-6">Somma ricevuta: {isFinite(amount) ? formatEuro(amount) : ''}</div>

          <div className="mt-8 text-sm font-medium tracking-wide">PER CASSA</div>

          <div className="mt-12 flex justify-end">
            <div className="text-center w-64">
              <div className="border-t border-slate-400 h-0" />
              <div className="text-xs mt-2">Firma</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
