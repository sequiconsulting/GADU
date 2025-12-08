
export type BranchType = 'CRAFT' | 'MARK' | 'CHAPTER' | 'RAM';
export type StatusType = 'ACTIVE' | 'INACTIVE';

// Auth0 User Roles
export type UserRole = 
  | 'admin_global' 
  | 'admin_craft' 
  | 'admin_mark_arch' 
  | 'admin_ram';

export interface Auth0User {
  sub: string; // Auth0 unique ID
  email: string;
  name?: string;
  picture?: string;
  'https://gadu.com/roles'?: UserRole[]; // Custom claim with user roles
}

export interface DegreeEvent {
  timestamp: string; // ISO 8601 UTC timestamp
  description: string;
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
  
  // Provenance Data (Specific for Side Degrees)
  isMotherLodgeMember?: boolean; // True if they belong to the main Craft Lodge associated with this app
  otherLodgeName?: string;       // Name of the other lodge if not Mother Lodge
  isFounder?: boolean;           // Is a founding member of this specific body
  isDualMember?: boolean;        // Only applicable if !isMotherLodgeMember
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

export interface AppSettings {
  lodgeName: string;
  lodgeNumber: string;
  province: string;
  dbVersion: number; // Database schema version for migrations
  preferences: {
    craft: 'Emulation' | 'Giustinianeo';
    markAndArch: 'Irlandese' | 'Aldersgate';
    ram: 'Irlandese' | 'Aldersgate';
  };
  // Ritual preferences per year (Masonic year start, e.g., 2025 for 2025-2026)
  yearlyRituals?: Record<number, {
    craft: 'Emulation' | 'Scozzese';
    markAndArch: 'Irlandese' | 'Aldersgate';
  }>;
}

export interface DashboardStats {
  totalMembers: number;
  craftMembers: number;
  markMembers: number;
  chapterMembers: number;
  ramMembers: number;
}
