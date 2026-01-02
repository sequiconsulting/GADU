
import { type SupabaseClient } from '@supabase/supabase-js';
import { Member, AppSettings, BranchType, Convocazione } from '../types';
import { PublicLodgeConfig } from '../types/lodge';
import { faker } from '@faker-js/faker/locale/it';
import { INITIATION_TERMS } from '../constants';
import { getCachedSupabaseClient } from '../utils/supabaseClientCache';

type MemberRow = { id: string; data: Member };
type SettingsRow = { id: string; data: AppSettings; db_version: number; schema_version: number };
type ConvocazioneRow = { id: string; branch_type: BranchType; year_start: number; data: Convocazione };

class DataService {
  public APP_VERSION = '0.167';
  public DB_VERSION = 12;
  public SUPABASE_SCHEMA_VERSION = 2;

  private supabase: SupabaseClient | null = null;
  private initPromise: Promise<void> | null = null;
  private currentLodgeConfig: PublicLodgeConfig | null = null;

  constructor() {
    // Non auto-inizializzare - aspettare initializeLodge()
  }

  private readEnv(key: string): string | undefined {
    const env = (import.meta as any)?.env || {};
    return env[key];
  }

  public initializeLodge(config: PublicLodgeConfig): void {
    this.currentLodgeConfig = config;
    
    // Use service key if available (demo mode), otherwise use anon key
    const apiKey = config.supabaseServiceKey || config.supabaseAnonKey;
    
    // Usa client cachato per evitare istanze multiple
    this.supabase = getCachedSupabaseClient(config.supabaseUrl, apiKey);
    
    // Re-init promise
    this.initPromise = this.ensureSchemaAndSeed();
  }

  public getCurrentLodgeConfig(): PublicLodgeConfig | null {
    return this.currentLodgeConfig;
  }

  private ensureSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase not initialized. Call initializeLodge() first.');
    }
    return this.supabase;
  }

  private async ensureInitialized(): Promise<void> {
    // Schema check fatto in ensureSchemaAndSeed dopo initializeLodge
    await this.ensureSchemaAndSeed();
  }

  private mapSchemaError(error: any): never {
    const message = error?.message || '';
    if (message.includes('relation') || error?.code === 'PGRST116') {
      throw new Error('Supabase schema is missing. Run supabase-schema.sql in your Supabase SQL editor, then reload the app.');
    }
    throw error;
  }

  /**
   * Apply security policies to all tables
   * - Deny all access to anonymous users
   * - Allow all operations to authenticated users (privileges managed in-app)
   */
  private async applySecurityPolicies(): Promise<void> {
    const client = this.ensureSupabaseClient();
    const tables = ['app_settings', 'members', 'convocazioni'];
    
    console.log('[SECURITY] Applying security policies...');
    
    for (const table of tables) {
      // Note: RLS policies can only be managed with service key
      // This will only work if the client is using service key (demo mode)
      // In production with anon key, policies must be set via Supabase dashboard or migration
      try {
        const { error } = await client.rpc('exec_sql', {
          query: `
            ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "anon_deny_${table}" ON public.${table};
            DROP POLICY IF EXISTS "authenticated_all_${table}" ON public.${table};
            CREATE POLICY "anon_deny_${table}" ON public.${table} FOR ALL USING (auth.role() != 'anon') WITH CHECK (auth.role() != 'anon');
            CREATE POLICY "authenticated_all_${table}" ON public.${table} FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
          `
        });
        
        if (error) {
          console.warn(`[SECURITY] Could not apply policies for ${table}: ${error.message}`);
        }
      } catch (err) {
        console.warn(`[SECURITY] Could not apply policies for ${table}:`, err);
      }
    }
    
    console.log('[SECURITY] Security policies application completed');
  }

  private async ensureSchemaAndSeed(): Promise<void> {
    const client = this.ensureSupabaseClient();

    const { data: settingsRow, error: settingsError } = await client
      .from('app_settings')
      .select('id, data, db_version, schema_version')
      .eq('id', 'app')
      .maybeSingle();

    if (settingsError) {
      this.mapSchemaError(settingsError);
    }

    if (!settingsRow) {
      const defaultSettings: AppSettings = {
        lodgeName: 'Loggia Supabase Demo',
        lodgeNumber: this.currentLodgeConfig?.glriNumber || '9999',
        province: 'MI',
        dbVersion: this.DB_VERSION,
        userChangelog: [],
      };
      await client.from('app_settings').insert({
        id: 'app',
        data: defaultSettings,
        db_version: this.DB_VERSION,
        schema_version: this.SUPABASE_SCHEMA_VERSION,
      });
    } else {
      const updates: Partial<SettingsRow> = {};
      if (settingsRow.db_version !== this.DB_VERSION) updates.db_version = this.DB_VERSION;
      if (settingsRow.schema_version !== this.SUPABASE_SCHEMA_VERSION) updates.schema_version = this.SUPABASE_SCHEMA_VERSION;
      if (Object.keys(updates).length > 0) {
        await client.from('app_settings').update(updates).eq('id', 'app');
        // Applica security policies quando versione schema cambia
        if (updates.schema_version !== undefined) {
          await this.applySecurityPolicies();
        }
      }
    }

    // Auto-seed rimosso - ora si usa il bottone manuale in AdminPanel
  }

  public buildDemoMembers(): Member[] {
    const baseDate = new Date();
    const year = baseDate.getFullYear();
    const today = new Date().toISOString().split('T')[0];

    // Gradi Craft Emulation in ordine
    const craftEmulationDegrees = ['Apprendista Ammesso', 'Compagno di Mestiere', 'Maestro Muratore', 'Maestro Installato'];
    
    // Ruoli Craft Emulation disponibili
    const craftEmulationRoles = [
      'Maestro Venerabile', 'IEM', 'Primo Sorvegliante', 'Secondo Sorvegliante', 
      'Cappellano', 'Tesoriere', 'Segretario', 'Assistente Segretario', 
      'Direttore delle Cerimonie', 'Elemosiniere', 'Elemosiniare Assistente',
      'Organista', 'Porta Stendardo', 'Porta Spada', 'Sovrintendente dei Lavori',
      'Primo Diacono', 'Secondo Diacono', 'Steward Interno', 'Steward Esterno', 'Copritore'
    ];

    const members: Member[] = [];
    const usedNames = new Set<string>();
    const cities = ['Milano', 'Roma', 'Torino', 'Bologna', 'Firenze', 'Genova', 'Napoli', 'Venezia', 'Verona', 'Brescia'];

    for (let i = 1; i <= 100; i++) {
      // Genera nome univoco
      let firstName: string;
      let lastName: string;
      let fullName: string;
      do {
        firstName = faker.person.firstName('male');
        lastName = faker.person.lastName();
        fullName = `${firstName} ${lastName}`;
      } while (usedNames.has(fullName));
      usedNames.add(fullName);

      const matricula = String(100000 + i);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
      const city = cities[i % cities.length];
      const phone = faker.helpers.replaceSymbols('3## ### ####');

      // Branch template per rami inattivi
      const inactiveBranchTemplate = () => ({
        statusEvents: [],
        degrees: [],
        roles: [],
        isMotherLodgeMember: true,
        otherLodgeName: '',
        isFounder: false,
        isHonorary: false,
        isDualAppartenance: false,
        initiationDate: today,
      });

      // CRAFT - tutti attivi con gradi progressivi
      const craft = inactiveBranchTemplate();
      craft.statusEvents = [{ date: today, status: 'ACTIVE', reason: INITIATION_TERMS.CRAFT }];
      
      // Determina grado Craft (distribuiamo in modo realistico)
      let degreeIndex: number;
      if (i <= 10) degreeIndex = 3; // MI
      else if (i <= 30) degreeIndex = 2; // MM
      else if (i <= 60) degreeIndex = 1; // CM
      else degreeIndex = 0; // AA

      // Aggiungi TUTTI i gradi fino al grado finale
      for (let d = 0; d <= degreeIndex; d++) {
        const daysAgo = (degreeIndex - d) * 180; // 6 mesi tra gradi
        const degreeDate = new Date(baseDate);
        degreeDate.setDate(degreeDate.getDate() - daysAgo);
        const dateStr = degreeDate.toISOString().split('T')[0];
        
        craft.degrees.push({
          degreeName: craftEmulationDegrees[d],
          date: dateStr,
          meetingNumber: String(d + 1),
          location: city
        });
      }

      // Assegna ruoli Craft (solo ai primi 20)
      if (i <= craftEmulationRoles.length) {
        craft.roles = [{
          id: `role_${i}_craft`,
          yearStart: year,
          roleName: craftEmulationRoles[i - 1],
          branch: 'CRAFT'
        }];
      }

      // Mark, Chapter, RAM - TUTTI INATTIVI
      const mark = inactiveBranchTemplate();
      const chapter = inactiveBranchTemplate();
      const ram = inactiveBranchTemplate();

      members.push({
        id: `seed-${i}`,
        matricula,
        firstName,
        lastName,
        city,
        email,
        phone,
        craft,
        mark,
        chapter,
        ram,
        changelog: [],
      });
    }
    
    return members;
  }

  public buildDemoConvocazioni(): Convocazione[] {
    const now = new Date();
    const isoAt = (daysFromNow: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysFromNow);
      return d.toISOString();
    };

    const makeConvocazione = (
      branchType: BranchType,
      numeroConvocazione: number,
      daysFromNow: number,
      luogo: string,
      ordineDelGiorno: string,
    ): Convocazione => {
      const stamp = isoAt(daysFromNow);
      const dateOnly = stamp.split('T')[0];
      const dateTime = stamp.slice(0, 16);
      return {
        id: `seed-${branchType.toLowerCase()}-${numeroConvocazione}`,
        branchType,
        yearStart: now.getFullYear(),
        numeroConvocazione,
        dataConvocazione: dateOnly,
        dataOraApertura: dateTime,
        luogo,
        ordineDelGiorno,
        note: '',
        formatoGrafico: 'standard',
        bloccata: true,
        createdAt: stamp,
        updatedAt: stamp,
      };
    };

    return [
      makeConvocazione('CRAFT', 1, 7, 'Milano', 'Lavori rituali e pianificazione lavori di loggia.'),
      makeConvocazione('CRAFT', 2, 35, 'Milano', 'Esaltazione candidati e revisione bilancio.'),
      makeConvocazione('MARK', 1, 14, 'Torino', 'Installazione ufficiali e programmazione grado Mark.'),
      makeConvocazione('CHAPTER', 1, 21, 'Bologna', 'Capitolo ordinario con discussione studi simbolici.'),
      makeConvocazione('RAM', 1, 28, 'Genova', 'Lavori rituali RAM e assegnazione incarichi.'),
    ];
  }

  private async ensureReady() {
    if (!this.initPromise) {
      throw new Error('DataService not initialized. Call initializeLodge() first.');
    }
    await this.initPromise;
  }

  async getMembers(): Promise<Member[]> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    try {
      const { data, error } = await client.from('members').select('id, data');
      if (error) throw new Error(`Failed to load members: ${error.message} (code: ${error.code})`);
      return (data || []).map((row: MemberRow) => ({ ...row.data, id: row.id }));
    } catch (err: any) {
      console.error('[DataService] getMembers error:', err);
      throw err;
    }
  }

  async getMemberById(id: string): Promise<Member | undefined> {
    if (id === 'new') {
      return this.getEmptyMember();
    }
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    try {
      const { data, error } = await client.from('members').select('id, data').eq('id', id).maybeSingle();
      if (error) throw new Error(`Failed to load member ${id}: ${error.message}`);
      return data ? { ...(data as MemberRow).data, id: (data as MemberRow).id } : undefined;
    } catch (err: any) {
      console.error(`[DataService] getMemberById(${id}) error:`, err);
      throw err;
    }
  }

  async saveMember(member: Member): Promise<Member> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    let memberToSave = { ...member };
    if (!memberToSave.id) {
      memberToSave.id = crypto.randomUUID ? crypto.randomUUID() : `member_${Date.now()}`;
    }
    if (memberToSave.changelog && Array.isArray(memberToSave.changelog)) {
      memberToSave.changelog = memberToSave.changelog.slice(-100);
    }
    
    // Add lastModified timestamp for conflict detection
    const lastModified = new Date().toISOString();
    
    // Normalize strings: trim empty strings to null for specific fields
    const normalizeString = (val: string | null | undefined): string | null => {
      if (!val) return null;
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    };
    
    memberToSave.matricula = normalizeString(memberToSave.matricula) || memberToSave.matricula;
    memberToSave.email = normalizeString(memberToSave.email);
    memberToSave.phone = normalizeString(memberToSave.phone);
    
    // Normalize branch data
    (['craft', 'mark', 'chapter', 'ram'] as const).forEach(branchKey => {
      const branchData = memberToSave[branchKey];
      branchData.otherLodgeName = normalizeString(branchData.otherLodgeName);
      
      // Sort statusEvents by date (chronological order)
      branchData.statusEvents = [...branchData.statusEvents].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
    });
    
    // Rimuovi l'id dall'oggetto data per evitare duplicati
    const { id, ...dataWithoutId } = memberToSave;
    const row = { id, data: { ...dataWithoutId, lastModified } };
    
    try {
      const { error } = await client.from('members').upsert(row);
      if (error) throw new Error(`Failed to save member ${memberToSave.id}: ${error.message}`);
      return memberToSave;
    } catch (err: any) {
      console.error(`[DataService] saveMember(${memberToSave.id}) error:`, err);
      throw err;
    }
  }

  async deleteMember(id: string): Promise<void> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    
    // Get member first to find all assigned roles
    const member = await this.getMemberById(id);
    if (!member) {
      throw new Error('Member not found');
    }

    // Clean up any roles this member holds in other members' branches
    const allMembers = await this.getMembers();
    const updatedMembers = allMembers
      .filter(m => m.id !== id) // Exclude current member
      .map(m => {
        let changed = false;
        const updated = { ...m };
        
        // Remove roles held by this member from all branches
        (['craft', 'mark', 'chapter', 'ram'] as const).forEach(branchKey => {
          const branchData = updated[branchKey];
          const filteredRoles = branchData.roles.filter((r: any) => {
            // Keep role if it's not held by this member, or it doesn't exist
            return !m[branchKey].roles.some((role: any) => role.id && role.id.includes(id));
          });
          if (filteredRoles.length < branchData.roles.length) {
            updated[branchKey] = { ...branchData, roles: filteredRoles };
            changed = true;
          }
        });
        
        return changed ? updated : m;
      })
      .filter(m => m);

    // Save clean members
    await Promise.allSettled(updatedMembers.map(m => this.saveMember(m)));
    
    // Delete member
    const { error } = await client.from('members').delete().eq('id', id);
    if (error) throw error;
  }

  async getSettings(): Promise<AppSettings> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const { data, error } = await client.from('app_settings').select('data, db_version, schema_version').eq('id', 'app').maybeSingle();
    if (error) throw error;
    const row = data as SettingsRow | null;
    if (!row) {
      return { lodgeName: '', lodgeNumber: '', province: '', dbVersion: this.DB_VERSION, userChangelog: [] };
    }
    const merged: AppSettings = {
      ...row.data,
      dbVersion: this.DB_VERSION,
      userChangelog: row.data.userChangelog || [],
    };
    return merged;
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const settingsToSave: AppSettings = {
      ...settings,
      dbVersion: this.DB_VERSION,
      userChangelog: (settings.userChangelog || []).slice(-100),
    };

    const { error } = await client.from('app_settings').upsert({
      id: 'app',
      data: settingsToSave,
      db_version: this.DB_VERSION,
      schema_version: this.SUPABASE_SCHEMA_VERSION,
    });
    if (error) throw error;
    return settingsToSave;
  }

  async getConvocazioniForBranch(branch: BranchType): Promise<Convocazione[]> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const { data, error } = await client
      .from('convocazioni')
      .select('id, branch_type, year_start, data')
      .eq('branch_type', branch);
    if (error) throw error;
    const list = (data || []).map((row: ConvocazioneRow) => ({ ...row.data, id: row.id } as Convocazione));
    list.sort((a, b) => (a.numeroConvocazione || 0) - (b.numeroConvocazione || 0));
    return list;
  }

  async getConvocazioni(branch: BranchType, yearStart: number): Promise<Convocazione[]> {
    const all = await this.getConvocazioniForBranch(branch);
    return all.filter(c => c.yearStart === yearStart);
  }

  async saveConvocazione(conv: Convocazione): Promise<Convocazione> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const now = new Date().toISOString();
    let toSave = { ...conv } as Convocazione;
    if (!toSave.id || toSave.id === 'new') {
      toSave.id = crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}`;
      toSave.createdAt = now;
    }
    toSave.updatedAt = now;

    const row: ConvocazioneRow = {
      id: toSave.id,
      branch_type: toSave.branchType,
      year_start: toSave.yearStart,
      data: toSave,
    } as ConvocazioneRow;

    const { error } = await client.from('convocazioni').upsert(row);
    if (error) throw error;
    return toSave;
  }

  async deleteConvocazione(id: string): Promise<void> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const { error } = await client.from('convocazioni').delete().eq('id', id);
    if (error) throw error;
  }

  async toggleConvocazioneLock(id: string, lock?: boolean): Promise<void> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await client.from('convocazioni').select('data').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return;
    const conv = (data as ConvocazioneRow).data as Convocazione;
    const updated = { ...conv, bloccata: lock, updatedAt: now };
    const { error: updateError } = await client.from('convocazioni').update({ data: updated }).eq('id', id);
    if (updateError) throw updateError;
  }

  async getNextConvocazioneNumero(branch: BranchType): Promise<number> {
    const all = await this.getConvocazioniForBranch(branch);
    const max = all.reduce((m, c) => Math.max(m, c.numeroConvocazione || 0), 0);
    return max + 1;
  }

  getEmptyMember(): Member {
    const createBranchData = () => ({
      statusEvents: [],
      degrees: [],
      roles: [],
      isMotherLodgeMember: true,
      otherLodgeName: '',
      isFounder: false,
      isHonorary: false,
      isDualAppartenance: false,
      initiationDate: undefined,
    });

    return {
      id: '',
      matricula: '',
      firstName: '',
      lastName: '',
      city: '',
      email: '',
      phone: '',
      craft: createBranchData(),
      mark: createBranchData(),
      chapter: createBranchData(),
      ram: createBranchData(),
      changelog: [],
    };
  }

  validateAndCleanAllMembers(members: Member[]): { cleaned: Member[]; report: string } {
    const report: string[] = [];
    let totalCleaned = 0;

    const cleaned = members.map(member => {
      const cleaned = { ...member };

      (['craft', 'mark', 'chapter', 'ram'] as const).forEach(branchKey => {
        const branch = cleaned[branchKey];
        if (!branch || !branch.statusEvents) return;

        const originalCount = branch.statusEvents.length;
        const deduped: typeof branch.statusEvents = [];
        branch.statusEvents.forEach(event => {
          const prev = deduped[deduped.length - 1];
          if (!prev || prev.status !== event.status || prev.date !== event.date) {
            deduped.push(event);
          }
        });

        deduped.sort((a, b) => a.date.localeCompare(b.date));

        if (deduped.length !== originalCount) {
          report.push(`${member.lastName} ${member.firstName} - ${branchKey}: Rimossi ${originalCount - deduped.length} eventi duplicati`);
          totalCleaned += originalCount - deduped.length;
        }

        branch.statusEvents = deduped;
      });

      return cleaned;
    });

    report.push(`\n=== TOTALE ===\nEventi duplicati rimossi: ${totalCleaned}`);
    return { cleaned, report: report.join('\n') };
  }

  exportToExcel(data: any[], filename: string) {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const value = row[header];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async clearDatabase(): Promise<void> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    
    // Cancella tutti i membri (usa not IS NULL per evitare 400 con filter vuoto)
    const { error: membersError } = await client.from('members').delete().not('id', 'is', null);
    if (membersError) throw membersError;
    
    // Cancella tutte le convocazioni
    const { error: convocazioniError } = await client.from('convocazioni').delete().not('id', 'is', null);
    if (convocazioniError) throw convocazioniError;
  }

  async loadDemoData(): Promise<void> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    
    // Carica membri demo
    const demoMembers = this.buildDemoMembers();
    const { error: membersError } = await client.from('members').insert(demoMembers.map(m => ({ data: m })));
    if (membersError) throw membersError;
    
    // Carica convocazioni demo
    const demoConvocazioni = this.buildDemoConvocazioni();
    const { error: convocazioniError } = await client.from('convocazioni').insert(
      demoConvocazioni.map(c => ({
        branch_type: c.branchType,
        year_start: c.yearStart,
        data: c,
      }))
    );
    if (convocazioniError) throw convocazioniError;
  }
}

export const dataService = new DataService();
