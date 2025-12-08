
import { BranchType, MasonicBranchData } from "./types";

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
  { code: 'AG', name: 'Agrigento' },
  { code: 'AL', name: 'Alessandria' },
  { code: 'AN', name: 'Ancona' },
  { code: 'AO', name: 'Aosta' },
  { code: 'AP', name: 'Ascoli Piceno' },
  { code: 'AQ', name: 'L\'Aquila' },
  { code: 'AR', name: 'Arezzo' },
  { code: 'AT', name: 'Asti' },
  { code: 'AV', name: 'Avellino' },
  { code: 'BA', name: 'Bari' },
  { code: 'BG', name: 'Bergamo' },
  { code: 'BI', name: 'Biella' },
  { code: 'BL', name: 'Belluno' },
  { code: 'BN', name: 'Benevento' },
  { code: 'BO', name: 'Bologna' },
  { code: 'BR', name: 'Brindisi' },
  { code: 'BS', name: 'Brescia' },
  { code: 'BT', name: 'Barletta-Andria-Trani' },
  { code: 'BZ', name: 'Bolzano' },
  { code: 'CA', name: 'Cagliari' },
  { code: 'CB', name: 'Campobasso' },
  { code: 'CE', name: 'Caserta' },
  { code: 'CH', name: 'Chieti' },
  { code: 'CL', name: 'Caltanissetta' },
  { code: 'CN', name: 'Cuneo' },
  { code: 'CO', name: 'Como' },
  { code: 'CR', name: 'Cremona' },
  { code: 'CS', name: 'Cosenza' },
  { code: 'CT', name: 'Catania' },
  { code: 'CZ', name: 'Catanzaro' },
  { code: 'EN', name: 'Enna' },
  { code: 'FC', name: 'Forlì-Cesena' },
  { code: 'FE', name: 'Ferrara' },
  { code: 'FG', name: 'Foggia' },
  { code: 'FI', name: 'Firenze' },
  { code: 'FM', name: 'Fermo' },
  { code: 'FR', name: 'Frosinone' },
  { code: 'GE', name: 'Genova' },
  { code: 'GO', name: 'Gorizia' },
  { code: 'GR', name: 'Grosseto' },
  { code: 'IM', name: 'Imperia' },
  { code: 'IS', name: 'Isernia' },
  { code: 'KR', name: 'Crotone' },
  { code: 'LC', name: 'Lecco' },
  { code: 'LE', name: 'Lecce' },
  { code: 'LI', name: 'Livorno' },
  { code: 'LO', name: 'Lodi' },
  { code: 'LT', name: 'Latina' },
  { code: 'LU', name: 'Lucca' },
  { code: 'MB', name: 'Monza e della Brianza' },
  { code: 'MC', name: 'Macerata' },
  { code: 'ME', name: 'Messina' },
  { code: 'MI', name: 'Milano' },
  { code: 'MN', name: 'Mantova' },
  { code: 'MO', name: 'Modena' },
  { code: 'MS', name: 'Massa-Carrara' },
  { code: 'MT', name: 'Matera' },
  { code: 'NA', name: 'Napoli' },
  { code: 'NO', name: 'Novara' },
  { code: 'NU', name: 'Nuoro' },
  { code: 'OR', name: 'Oristano' },
  { code: 'PA', name: 'Palermo' },
  { code: 'PC', name: 'Piacenza' },
  { code: 'PD', name: 'Padova' },
  { code: 'PE', name: 'Pescara' },
  { code: 'PG', name: 'Perugia' },
  { code: 'PI', name: 'Pisa' },
  { code: 'PN', name: 'Pordenone' },
  { code: 'PO', name: 'Prato' },
  { code: 'PR', name: 'Parma' },
  { code: 'PT', name: 'Pistoia' },
  { code: 'PU', name: 'Pesaro e Urbino' },
  { code: 'PV', name: 'Pavia' },
  { code: 'PZ', name: 'Potenza' },
  { code: 'RA', name: 'Ravenna' },
  { code: 'RC', name: 'Reggio Calabria' },
  { code: 'RE', name: 'Reggio Emilia' },
  { code: 'RG', name: 'Ragusa' },
  { code: 'RI', name: 'Rieti' },
  { code: 'RM', name: 'Roma' },
  { code: 'RN', name: 'Rimini' },
  { code: 'RO', name: 'Rovigo' },
  { code: 'SA', name: 'Salerno' },
  { code: 'SI', name: 'Siena' },
  { code: 'SO', name: 'Sondrio' },
  { code: 'SP', name: 'La Spezia' },
  { code: 'SR', name: 'Siracusa' },
  { code: 'SS', name: 'Sassari' },
  { code: 'SU', name: 'Sud Sardegna' },
  { code: 'SV', name: 'Savona' },
  { code: 'TA', name: 'Taranto' },
  { code: 'TE', name: 'Teramo' },
  { code: 'TN', name: 'Trento' },
  { code: 'TO', name: 'Torino' },
  { code: 'TP', name: 'Trapani' },
  { code: 'TR', name: 'Terni' },
  { code: 'TS', name: 'Trieste' },
  { code: 'TV', name: 'Treviso' },
  { code: 'UD', name: 'Udine' },
  { code: 'VA', name: 'Varese' },
  { code: 'VB', name: 'Verbano-Cusio-Ossola' },
  { code: 'VC', name: 'Vercelli' },
  { code: 'VE', name: 'Venezia' },
  { code: 'VI', name: 'Vicenza' },
  { code: 'VR', name: 'Verona' },
  { code: 'VT', name: 'Viterbo' },
  { code: 'VV', name: 'Vibo Valentia' }
];
