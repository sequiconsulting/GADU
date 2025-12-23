
export type BranchType = 'CRAFT' | 'MARK' | 'CHAPTER' | 'RAM';
export type StatusType = 'ACTIVE' | 'INACTIVE';

// Netlify Authentication & Authorization
export type UserPrivilege = 'AD' | 'CR' | 'MR' | 'AR' | 'RR' | 'CW' | 'MW' | 'AW' | 'RW';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  privileges: UserPrivilege[];
  createdAt: string;
  updatedAt: string;
}

export interface NetlifyIdentityUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed: boolean;
  app_metadata: {
    provider: string;
    roles?: string[];
  };
  user_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  token?: {
    access_token: string;
    expires_at: number;
    refresh_token?: string;
    token_type: string;
  };
}

export interface DegreeEvent {
  degreeName: string;
  date: string; // ISO string YYYY-MM-DD
  meetingNumber: string;
  location?: string;
}

export interface OfficerRole {
  id: string;
  yearStart: number; // e.g., 2025 (implies 2025-2026)
  roleName: string;
  branch: BranchType;
  startDate?: string; // ISO YYYY-MM-DD for mid-year start
  endDate?: string;   // ISO YYYY-MM-DD for mid-year end
  installationMeeting?: string; // Number of the meeting where installed
}

export type CapitazioneTipo = 'Ordinaria' | 'Ridotta Settembre' | 'Doppia Appartenenza' | 'Ridotta Studenti' | 'Ridotta Ministri di Culto' | 'Onorario';

export interface CapitazioneEvent {
  year: number; // Masonic year start (e.g., 2025 for 2025-2026)
  tipo: CapitazioneTipo;
}

export type TitoloCraftMarchio = 'Fr.' | 'Ven. Fr.' | 'Ven.mo Fr.';
export type TitoloArcoRam = 'Comp.' | 'Ecc. Comp.' | 'Ecc.mo Comp.';

export interface TitoloEvent {
  year: number; // Masonic year start
  titolo: TitoloCraftMarchio | TitoloArcoRam;
}

export interface StatusEvent {
  date: string; // YYYY-MM-DD
  status: StatusType;
  reason?: string; // Reason for activation/deactivation (e.g., 'Iniziazione', 'Dimissioni')
  note?: string;
  lodge?: string; // Lodge name for transfers (Trasferimento Italia/Estero)
}

export interface MasonicBranchData {
  // isActive is replaced by statusEvents calculation
  statusEvents: StatusEvent[];
  
  // Capitazione per year (track membership fee type)
  capitazioni?: CapitazioneEvent[];
  
  // Titolo per year
  titoli?: TitoloEvent[];
  
  // Provenance Data (Specific for Side Degrees)
  isMotherLodgeMember?: boolean; // True if they belong to the main Craft Lodge associated with this app
  otherLodgeName?: string;       // Name of the other lodge if not Mother Lodge
  isFounder?: boolean;           // Is a founding member of this specific body
  isHonorary?: boolean;          // Is an honorary member
  isDualAppartenance?: boolean;  // Has dual membership in this body
  
  initiationDate?: string; // Or Advancement/Exaltation/Elevation
  degrees: DegreeEvent[];
  roles: OfficerRole[];
}

export interface Member {
  id: string;
  matricula: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  
  // Branch specific data
  craft: MasonicBranchData;
  mark: MasonicBranchData;
  chapter: MasonicBranchData;
  ram: MasonicBranchData;
  
  // Changelog
  changelog?: ChangeLogEntry[];
}

export interface ChangeLogEntry {
  timestamp: string;
  action: string;
  user?: string;
  details?: Record<string, any>;
}

export interface UserChangeLogEntry {
  timestamp: string;
  action: string; // 'CREATE', 'UPDATE', 'DELETE', 'PRIVILEGE_CHANGE'
  userEmail?: string; // User being modified
  performedBy?: string; // Email of admin who made the change
  details?: string; // Description of what changed
}

export interface Convocazione {
  id: string;
  branchType: BranchType;
  yearStart: number; // Masonic year start (e.g., 2025 for 2025-2026)
  numeroConvocazione: number; // Auto-incremented per branch/year
  dataConvocazione: string; // ISO YYYY-MM-DD
  dataOraApertura: string; // ISO YYYY-MM-DDTHH:mm
  luogo: string; // Meeting location
  ordineDelGiorno: string;
  note: string; // Additional notes
  formatoGrafico: 'standard' | 'alternativo';
  bloccata: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchPreferences {
  città?: string;
  indirizzo?: string;
  motto?: string;
  logoObbedienzaUrl?: string;
  logoRegionaleUrl?: string;
  logoLoggiaUrl?: string;
  defaultQuote?: {
    quotaGLGC: Record<CapitazioneTipo, number>;
    quotaRegionale: Record<CapitazioneTipo, number>;
    quotaLoggia: Record<CapitazioneTipo, number>;
    quotaCerimonia: Record<CapitazioneTipo, number>;
  };
}

export interface AppSettings {
  lodgeName: string;
  lodgeNumber: string;
  province: string;
  dbVersion: number; // Database schema version for migrations
  // Ritual preferences per year (Masonic year start, e.g., 2025 for 2025-2026)
  yearlyRituals?: Record<number, {
    craft: 'Emulation' | 'Scozzese';
    markAndArch: 'Irlandese' | 'Aldersgate';
  }>;
  // User management (list of users with privileges)
  users?: AppUser[];
  // User modification changelog (max 100 entries, oldest are overwritten)
  userChangelog?: UserChangeLogEntry[];
  // Branch preferences (casa massonica, motto, logos)
  branchPreferences?: Record<'CRAFT' | 'MARK' | 'CHAPTER' | 'RAM', BranchPreferences>;
}

export interface DashboardStats {
  totalMembers: number;
  craftMembers: number;
  markMembers: number;
  chapterMembers: number;
  ramMembers: number;
}
