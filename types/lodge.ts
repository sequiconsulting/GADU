export interface PublicLodgeConfig {
  glriNumber: string;        // "105"
  lodgeName: string;         // "I Lapicidi"
  province: string;          // "AN"
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface LodgeConfig extends PublicLodgeConfig {
  supabaseServiceKey: string;  // Backend only!
  createdAt: Date;
  lastAccess: Date;
  isActive: boolean;
  adminEmail?: string;
}

export interface Registry {
  [glriNumber: string]: LodgeConfig;
}
