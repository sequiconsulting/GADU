export interface PublicLodgeConfig {
  glriNumber: string;        // "9999"
  lodgeName: string;         // "Loggia Demo"
  province: string;          // "MI"
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey?: string;  // Only for demo mode!
}

export interface LodgeConfig extends PublicLodgeConfig {
  supabaseServiceKey: string;  // Backend only - for Admin API user creation (JWT token)
  databasePassword: string;     // Postgres database password for direct connections
  createdAt: Date;
  lastAccess: Date;
  isActive: boolean;
  adminEmail?: string;
  associationName?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  taxCode?: string;
}

export interface Registry {
  [glriNumber: string]: LodgeConfig;
}
