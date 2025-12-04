
import { BranchType, MasonicBranchData } from "./types";

export const BRANCHES: { type: BranchType; label: string; shortLabel: string; color: string; degreeLabels: string[] }[] = [
  { 
    type: 'CRAFT', 
    label: 'Loggia (Craft)', 
    shortLabel: 'Craft',
    color: 'bg-masonic-blue', 
    degreeLabels: ['Apprendista', 'Compagno di Mestiere', 'Maestro Muratore', 'Maestro Installato'] 
  },
  { 
    type: 'MARK', 
    label: 'Loggia del Marchio', 
    shortLabel: 'MMM',
    color: 'bg-masonic-mark', 
    degreeLabels: ['Uomo del Marchio', 'Maestro del Marchio', 'Venerabile della Loggia del Marchio'] 
  },
  { 
    type: 'CHAPTER', 
    label: 'Capitolo (Arco Reale)', 
    shortLabel: 'Arco',
    color: 'bg-masonic-red', 
    degreeLabels: ['Compagno dell\'Arco Reale', 'Principale dell\'Arco Reale'] 
  },
  { 
    type: 'RAM', 
    label: 'Royal Ark Mariner', 
    shortLabel: 'RAM',
    color: 'bg-masonic-ram', 
    degreeLabels: ['Marinaio dell\'Arca Reale'] 
  }
];

export const COMMON_ROLES: Record<BranchType, string[]> = {
  CRAFT: [
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
  ],
  MARK: [
    'Maestro Venerabile', 
    'Primo Sorvegliante', 
    'Secondo Sorvegliante', 
    'Maestro Sovrintendente', 
    'Primo Sovrintendente', 
    'Secondo Sovrintendente', 
    'Reggente', 
    'Segretario', 
    'Tesoriere', 
    'Direttore delle Cerimonie',
    'Copritore'
  ],
  CHAPTER: [
    'Il Re', 
    'Il Sommo Sacerdote', 
    'Lo Scriba Capo', 
    'Tesoriere', 
    'Registrar', 
    'Capitano dell\'Ostia', 
    'Soprintendente del Tabernacolo', 
    'Capitano del Velo Scarlatto',
    'Capitano del Velo Porpora',
    'Capitano del Velo Blu',
    'Janitor'
  ],
  RAM: [
    'Comandante Noachita', 
    'Primo Generale', 
    'Secondo Generale', 
    'Scriba', 
    'Tesoriere', 
    'Direttore delle Cerimonie', 
    'Guardiano'
  ]
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
export const isMemberActiveInYear = (branchData: MasonicBranchData, year: number): boolean => {
  if (!branchData.statusEvents || branchData.statusEvents.length === 0) {
    // If no events but has degrees, assume active (backward compatibility or default)
    // If no degrees, assume inactive (never joined)
    return branchData.degrees && branchData.degrees.length > 0;
  }

  const targetDate = `${year}-12-31`;
  
  // Sort events by date ascending
  const sortedEvents = [...branchData.statusEvents].sort((a, b) => a.date.localeCompare(b.date));
  
  // Find the last event that happened on or before the end of the target year
  const lastEvent = sortedEvents.filter(e => e.date <= targetDate).pop();
  
  if (!lastEvent) {
    // If no event before target date, but events exist later?
    // It means they hadn't joined yet.
    return false;
  }

  return lastEvent.status === 'ACTIVE';
};

export const getDegreeAbbreviation = (degreeName: string): string => {
  switch (degreeName) {
    // Craft
    case 'Apprendista': return 'AA';
    case 'Compagno di Mestiere': return 'CdM';
    case 'Maestro Muratore': return 'MM';
    case 'Maestro Installato': return 'MI';
    
    // Mark
    case 'Uomo del Marchio': return 'UdM';
    case 'Maestro del Marchio': return 'MdM';
    case 'Venerabile della Loggia del Marchio': return 'VLM';
    
    // Chapter
    case 'Compagno dell\'Arco Reale': return 'CAR';
    case 'Principale dell\'Arco Reale': return 'PAR';
    
    // RAM
    case 'Marinaio dell\'Arca Reale': return 'MAR';
    
    default: return degreeName;
  }
};
