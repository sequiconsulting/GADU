# Quantum-Resistant Registry Encryption

## Overview

GADU utilizza un sistema di crittografia ibrida **post-quantum + classica** per proteggere il registry delle logge nel Netlify Blob storage.

### Architettura di sicurezza

**Triple-layer hybrid encryption:**

1. **AES-256-GCM** - Crittografia simmetrica dei dati (veloce)
2. **ML-KEM-768** - Post-quantum KEM (NIST FIPS 203, ex-Kyber)
3. **RSA-4096** - Crittografia classica per compatibilità attuale

```
Plaintext → AES-256-GCM → ML-KEM-768 → RSA-4096 → Ciphertext
```

### Flusso di crittografia

**Encryption:**
```
1. Genera chiave AES-256 random
2. Cripta dati con AES-GCM → ciphertext + IV + authTag
3. Incapsula chiave AES con ML-KEM-768 → mlkem_ciphertext + shared_secret
4. XOR chiave AES con shared_secret → protected_key
5. Concatena mlkem_ciphertext + protected_key
6. Cripta con RSA-4096 public key → rsa_ciphertext
7. Formato finale: v2:rsa_ciphertext:iv:authTag:aes_data
```

**Decryption:**
```
1. Decripta RSA-4096 con private key → mlkem_payload
2. Estrai mlkem_ciphertext + protected_key
3. Decapsula con ML-KEM-768 private key → shared_secret
4. XOR protected_key ⊕ shared_secret → chiave AES originale
5. Decripta dati con AES-GCM → plaintext
```

## Generazione chiavi

### Prima volta (setup produzione)

```bash
# 1. Installa dipendenze
npm install

# 2. Autenticati su Netlify
netlify login

# 3. Linka il sito (se non già fatto)
netlify link

# 4. Genera e registra le chiavi
npm run generate-quantum-keys
```

Lo script:
- ✅ Genera coppia Kyber-768 (post-quantum)
- ✅ Genera coppia RSA-4096 (classica)
- ✅ Salva chiavi **pubbliche** in `netlify/functions/_shared/quantumKeys.ts`
- ✅ Salva chiavi **private** come variabili ambiente Netlify
- ✅ Salva copia locale in `.netlify/quantum-keys.json` (git-ignored)

### Con site ID specifico

```bash
npm run generate-quantum-keys -- --site-id YOUR_NETLIFY_SITE_ID
```

## Sviluppo locale

### Con Netlify Dev

```bash
netlify dev
```

**Comportamento:** Il registry viene salvato in `.netlify/registry.json` in **plaintext** (no crittografia).

Questo permette di:
- ✅ Debuggare facilmente
- ✅ Ispezionare i dati
- ✅ Evitare dipendenze da chiavi in dev

### Test crittografia locale

Se vuoi testare la crittografia in locale:

```bash
# Genera chiavi locali
npm run generate-quantum-keys

# Le chiavi vengono salvate in .netlify/quantum-keys.json
# Netlify dev le caricherà automaticamente
```

## Produzione

### Environment Variables (Netlify)

Dopo `npm run generate-quantum-keys`, queste variabili sono impostate automaticamente:

- `KYBER_PRIVATE_KEY` - Chiave privata Kyber-768 (hex)
- `RSA_PRIVATE_KEY` - Chiave privata RSA-4096 (PEM)

**⚠️ Non committare mai queste chiavi in git!**

### Deploy

```bash
# Build
npm run build

# Deploy
netlify deploy --prod
```

Al primo deploy con le nuove chiavi:
- Registry esistente con crittografia legacy (v1) viene letto correttamente
- Nuovi salvataggi usano crittografia quantum (v2)

## Formati supportati

Il sistema supporta **backward compatibility**:

| Formato | Versione | Descrizione |
|---------|----------|-------------|
| `plaintext` | - | Nessuna crittografia (dev locale) |
| `iv:tag:data` | Legacy | AES-256-GCM solo |
| `v1:iv:tag:data` | 1 | AES-256-GCM (legacy esplicito) |
| `v2:rsa:iv:tag:data` | 2 | Quantum hybrid (Kyber+RSA+AES) |

## Sicurezza

### Protezione quantistica

**ML-KEM-768** (NIST FIPS 203 - ex Kyber) è lo standard NIST per crittografia post-quantum (2024):
- Basato su lattice cryptography (Module-LWE)
- Resistente ad attacchi con computer quantistici (Shor's algorithm)
- Standard ufficiale per KEM post-quantum

### Protezione classica

**RSA-4096** fornisce:
- 152-bit security level (equivalente a 3072-bit symmetric)
- Protezione contro attacchi classici attuali
- Compatibilità con infrastrutture esistenti

### Difesa in profondità

Un attaccante dovrebbe violare **TUTTI E TRE** i layer:
1. Rompere RSA-4096 (computazionalmente difficile oggi)
2. Rompere ML-KEM-768 (resistente a quantum)
3. Rompere AES-256-GCM (impossibile anche con quantum)

**Teorema:** Anche se RSA viene violato con un computer quantistico, ML-KEM protegge la chiave AES.

## Rotazione chiavi

Per generare nuove chiavi:

```bash
# Genera nuove chiavi (sovrascrive le precedenti in Netlify env)
npm run generate-quantum-keys

# Deploy per applicare
netlify deploy --prod
```

**Nota:** I dati già criptati con chiavi vecchie rimangono accessibili fino a che non vengono riscritti.

## Troubleshooting

### "Missing quantum keys in env"

**Causa:** Chiavi non generate o non deployate.

**Soluzione:**
```bash
npm run generate-quantum-keys
netlify deploy --prod
```

### "Quantum decryption failed"

**Causa:** Chiavi private non corrispondono a quelle usate per cifrare.

**Soluzione:** Verifica le variabili ambiente su Netlify dashboard.

### In dev: "No local quantum keys found"

**Normale:** In dev locale senza chiavi, i dati sono in plaintext.

**Per testare crittografia:** Genera chiavi con `npm run generate-quantum-keys`.

## Performance

**Overhead crittografia:**
- Encryption: ~5-10ms per registry medio (100 logge)
- Decryption: ~5-10ms
- Storage: +1-2KB per layer crittografico

**Accettabile** per un registry che viene letto/scritto sporadicamente.

## Riferimenti

- [NIST FIPS 203 - ML-KEM Standard](https://csrc.nist.gov/pubs/fips/203/final)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [ML-KEM (Kyber) Specification](https://pq-crystals.org/kyber/)
- [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum)
