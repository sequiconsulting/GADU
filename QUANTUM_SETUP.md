# 🔐 Quantum-Resistant Encryption Setup

## Quick Start

### 1. Setup produzione (prima volta)

```bash
# Installa dipendenze
npm install

# Genera chiavi quantum e registrale su Netlify
npm run generate-quantum-keys

# Deploy
netlify deploy --prod
```

### 2. Sviluppo locale

```bash
# Registry in plaintext (no crittografia)
netlify dev
```

Il registry locale è salvato in `.netlify/registry.json` come **plaintext JSON**.

### 3. Test

```bash
# Verifica registry locale
npm run test:registry-local
```

## Cosa fa lo script generate-quantum-keys

1. ✅ Genera chiavi **ML-KEM-768** (post-quantum, NIST FIPS 203)
2. ✅ Genera chiavi **RSA-4096** (classica)
3. ✅ Salva chiavi pubbliche in `netlify/functions/_shared/quantumKeys.ts`
4. ✅ Registra chiavi private come variabili ambiente Netlify:
   - `KYBER_PRIVATE_KEY`
   - `RSA_PRIVATE_KEY`
5. ✅ Salva copia locale in `.netlify/quantum-keys.json` (git-ignored)

## Encryption Architecture

**Triple-layer hybrid:**

```
Plaintext → AES-256-GCM → ML-KEM-768 → RSA-4096 → Ciphertext (v2)
```

- **AES-256-GCM**: Crittografia simmetrica veloce
- **ML-KEM-768**: Protezione post-quantum (NIST FIPS 203 - 2024)
- **RSA-4096**: Protezione classica attuale

## Environment

### Locale (NETLIFY_DEV=true)
- Registry: `.netlify/registry.json` (plaintext JSON)
- Encryption: **DISABLED**

### Produzione
- Registry: Netlify Blobs `gadu-registry/lodges`
- Encryption: **v2 Quantum Hybrid** (Kyber+RSA+AES)
- Keys: Netlify environment variables

## Documentazione completa

Vedi [docs/QUANTUM_ENCRYPTION.md](docs/QUANTUM_ENCRYPTION.md)
