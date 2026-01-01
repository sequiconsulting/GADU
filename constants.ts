
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
// MARK & CHAPTER BRANCHES:
//   - Irlandese: DEGREES_MARK_IRLANDESE, DEGREES_CHAPTER_IRLANDESE (default)
//   - Aldersgate: DEGREES_MARK_ALDERSGATE, DEGREES_CHAPTER_ALDERSGATE
//
// RAM BRANCH:
//   - No ritual variants: DEGREES_RAM (fixed, 2 gradi)
//
// USAGE:
//   - For UI: Use getDegreesByRitual(branch, ritual) to get degrees for current ritual year
//   - For lookups: Use getDegreeAbbreviation(degreeName) - searches all variants
//   - Legacy code: Use DEGREES[branch] - maps to default rituals per branch
// ============================================================

// Status change reasons per branch and type
export const STATUS_REASONS = {
  ACTIVATION: {
    CRAFT: ['Iniziazione', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero'],
    MARK: ['Avanzamento', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero'],
    CHAPTER: ['Esaltazione', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero'],
    RAM: ['Elevazione', 'Riammissione', 'Regolarizzazione', 'Trasferimento Italia', 'Trasferimento Estero']
  },
  DEACTIVATION: {
    CRAFT: ['Dimissioni', 'Oriente Eterno', 'Depennamento', 'Trasferimento Italia', 'Trasferimento Estero'],
    MARK: ['Dimissioni', 'Oriente Eterno', 'Depennamento', 'Trasferimento Italia', 'Trasferimento Estero'],
    CHAPTER: ['Dimissioni', 'Oriente Eterno', 'Depennamento', 'Trasferimento Italia', 'Trasferimento Estero'],
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

// Irlandese (Irish) variant for Chapter - DEFAULT
export const DEGREES_CHAPTER_IRLANDESE = [
  { name: "Compagno dell'Arco Reale", abbreviation: 'CAR' },
  { name: "Principale dell'Arco Reale", abbreviation: 'PAR' },
];

// Aldersgate variant for Chapter
export const DEGREES_CHAPTER_ALDERSGATE = [
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
    type: 'CHAPTER',
    label: 'Capitolo (Arco Reale)',
    shortLabel: 'Arco',
    color: 'bg-masonic-red',
    degreeLabels: DEGREES_CHAPTER_IRLANDESE.map(d => d.name)
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

// CAPITOLO IRLANDESE - Default
export const CAPITOLO_IRLANDESE_ROLES = [
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

// CAPITOLO ALDERSGATE
export const CAPITOLO_ALDERSGATE_ROLES = [
  'Primo Principale',
  'Secondo Principale',
  'Terzo Principale',
  'Scrivano del Capitolo',
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
  if (branch === 'CHAPTER') {
    return ritual === 'Aldersgate' ? DEGREES_CHAPTER_ALDERSGATE : DEGREES_CHAPTER_IRLANDESE;
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
  if (branch === 'CHAPTER') {
    return ritual === 'Aldersgate' ? CAPITOLO_ALDERSGATE_ROLES : CAPITOLO_IRLANDESE_ROLES;
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
    // If no status events, consider active if they have any degree
    return branchData.degrees && branchData.degrees.length > 0;
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
      DEGREES_CHAPTER_IRLANDESE,
      DEGREES_CHAPTER_ALDERSGATE,
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

export const ITALIAN_PROVINCES = [
  { code: 'AG', name: 'Agrigento', region: 'Sicilia' },
  { code: 'AL', name: 'Alessandria', region: 'Piemonte' },
  { code: 'AN', name: 'Ancona', region: 'Marche' },
  { code: 'AO', name: 'Aosta', region: 'Valle d\'Aosta' },
  { code: 'AP', name: 'Ascoli Piceno', region: 'Marche' },
  { code: 'AQ', name: 'L\'Aquila', region: 'Abruzzo' },
  { code: 'AR', name: 'Arezzo', region: 'Toscana' },
  { code: 'AT', name: 'Asti', region: 'Piemonte' },
  { code: 'AV', name: 'Avellino', region: 'Campania' },
  { code: 'BA', name: 'Bari', region: 'Puglia' },
  { code: 'BG', name: 'Bergamo', region: 'Lombardia' },
  { code: 'BI', name: 'Biella', region: 'Piemonte' },
  { code: 'BL', name: 'Belluno', region: 'Veneto' },
  { code: 'BN', name: 'Benevento', region: 'Campania' },
  { code: 'BO', name: 'Bologna', region: 'Emilia-Romagna' },
  { code: 'BR', name: 'Brindisi', region: 'Puglia' },
  { code: 'BS', name: 'Brescia', region: 'Lombardia' },
  { code: 'BT', name: 'Barletta-Andria-Trani', region: 'Puglia' },
  { code: 'BZ', name: 'Bolzano', region: 'Trentino-Alto Adige' },
  { code: 'CA', name: 'Cagliari', region: 'Sardegna' },
  { code: 'CB', name: 'Campobasso', region: 'Molise' },
  { code: 'CE', name: 'Caserta', region: 'Campania' },
  { code: 'CH', name: 'Chieti', region: 'Abruzzo' },
  { code: 'CL', name: 'Caltanissetta', region: 'Sicilia' },
  { code: 'CN', name: 'Cuneo', region: 'Piemonte' },
  { code: 'CO', name: 'Como', region: 'Lombardia' },
  { code: 'CR', name: 'Cremona', region: 'Lombardia' },
  { code: 'CS', name: 'Cosenza', region: 'Calabria' },
  { code: 'CT', name: 'Catania', region: 'Sicilia' },
  { code: 'CZ', name: 'Catanzaro', region: 'Calabria' },
  { code: 'EN', name: 'Enna', region: 'Sicilia' },
  { code: 'FC', name: 'Forlì-Cesena', region: 'Emilia-Romagna' },
  { code: 'FE', name: 'Ferrara', region: 'Emilia-Romagna' },
  { code: 'FG', name: 'Foggia', region: 'Puglia' },
  { code: 'FI', name: 'Firenze', region: 'Toscana' },
  { code: 'FM', name: 'Fermo', region: 'Marche' },
  { code: 'FR', name: 'Frosinone', region: 'Lazio' },
  { code: 'GE', name: 'Genova', region: 'Liguria' },
  { code: 'GO', name: 'Gorizia', region: 'Friuli-Venezia Giulia' },
  { code: 'GR', name: 'Grosseto', region: 'Toscana' },
  { code: 'IM', name: 'Imperia', region: 'Liguria' },
  { code: 'IS', name: 'Isernia', region: 'Molise' },
  { code: 'KR', name: 'Crotone', region: 'Calabria' },
  { code: 'LC', name: 'Lecco', region: 'Lombardia' },
  { code: 'LE', name: 'Lecce', region: 'Puglia' },
  { code: 'LI', name: 'Livorno', region: 'Toscana' },
  { code: 'LO', name: 'Lodi', region: 'Lombardia' },
  { code: 'LT', name: 'Latina', region: 'Lazio' },
  { code: 'LU', name: 'Lucca', region: 'Toscana' },
  { code: 'MB', name: 'Monza e della Brianza', region: 'Lombardia' },
  { code: 'MC', name: 'Macerata', region: 'Marche' },
  { code: 'ME', name: 'Messina', region: 'Sicilia' },
  { code: 'MI', name: 'Milano', region: 'Lombardia' },
  { code: 'MN', name: 'Mantova', region: 'Lombardia' },
  { code: 'MO', name: 'Modena', region: 'Emilia-Romagna' },
  { code: 'MS', name: 'Massa-Carrara', region: 'Toscana' },
  { code: 'MT', name: 'Matera', region: 'Basilicata' },
  { code: 'NA', name: 'Napoli', region: 'Campania' },
  { code: 'NO', name: 'Novara', region: 'Piemonte' },
  { code: 'NU', name: 'Nuoro', region: 'Sardegna' },
  { code: 'OR', name: 'Oristano', region: 'Sardegna' },
  { code: 'PA', name: 'Palermo', region: 'Sicilia' },
  { code: 'PC', name: 'Piacenza', region: 'Emilia-Romagna' },
  { code: 'PD', name: 'Padova', region: 'Veneto' },
  { code: 'PE', name: 'Pescara', region: 'Abruzzo' },
  { code: 'PG', name: 'Perugia', region: 'Umbria' },
  { code: 'PI', name: 'Pisa', region: 'Toscana' },
  { code: 'PN', name: 'Pordenone', region: 'Friuli-Venezia Giulia' },
  { code: 'PO', name: 'Prato', region: 'Toscana' },
  { code: 'PR', name: 'Parma', region: 'Emilia-Romagna' },
  { code: 'PT', name: 'Pistoia', region: 'Toscana' },
  { code: 'PU', name: 'Pesaro e Urbino', region: 'Marche' },
  { code: 'PV', name: 'Pavia', region: 'Lombardia' },
  { code: 'PZ', name: 'Potenza', region: 'Basilicata' },
  { code: 'RA', name: 'Ravenna', region: 'Emilia-Romagna' },
  { code: 'RC', name: 'Reggio Calabria', region: 'Calabria' },
  { code: 'RE', name: 'Reggio Emilia', region: 'Emilia-Romagna' },
  { code: 'RG', name: 'Ragusa', region: 'Sicilia' },
  { code: 'RI', name: 'Rieti', region: 'Lazio' },
  { code: 'RM', name: 'Roma', region: 'Lazio' },
  { code: 'RN', name: 'Rimini', region: 'Emilia-Romagna' },
  { code: 'RO', name: 'Rovigo', region: 'Veneto' },
  { code: 'SA', name: 'Salerno', region: 'Campania' },
  { code: 'SI', name: 'Siena', region: 'Toscana' },
  { code: 'SO', name: 'Sondrio', region: 'Lombardia' },
  { code: 'SP', name: 'La Spezia', region: 'Liguria' },
  { code: 'SR', name: 'Siracusa', region: 'Sicilia' },
  { code: 'SS', name: 'Sassari', region: 'Sardegna' },
  { code: 'SU', name: 'Sud Sardegna', region: 'Sardegna' },
  { code: 'SV', name: 'Savona', region: 'Liguria' },
  { code: 'TA', name: 'Taranto', region: 'Puglia' },
  { code: 'TE', name: 'Teramo', region: 'Abruzzo' },
  { code: 'TN', name: 'Trento', region: 'Trentino-Alto Adige' },
  { code: 'TO', name: 'Torino', region: 'Piemonte' },
  { code: 'TP', name: 'Trapani', region: 'Sicilia' },
  { code: 'TR', name: 'Terni', region: 'Umbria' },
  { code: 'TS', name: 'Trieste', region: 'Friuli-Venezia Giulia' },
  { code: 'TV', name: 'Treviso', region: 'Veneto' },
  { code: 'UD', name: 'Udine', region: 'Friuli-Venezia Giulia' },
  { code: 'VA', name: 'Varese', region: 'Lombardia' },
  { code: 'VB', name: 'Verbano-Cusio-Ossola', region: 'Piemonte' },
  { code: 'VC', name: 'Vercelli', region: 'Piemonte' },
  { code: 'VE', name: 'Venezia', region: 'Veneto' },
  { code: 'VI', name: 'Vicenza', region: 'Veneto' },
  { code: 'VR', name: 'Verona', region: 'Veneto' },
  { code: 'VT', name: 'Viterbo', region: 'Lazio' },
  { code: 'VV', name: 'Vibo Valentia', region: 'Calabria' }
];
