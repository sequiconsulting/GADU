
import { BranchType, MasonicBranchData } from "./types";

// ============================================================
// CAPITAZIONI CRAFT (Membership Fees)
// ============================================================
export const CAPITAZIONI_CRAFT = [
  { tipo: 'Ordinaria', importo: 360 },
  { tipo: 'Ridotta Settembre', importo: 100 },
  { tipo: 'Studenti', importo: 150 },
  { tipo: 'Over 80', importo: 180 },
  { tipo: 'Stranieri Residenti Italia', importo: 360 },
  { tipo: 'Italiani Residenti Estero', importo: 100 },
  { tipo: 'Stranieri Residenti Estero', importo: 50 },
  { tipo: 'Doppia Appartenenza', importo: 100 },
  { tipo: 'Loggia di Ricerca', importo: 50 }
] as const;

export const CAPITAZIONE_DEFAULT = 'Ordinaria';

// ============================================================
// DEGREE DEFINITIONS BY RITUAL
// ============================================================
// Degrees are organized by (branch, ritual) pairs.
// Each combination has its own degree list to support ritual-specific variations.
// 
// CRAFT BRANCH:
//   - Emulation: DEGREES_CRAFT_EMULATION (default, 4 gradi)
//   - Scozzese: DEGREES_CRAFT_SCOZZESE (4 gradi)
//
// MARK & ARCH BRANCHES:
//   - Irlandese: DEGREES_MARK_IRLANDESE, DEGREES_ARCH_IRLANDESE (default)
//   - Aldersgate: DEGREES_MARK_ALDERSGATE, DEGREES_ARCH_ALDERSGATE
//
// RAM BRANCH:
//   - No ritual variants: DEGREES_RAM (fixed, 2 gradi)
//
// USAGE:
//   - For UI: Use getDegreesByRitual(branch, ritual) to get degrees for current ritual year
//   - For lookups: Use getDegreeAbbreviation(degreeName) - searches all variants
//   - Legacy code: Use DEGREES[branch] - maps to default rituals per branch
// ============================================================

// Termini di ingresso per ogni ramo (primo evento di attivazione)
export const INITIATION_TERMS: Record<BranchType, string> = {
  CRAFT: 'Iniziazione',
  MARK: 'Avanzamento',
  ARCH: 'Esaltazione',
  RAM: 'Elevazione'
};

// Status change reasons per branch and type
export const STATUS_REASONS = {
  ACTIVATION: {
    CRAFT: ['Iniziazione', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero'],
    MARK: ['Avanzamento', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero'],
    ARCH: ['Esaltazione', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero'],
    RAM: ['Elevazione', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero']
  },
  DEACTIVATION: {
    CRAFT: ['Dimissioni', 'Oriente Eterno', 'Depennamento', 'Trasferimento Italia', 'Trasferimento Estero'],
    MARK: ['Dimissioni', 'Oriente Eterno', 'Depennamento', 'Trasferimento Italia', 'Trasferimento Estero'],
    ARCH: ['Dimissioni', 'Oriente Eterno', 'Depennamento', 'Trasferimento Italia', 'Trasferimento Estero'],
    RAM: ['Dimissioni', 'Oriente Eterno', 'Depennamento', 'Trasferimento Italia', 'Trasferimento Estero']
  }
};

// Default degree lists per branch (used in DEGREES object and as fallbacks)
export const DEGREES_CRAFT_EMULATION = [
  { name: 'Apprendista Ammesso', abbreviation: 'AA' },
  { name: 'Compagno di Mestiere', abbreviation: 'CdM' },
  { name: 'Maestro Muratore', abbreviation: 'MM' },
  { name: 'Maestro Installato', abbreviation: 'MI' },
];

// Scozzese (Scottish Rite) variant for Craft
export const DEGREES_CRAFT_SCOZZESE = [
  { name: 'Apprendista Ammesso', abbreviation: 'AA' },
  { name: 'Compagno di Mestiere', abbreviation: 'CdM' },
  { name: 'Maestro Muratore', abbreviation: 'MM' },
  { name: 'Maestro Scozzese', abbreviation: 'MS' },
];

// Irlandese (Irish) variant for Mark - DEFAULT
export const DEGREES_MARK_IRLANDESE = [
  { name: 'Uomo del Marchio', abbreviation: 'UdM' },
  { name: 'Maestro del Marchio', abbreviation: 'MMM' },
  { name: 'Maestro Installato del Marchio', abbreviation: 'MIM' },
];

// Aldersgate variant for Mark
export const DEGREES_MARK_ALDERSGATE = [
  { name: 'Uomo del Marchio', abbreviation: 'UdM' },
  { name: 'Maestro del Marchio', abbreviation: 'MMM' },
  { name: 'Maestro Aldersgate', abbreviation: 'MA' },
];

// Irlandese (Irish) variant for Arch - DEFAULT
export const DEGREES_ARCH_IRLANDESE = [
  { name: "Compagno dell'Arco Reale", abbreviation: 'CAR' },
  { name: "Principale dell'Arco Reale", abbreviation: 'PAR' },
];

// Aldersgate variant for Arch
export const DEGREES_ARCH_ALDERSGATE = [
  { name: "Compagno dell'Arco Reale", abbreviation: 'CAR' },
  { name: "Principale Aldersgate", abbreviation: 'PA' },
];

// RAM has no ritual variants
export const DEGREES_RAM = [
  { name: "Marinaio dell'Arca Reale", abbreviation: 'MAR' },
  { name: 'Comandante del RAM', abbreviation: 'CdR' },
];

export const BRANCHES: { type: BranchType; label: string; shortLabel: string; color: string; degreeLabels: string[] }[] = [
  {
    type: 'CRAFT',
    label: 'Loggia (Craft)',
    shortLabel: 'Craft',
    color: 'bg-masonic-blue',
    degreeLabels: DEGREES_CRAFT_EMULATION.map(d => d.name)
  },
  {
    type: 'MARK',
    label: 'Loggia del Marchio',
    shortLabel: 'Marchio',
    color: 'bg-masonic-mark',
    degreeLabels: DEGREES_MARK_IRLANDESE.map(d => d.name)
  },
  {
    type: 'ARCH',
    label: 'Arco Reale',
    shortLabel: 'Arch',
    color: 'bg-masonic-red',
    degreeLabels: DEGREES_ARCH_IRLANDESE.map(d => d.name)
  },
  {
    type: 'RAM',
    label: 'Royal Ark Mariner',
    shortLabel: 'RAM',
    color: 'bg-masonic-ram',
    degreeLabels: DEGREES_RAM.map(d => d.name)
  }
];

// Ritual types for each branch
export type CraftRitual = 'Emulation' | 'Scozzese';
export type MarkArchRitual = 'Irlandese' | 'Aldersgate';

// Ritual labels
export const RITUAL_LABELS: Record<string, string> = {
  'Emulation': 'Emulation',
  'Scozzese': 'Scozzese',
  'Irlandese': 'Irlandese',
  'Aldersgate': 'Aldersgate'
};

// ============================================================
// ROLES BY RITUAL (explicit and complete)
// ============================================================

// CRAFT EMULATION - Default
export const CRAFT_EMULATION_ROLES = [
  'Maestro Venerabile',
  'IEM',
  'Primo Sorvegliante',
  'Secondo Sorvegliante',
  'Cappellano',
  'Tesoriere',
  'Segretario',
  'Assistente Segretario',
  'Direttore delle Cerimonie',
  'Elemosiniere',
  'Primo Diacono',
  'Secondo Diacono',
  'Direttore delle Cerimonie Agg.',
  'Organista',
  'Copritore Interno',
  'Copritore Esterno'
];

// CRAFT SCOZZESE (Scottish Rite)
export const CRAFT_SCOZZESE_ROLES = [
  'Venerabile Maestro',
  'Primo Sorvegliante',
  'Secondo Sorvegliante',
  'Oratore',
  'Segretario',
  'Tesoriere',
  'Maestro delle Cerimonie',
  'Esperto',
  'Ospitaliere',
  'Copritore Interno',
  'Copritore Esterno'
];

// MARCHIO IRLANDESE - Default
export const MARCHIO_IRLANDESE_ROLES = [
  'Maestro Venerabile',
  'Primo Sorvegliante',
  'Secondo Sorvegliante',
  'Maestro Supervisore',
  'Primo Supervisore',
  'Secondo Supervisore',
  'Cappellano',
  'Tesoriere',
  'Segretario',
  'Direttore delle Cerimonie',
  'Primo Diacono',
  'Secondo Diacono',
  'Copritore Interno',
  'Tegolatore'
];

// MARCHIO ALDERSGATE
export const MARCHIO_ALDERSGATE_ROLES = [
  'Venerabile Maestro',
  'Primo Sorvegliante',
  'Secondo Sorvegliante',
  'Oratore',
  'Segretario',
  'Tesoriere',
  'Maestro delle Cerimonie',
  'Maestro dei Marchi',
  'Ospitaliere'
];

// ARCH (ARCO REALE) IRLANDESE - Default
export const ARCH_IRLANDESE_ROLES = [
  'Re Eccellente',
  'Sommo Sacerdote',
  'Primo Scriba',
  'Scriba E.',
  'Scriba N.',
  'Tesoriere',
  'Direttore delle Cerimonie',
  'Capitano dell\'Ospite',
  'Soprintendente Principale',
  'Primo Assistente Soprintendente',
  'Secondo Assistente Soprintendente',
  'Janitor'
];

// ARCH (ARCO REALE) ALDERSGATE
export const ARCH_ALDERSGATE_ROLES = [
  'Primo Principale',
  'Secondo Principale',
  'Terzo Principale',
  "Scrivano dell'Arco Reale",
  'Tesoriere',
  'Maestro delle Cerimonie',
  'Maestro del Velo',
  'Sovrintendente dei Lavori',
  'Hospitaliere'
];

// RAM - No ritual variants
export const RAM_ROLES = [
  'Venerabile Comandante Noè',
  'Iafet (Primo Sorvegliante)',
  'Sem (Secondo Sorvegliante)',
  'Scriba',
  'Tesoriere',
  'Direttore delle Cerimonie',
  'Conduttore',
  'Guardiano',
  'Tegolatore'
];

// Function to get degrees based on branch and ritual
export const getDegreesByRitual = (branch: BranchType, ritual: string): { name: string; abbreviation: string }[] => {
  if (branch === 'CRAFT') {
    return ritual === 'Scozzese' ? DEGREES_CRAFT_SCOZZESE : DEGREES_CRAFT_EMULATION;
  }
  if (branch === 'MARK') {
    return ritual === 'Aldersgate' ? DEGREES_MARK_ALDERSGATE : DEGREES_MARK_IRLANDESE;
  }
  if (branch === 'ARCH') {
    return ritual === 'Aldersgate' ? DEGREES_ARCH_ALDERSGATE : DEGREES_ARCH_IRLANDESE;
  }
  if (branch === 'RAM') {
    return DEGREES_RAM;
  }
  return [];
};

// Function to get roles based on branch and ritual
export const getRolesForRitual = (branch: BranchType, ritual: string): string[] => {
  if (branch === 'CRAFT') {
    return ritual === 'Scozzese' ? CRAFT_SCOZZESE_ROLES : CRAFT_EMULATION_ROLES;
  }
  if (branch === 'MARK') {
    return ritual === 'Aldersgate' ? MARCHIO_ALDERSGATE_ROLES : MARCHIO_IRLANDESE_ROLES;
  }
  if (branch === 'ARCH') {
    return ritual === 'Aldersgate' ? ARCH_ALDERSGATE_ROLES : ARCH_IRLANDESE_ROLES;
  }
  if (branch === 'RAM') {
    return RAM_ROLES;
  }
  return [];
};

export const EVENT_STATUS_ACTIVE = 'Riattivazione / Inizio Attività';
export const EVENT_STATUS_INACTIVE = 'Passaggio in Inattività / Oriente Eterno';

export const getMasonicYear = (civilYear: number): number => {
  return civilYear + 4000;
};

export const calculateMasonicYearString = (startYear: number): string => {
  const masonicYear = getMasonicYear(startYear);
  return `${masonicYear}`;
};

/**
 * Determines if a member was active in a specific year based on their status history.
 * Logic: Finds the last status event on or before Dec 31st of the given year.
 */
export const isMemberActiveInYear = (branchData: MasonicBranchData | undefined, year: number): boolean => {
  if (!branchData) return false;

  if (!branchData.statusEvents || branchData.statusEvents.length === 0) {
    // Se non ci sono eventi di stato, il membro non è attivo
    return false;
  }

  const targetDate = `${year}-12-31`;
  const sortedEvents = [...branchData.statusEvents].sort((a, b) => a.date.localeCompare(b.date));

  // Find the last event that is on or before the target date
  const lastEventBeforeOrOnTargetDate = sortedEvents.filter(e => e.date <= targetDate).pop();

  if (!lastEventBeforeOrOnTargetDate) {
    // No events happened in or before this year.
    // This logic assumes a member is not active before their first recorded event.
    return false;
  }

  return lastEventBeforeOrOnTargetDate.status === 'ACTIVE';
};

export const getDegreeAbbreviation = (degreeName: string): string => {
    // List of all degree lists to search through
    const allDegreeLists = [
      DEGREES_CRAFT_EMULATION,
      DEGREES_CRAFT_SCOZZESE,
      DEGREES_MARK_IRLANDESE,
      DEGREES_MARK_ALDERSGATE,
      DEGREES_ARCH_IRLANDESE,
      DEGREES_ARCH_ALDERSGATE,
      DEGREES_RAM,
    ];
    
    // First try exact match
    for (const degreeList of allDegreeLists) {
        const degree = degreeList.find(d => d.name === degreeName);
        if (degree) {
            return degree.abbreviation;
        }
    }
    
    // If no exact match found, try partial match (case-insensitive)
    const normalizedInput = degreeName.toLowerCase().trim();
    for (const degreeList of allDegreeLists) {
        const degree = degreeList.find(d => d.name.toLowerCase().includes(normalizedInput) || normalizedInput.includes(d.name.toLowerCase()));
        if (degree) {
            return degree.abbreviation;
        }
    }
    
    return degreeName;
};

// Italian provinces with official regional domain names from Registro .it
// Regional geodomains (second-level .it domains) follow the official naming:
// - Single-word regions: lowercase (es. lombardia.it, toscana.it)
// - Multi-word regions: hyphenated (es. emilia-romagna.it, friuli-venezia-giulia.it)
// Source: https://www.nic.it (Registro Italiano Domini)
export const ITALIAN_PROVINCES = [
  { code: 'AG', name: 'Agrigento', region: 'sicilia.it' },
  { code: 'AL', name: 'Alessandria', region: 'piemonte.it' },
  { code: 'AN', name: 'Ancona', region: 'marche.it' },
  { code: 'AO', name: 'Aosta', region: 'valle-aosta.it' },
  { code: 'AP', name: 'Ascoli Piceno', region: 'marche.it' },
  { code: 'AQ', name: 'L\'Aquila', region: 'abruzzo.it' },
  { code: 'AR', name: 'Arezzo', region: 'toscana.it' },
  { code: 'AT', name: 'Asti', region: 'piemonte.it' },
  { code: 'AV', name: 'Avellino', region: 'campania.it' },
  { code: 'BA', name: 'Bari', region: 'puglia.it' },
  { code: 'BG', name: 'Bergamo', region: 'lombardia.it' },
  { code: 'BI', name: 'Biella', region: 'piemonte.it' },
  { code: 'BL', name: 'Belluno', region: 'veneto.it' },
  { code: 'BN', name: 'Benevento', region: 'campania.it' },
  { code: 'BO', name: 'Bologna', region: 'emilia-romagna.it' },
  { code: 'BR', name: 'Brindisi', region: 'puglia.it' },
  { code: 'BS', name: 'Brescia', region: 'lombardia.it' },
  { code: 'BT', name: 'Barletta-Andria-Trani', region: 'puglia.it' },
  { code: 'BZ', name: 'Bolzano', region: 'trentino-alto-adige.it' },
  { code: 'CA', name: 'Cagliari', region: 'sardegna.it' },
  { code: 'CB', name: 'Campobasso', region: 'molise.it' },
  { code: 'CE', name: 'Caserta', region: 'campania.it' },
  { code: 'CH', name: 'Chieti', region: 'abruzzo.it' },
  { code: 'CL', name: 'Caltanissetta', region: 'sicilia.it' },
  { code: 'CN', name: 'Cuneo', region: 'piemonte.it' },
  { code: 'CO', name: 'Como', region: 'lombardia.it' },
  { code: 'CR', name: 'Cremona', region: 'lombardia.it' },
  { code: 'CS', name: 'Cosenza', region: 'calabria.it' },
  { code: 'CT', name: 'Catania', region: 'sicilia.it' },
  { code: 'CZ', name: 'Catanzaro', region: 'calabria.it' },
  { code: 'EN', name: 'Enna', region: 'sicilia.it' },
  { code: 'FC', name: 'Forlì-Cesena', region: 'emilia-romagna.it' },
  { code: 'FE', name: 'Ferrara', region: 'emilia-romagna.it' },
  { code: 'FG', name: 'Foggia', region: 'puglia.it' },
  { code: 'FI', name: 'Firenze', region: 'toscana.it' },
  { code: 'FM', name: 'Fermo', region: 'marche.it' },
  { code: 'FR', name: 'Frosinone', region: 'lazio.it' },
  { code: 'GE', name: 'Genova', region: 'liguria.it' },
  { code: 'GO', name: 'Gorizia', region: 'friuli-venezia-giulia.it' },
  { code: 'GR', name: 'Grosseto', region: 'toscana.it' },
  { code: 'IM', name: 'Imperia', region: 'liguria.it' },
  { code: 'IS', name: 'Isernia', region: 'molise.it' },
  { code: 'KR', name: 'Crotone', region: 'calabria.it' },
  { code: 'LC', name: 'Lecco', region: 'lombardia.it' },
  { code: 'LE', name: 'Lecce', region: 'puglia.it' },
  { code: 'LI', name: 'Livorno', region: 'toscana.it' },
  { code: 'LO', name: 'Lodi', region: 'lombardia.it' },
  { code: 'LT', name: 'Latina', region: 'lazio.it' },
  { code: 'LU', name: 'Lucca', region: 'toscana.it' },
  { code: 'MB', name: 'Monza e della Brianza', region: 'lombardia.it' },
  { code: 'MC', name: 'Macerata', region: 'marche.it' },
  { code: 'ME', name: 'Messina', region: 'sicilia.it' },
  { code: 'MI', name: 'Milano', region: 'lombardia.it' },
  { code: 'MN', name: 'Mantova', region: 'lombardia.it' },
  { code: 'MO', name: 'Modena', region: 'emilia-romagna.it' },
  { code: 'MS', name: 'Massa-Carrara', region: 'toscana.it' },
  { code: 'MT', name: 'Matera', region: 'basilicata.it' },
  { code: 'NA', name: 'Napoli', region: 'campania.it' },
  { code: 'NO', name: 'Novara', region: 'piemonte.it' },
  { code: 'NU', name: 'Nuoro', region: 'sardegna.it' },
  { code: 'OR', name: 'Oristano', region: 'sardegna.it' },
  { code: 'PA', name: 'Palermo', region: 'sicilia.it' },
  { code: 'PC', name: 'Piacenza', region: 'emilia-romagna.it' },
  { code: 'PD', name: 'Padova', region: 'veneto.it' },
  { code: 'PE', name: 'Pescara', region: 'abruzzo.it' },
  { code: 'PG', name: 'Perugia', region: 'umbria.it' },
  { code: 'PI', name: 'Pisa', region: 'toscana.it' },
  { code: 'PN', name: 'Pordenone', region: 'friuli-venezia-giulia.it' },
  { code: 'PO', name: 'Prato', region: 'toscana.it' },
  { code: 'PR', name: 'Parma', region: 'emilia-romagna.it' },
  { code: 'PT', name: 'Pistoia', region: 'toscana.it' },
  { code: 'PU', name: 'Pesaro e Urbino', region: 'marche.it' },
  { code: 'PV', name: 'Pavia', region: 'lombardia.it' },
  { code: 'PZ', name: 'Potenza', region: 'basilicata.it' },
  { code: 'RA', name: 'Ravenna', region: 'emilia-romagna.it' },
  { code: 'RC', name: 'Reggio Calabria', region: 'calabria.it' },
  { code: 'RE', name: 'Reggio Emilia', region: 'emilia-romagna.it' },
  { code: 'RG', name: 'Ragusa', region: 'sicilia.it' },
  { code: 'RI', name: 'Rieti', region: 'lazio.it' },
  { code: 'RM', name: 'Roma', region: 'lazio.it' },
  { code: 'RN', name: 'Rimini', region: 'emilia-romagna.it' },
  { code: 'RO', name: 'Rovigo', region: 'veneto.it' },
  { code: 'SA', name: 'Salerno', region: 'campania.it' },
  { code: 'SI', name: 'Siena', region: 'toscana.it' },
  { code: 'SO', name: 'Sondrio', region: 'lombardia.it' },
  { code: 'SP', name: 'La Spezia', region: 'liguria.it' },
  { code: 'SR', name: 'Siracusa', region: 'sicilia.it' },
  { code: 'SS', name: 'Sassari', region: 'sardegna.it' },
  { code: 'SU', name: 'Sud Sardegna', region: 'sardegna.it' },
  { code: 'SV', name: 'Savona', region: 'liguria.it' },
  { code: 'TA', name: 'Taranto', region: 'puglia.it' },
  { code: 'TE', name: 'Teramo', region: 'abruzzo.it' },
  { code: 'TN', name: 'Trento', region: 'trentino-alto-adige.it' },
  { code: 'TO', name: 'Torino', region: 'piemonte.it' },
  { code: 'TP', name: 'Trapani', region: 'sicilia.it' },
  { code: 'TR', name: 'Terni', region: 'umbria.it' },
  { code: 'TS', name: 'Trieste', region: 'friuli-venezia-giulia.it' },
  { code: 'TV', name: 'Treviso', region: 'veneto.it' },
  { code: 'UD', name: 'Udine', region: 'friuli-venezia-giulia.it' },
  { code: 'VA', name: 'Varese', region: 'lombardia.it' },
  { code: 'VB', name: 'Verbano-Cusio-Ossola', region: 'piemonte.it' },
  { code: 'VC', name: 'Vercelli', region: 'piemonte.it' },
  { code: 'VE', name: 'Venezia', region: 'veneto.it' },
  { code: 'VI', name: 'Vicenza', region: 'veneto.it' },
  { code: 'VR', name: 'Verona', region: 'veneto.it' },
  { code: 'VT', name: 'Viterbo', region: 'lazio.it' },
  { code: 'VV', name: 'Vibo Valentia', region: 'calabria.it' }
];
