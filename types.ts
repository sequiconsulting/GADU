
export type BranchType = 'CRAFT' | 'MARK' | 'ARCH' | 'RAM';
export type StatusType = 'ACTIVE' | 'INACTIVE';

// Supabase Authentication & Authorization (prepared, disabled by default)
export type UserPrivilege = 'AD' | 'CR' | 'MR' | 'AR' | 'RR' | 'CW' | 'MW' | 'AW' | 'RW';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  privileges: UserPrivilege[];
  createdAt: string;
  updatedAt: string;
}

// Minimal Supabase user shape we rely on (matches supabase-js user fields we read)
export interface SupabaseAuthUser {
  id: string;
  aud?: string;
  role?: string;
  email?: string;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: {
    provider?: string;
    roles?: string[];
    gadu_schema_version?: number;
  };
  user_metadata?: Record<string, any> & {
    gadu_schema_version?: number;
    name?: string;
    privileges?: UserPrivilege[];
    mustChangePassword?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

export interface DegreeEvent {
  degreeName: string;
  date?: string; // ISO string YYYY-MM-DD
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

export type CapitazioneTipo = 'Ordinaria' | 'Ridotta Settembre' | 'Studenti' | 'Over 80' | 'Stranieri Residenti Italia' | 'Italiani Residenti Estero' | 'Stranieri Residenti Estero' | 'Doppia Appartenenza' | 'Loggia di Ricerca';

export interface CapitazioneEvent {
  year: number; // Masonic year start (e.g., 2025 for 2025-2026)
  tipo: CapitazioneTipo;
  // Importo effettivamente pagato (in €) per quell'anno/ramo
  pagato?: number;
}

export interface CapitazioneQuote {
  year: number; // Masonic year start
  branch: BranchType;
  quota_gl: number; // Quota per Grande Loggia
  quota_regionale: number;
  quota_loggia: number;
}

export interface CapitazioneRecord {
  member_id: string;
  year: number;
  branch: BranchType;
  tipo: CapitazioneTipo;
  pagato: number;
}

export type TitoloCraftMarchio = 'Fr.' | 'Ven. Fr.' | 'Ven.mo Fr.' | 'MVM Fr.';
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
  arch: MasonicBranchData;
  ram: MasonicBranchData;
  
  // Changelog
  // Timestamp ISO aggiornato ad ogni salvataggio (usato per rilevare conflitti)
  lastModified?: string;
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

export type FiscalEntryType = 'ENTRATA' | 'USCITA';
export type FiscalSection = 'A' | 'B' | 'C' | 'D' | 'E';

export interface FiscalCategory {
  id: string;
  label: string;
  section: FiscalSection;
  type: FiscalEntryType;
}

export interface FiscalEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  description: string;
  amount: number;
  type: FiscalEntryType;
  section: FiscalSection;
  categoryId?: string;
  categoryLabel: string;
  notes?: string;
}

export interface FiscalAccount {
  id: string;
  name: string;
  initialBalance: number;
  entries: FiscalEntry[];
}

export interface FiscalCash {
  initialBalance: number;
  entries: FiscalEntry[];
}

export interface RendicontoFiscale {
  year: number;
  accounts: FiscalAccount[];
  cash: FiscalCash;
  notes?: {
    secondarietaAttivitaDiverse?: string;
    costiProventiFigurativi?: string;
  };
  signatureName?: string;
  updatedAt?: string;
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
  associationName?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  taxCode?: string;
  // Ritual preferences per year (Masonic year start, e.g., 2025 for 2025-2026)
  yearlyRituals?: Record<number, {
    craft: 'Emulation' | 'Scozzese';
    markAndArch: 'Irlandese' | 'Aldersgate';
  }>;
  // User modification changelog (max 100 entries, oldest are overwritten)
  // Note: Users are now stored in Supabase Auth user_metadata, not here
  userChangelog?: UserChangeLogEntry[];
  // Branch preferences (casa massonica, motto, logos)
  branchPreferences?: Record<'CRAFT' | 'MARK' | 'ARCH' | 'RAM', BranchPreferences>;
}

export interface DashboardStats {
  totalMembers: number;
  craftMembers: number;
  markMembers: number;
  archMembers: number;
  ramMembers: number;
}
