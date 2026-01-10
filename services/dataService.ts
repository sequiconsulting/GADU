
import { type SupabaseClient } from '@supabase/supabase-js';
import { Member, AppSettings, BranchType, Convocazione } from '../types';
import { PublicLodgeConfig } from '../types/lodge';
import { faker } from '@faker-js/faker/locale/it';
import { INITIATION_TERMS, DEGREES_CRAFT_EMULATION, CRAFT_EMULATION_ROLES } from '../constants';
import { getCachedSupabaseClient } from '../utils/supabaseClientCache';
import { memberDataSchema } from '../schemas/member';
import { appSettingsSchema } from '../schemas/settings';
import { convocazioneDataSchema, convocazioneSchema } from '../schemas/convocazione';
import { formatZodError } from '../schemas/common';

type MemberData = Omit<Member, 'id'>;
type MemberRow = { id: string; data: MemberData };
type SettingsRow = { id: string; data: AppSettings; db_version: number; schema_version: number };
type ConvocazioneRow = { id: string; branch_type: BranchType; year_start: number; data: Convocazione };

class DataService {
  public APP_VERSION = '0.202';
  public DB_VERSION = 16;
  public SUPABASE_SCHEMA_VERSION = 2;

  private supabase: SupabaseClient | null = null;
  private initPromise: Promise<void> | null = null;
  private currentLodgeConfig: PublicLodgeConfig | null = null;
  private useServiceKey = false;
  private schemaEnsured = false;
  private schemaEnsurePromise: Promise<void> | null = null;

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
    this.useServiceKey = Boolean(config.supabaseServiceKey);
    
    // Usa client cachato per evitare istanze multiple
    this.supabase = getCachedSupabaseClient(config.supabaseUrl, apiKey);

    this.schemaEnsured = false;
    this.schemaEnsurePromise = null;
    
    // Re-init promise
    this.initPromise = this.ensureSchemaEnsured();
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
    await this.ensureSchemaEnsured();
  }

  private async ensureSchemaEnsured(): Promise<void> {
    if (this.schemaEnsured) return;
    if (this.schemaEnsurePromise) return this.schemaEnsurePromise;

    this.schemaEnsurePromise = (async () => {
      const didEnsure = await this.ensureSchemaAndSeed();
      if (didEnsure) {
        this.schemaEnsured = true;
      }
    })().finally(() => {
      this.schemaEnsurePromise = null;
    });

    return this.schemaEnsurePromise;
  }

  private mapSchemaError(error: any): never {
    const message = error?.message || '';
    if (message.includes('relation') || error?.code === 'PGRST116') {
      throw new Error('Supabase schema is missing. Run supabase-schema.sql in your Supabase SQL editor, then reload the app.');
    }
    throw error;
  }

  private async updateSchemaViaFunction(): Promise<void> {
    if (!this.currentLodgeConfig?.glriNumber) {
      throw new Error('Lodge config not initialized');
    }

    try {
      const response = await fetch(
        `/.netlify/functions/update-schema?number=${this.currentLodgeConfig.glriNumber}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Schema update failed: ${error.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('[DataService] Schema update result:', result);
    } catch (error: any) {
      console.error('[DataService] Schema update error:', error);
      throw error;
    }
  }

  /**
   * Apply security policies to all tables.
   * NOTE: Il client gira con anon key, quindi non può gestire policy RLS (richiede service key).
   * Le policy vanno gestite via migrazioni/SQL o da backend con service key.
   */
  private async applySecurityPolicies(): Promise<void> {
    console.log('[SECURITY] Skip applySecurityPolicies on client (anon key). Configure RLS via SQL/backend with service key.');
  }

  private async ensureSchemaAndSeed(): Promise<boolean> {
    const client = this.ensureSupabaseClient();

    // Con anon key serve una sessione autenticata prima di toccare le tabelle protette da RLS
    if (!this.useServiceKey) {
      const { data: auth } = await client.auth.getSession();
      const hasSession = Boolean(auth.session?.access_token);
      if (!hasSession) {
        console.log('[Schema] Skip ensureSchemaAndSeed: nessuna sessione attiva (anon key). Attendo login.');
        return false;
      }
    }

    const { data: settingsRow, error: settingsError } = await client
      .from('app_settings')
      .select('id, data, db_version, schema_version')
      .eq('id', 'app')
      .maybeSingle();

    if (settingsError) {
      this.mapSchemaError(settingsError);
    }

    const currentVersion = settingsRow?.db_version ?? 0;
    if (currentVersion < this.DB_VERSION) {
      await this.updateSchemaViaFunction();
    }

    // Rileggi dopo migrazioni per non sovrascrivere dati utente
    const { data: refreshedSettings } = await client
      .from('app_settings')
      .select('id, data, db_version, schema_version')
      .eq('id', 'app')
      .maybeSingle();

    if (!refreshedSettings) {
      const defaultSettings: AppSettings = {
        lodgeName: 'Loggia Supabase Demo',
        lodgeNumber: this.currentLodgeConfig?.glriNumber || '9999',
        province: 'MI',
        dbVersion: this.DB_VERSION,
        userChangelog: [],
        branchPreferences: {
          CRAFT: {},
          MARK: {},
          ARCH: {},
          RAM: {},
        },
      };
      await client.from('app_settings').insert({
        id: 'app',
        data: defaultSettings,
        db_version: this.DB_VERSION,
        schema_version: this.SUPABASE_SCHEMA_VERSION,
      });
    } else {
      const updates: Partial<SettingsRow> = {};
      if (refreshedSettings.db_version !== this.DB_VERSION) updates.db_version = this.DB_VERSION;
      if (refreshedSettings.schema_version !== this.SUPABASE_SCHEMA_VERSION) updates.schema_version = this.SUPABASE_SCHEMA_VERSION;
      if (Object.keys(updates).length > 0) {
        await client.from('app_settings').update(updates).eq('id', 'app');
        if (updates.schema_version !== undefined) {
          await this.applySecurityPolicies();
        }
      }
    }

    // Auto-seed rimosso - ora si usa il bottone manuale in AdminPanel
    return true;
  }

  public buildDemoMembers(): MemberData[] {
    // Anno fisso 2024 per attivazioni demo
    const year = 2024;
    const baseDate = new Date('2024-01-15');
    const today = '2024-01-15';

    // Gradi e ruoli Craft Emulation da constants.ts
    const craftEmulationDegrees = DEGREES_CRAFT_EMULATION.map(d => d.name);
    const craftEmulationRoles = CRAFT_EMULATION_ROLES;

    const members: MemberData[] = [];
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

      // Mark, Arch, RAM - TUTTI INATTIVI
      const mark = inactiveBranchTemplate();
      const arch = inactiveBranchTemplate();
      const ram = inactiveBranchTemplate();

      members.push({
        matricula,
        firstName,
        lastName,
        city,
        email,
        phone,
        craft,
        mark,
        arch,
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
      makeConvocazione('ARCH', 1, 21, 'Bologna', 'Arco Reale ordinario con discussione studi simbolici.'),
      makeConvocazione('RAM', 1, 28, 'Genova', 'Lavori rituali RAM e assegnazione incarichi.'),
    ];
  }

  private async ensureReady() {
    if (!this.initPromise) {
      throw new Error('DataService not initialized. Call initializeLodge() first.');
    }
    await this.initPromise;
    // In modalità anon key la prima ensure può essere stata skip (nessuna sessione).
    // Dopo login, assicura schema/settings una sola volta.
    await this.ensureSchemaEnsured();
  }

  async getMembers(): Promise<Member[]> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    try {
      const { data, error } = await client.from('members').select('id, data');
      if (error) throw new Error(`Failed to load members: ${error.message} (code: ${error.code})`);
      const invalid: Array<{ id: string; details: string }> = [];
      const members: Member[] = [];
      for (const row of data || []) {
        const r = row as MemberRow;
        const parsed = memberDataSchema.safeParse(r.data);
        if (!parsed.success) {
          invalid.push({ id: r.id, details: formatZodError(parsed.error) });
          continue;
        }
        members.push({ ...(parsed.data as any), id: r.id } as Member);
      }
      if (invalid.length) {
        const preview = invalid
          .slice(0, 3)
          .map(x => `- ${x.id}:\n${x.details}`)
          .join('\n');
        throw new Error(`Dati membri non validi (${invalid.length}).\n${preview}`);
      }
      return members;
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
      if (!data) return undefined;
      const row = data as MemberRow;
      const parsed = memberDataSchema.safeParse(row.data);
      if (!parsed.success) {
        throw new Error(`Dati membro non validi (${row.id}).\n${formatZodError(parsed.error)}`);
      }
      return { ...(parsed.data as any), id: row.id } as Member;
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
    
    // Normalizza campi richiesti: sempre stringhe (niente null nel nuovo formato)
    const normalizeRequiredString = (val: string | null | undefined): string => (val ?? '').trim();
    // Normalizza campi opzionali: '' -> null
    const normalizeOptionalString = (val: string | null | undefined): string | null | undefined => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      const trimmed = val.trim();
      return trimmed === '' ? null : trimmed;
    };
    
    memberToSave.matricula = normalizeRequiredString(memberToSave.matricula);
    memberToSave.email = normalizeRequiredString(memberToSave.email);
    memberToSave.phone = normalizeRequiredString(memberToSave.phone);
    
    // Normalize branch data
    (['craft', 'mark', 'arch', 'ram'] as const).forEach(branchKey => {
      const branchData = memberToSave[branchKey];
      branchData.otherLodgeName = normalizeOptionalString(branchData.otherLodgeName);
      
      // Sort statusEvents by date (chronological order)
      branchData.statusEvents = [...branchData.statusEvents].sort((a, b) => {
        const dateA = (a.date ?? '').toString();
        const dateB = (b.date ?? '').toString();
        return dateA.localeCompare(dateB);
      });
    });
    
    // Rimuovi l'id dall'oggetto data per evitare duplicati
    const { id, ...dataWithoutId } = memberToSave;
    const dataToPersist = { ...dataWithoutId, lastModified };
    const parsed = memberDataSchema.safeParse(dataToPersist);
    if (!parsed.success) {
      throw new Error(`Impossibile salvare: dati membro non validi.\n${formatZodError(parsed.error)}`);
    }
    const row = { id, data: parsed.data };
    
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
        (['craft', 'mark', 'arch', 'ram'] as const).forEach(branchKey => {
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

    const defaultBranchPreferences: NonNullable<AppSettings['branchPreferences']> = {
      CRAFT: {},
      MARK: {},
      ARCH: {},
      RAM: {},
    };
    const defaultSettings: AppSettings = {
      lodgeName: '',
      lodgeNumber: '',
      province: '',
      dbVersion: this.DB_VERSION,
      userChangelog: [],
      branchPreferences: defaultBranchPreferences,
    };

    if (!row) {
      return defaultSettings;
    }

    const raw: any = row.data || {};
    const rawBranchPreferences: any = raw.branchPreferences;

    const normalizedBranchPreferences: NonNullable<AppSettings['branchPreferences']> = {
      CRAFT:
        rawBranchPreferences && typeof rawBranchPreferences === 'object' && rawBranchPreferences.CRAFT && typeof rawBranchPreferences.CRAFT === 'object'
          ? rawBranchPreferences.CRAFT
          : {},
      MARK:
        rawBranchPreferences && typeof rawBranchPreferences === 'object' && rawBranchPreferences.MARK && typeof rawBranchPreferences.MARK === 'object'
          ? rawBranchPreferences.MARK
          : {},
      ARCH:
        rawBranchPreferences && typeof rawBranchPreferences === 'object' && rawBranchPreferences.ARCH && typeof rawBranchPreferences.ARCH === 'object'
          ? rawBranchPreferences.ARCH
          : {},
      RAM:
        rawBranchPreferences && typeof rawBranchPreferences === 'object' && rawBranchPreferences.RAM && typeof rawBranchPreferences.RAM === 'object'
          ? rawBranchPreferences.RAM
          : {},
    };

    const candidate: AppSettings = {
      ...defaultSettings,
      ...raw,
      dbVersion: this.DB_VERSION,
      userChangelog: Array.isArray(raw.userChangelog) ? raw.userChangelog : [],
      branchPreferences: normalizedBranchPreferences,
    };

    const parsed = appSettingsSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(`Impossibile caricare impostazioni: dati non validi.\n${formatZodError(parsed.error)}`);
    }

    const shouldPersist = JSON.stringify(raw.branchPreferences) !== JSON.stringify(normalizedBranchPreferences);
    if (shouldPersist) {
      const { error: upsertError } = await client.from('app_settings').upsert({
        id: 'app',
        data: parsed.data,
        db_version: this.DB_VERSION,
        schema_version: this.SUPABASE_SCHEMA_VERSION,
      });
      if (upsertError) throw upsertError;
    }

    return parsed.data as unknown as AppSettings;
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const settingsToSave: AppSettings = {
      ...settings,
      dbVersion: this.DB_VERSION,
      userChangelog: (settings.userChangelog || []).slice(-100),
    };

    const parsed = appSettingsSchema.safeParse(settingsToSave);
    if (!parsed.success) {
      throw new Error(`Impossibile salvare impostazioni: dati non validi.\n${formatZodError(parsed.error)}`);
    }

    const { error } = await client.from('app_settings').upsert({
      id: 'app',
      data: parsed.data,
      db_version: this.DB_VERSION,
      schema_version: this.SUPABASE_SCHEMA_VERSION,
    });
    if (error) throw error;
    return parsed.data as unknown as AppSettings;
  }

  async getConvocazioniForBranch(branch: BranchType): Promise<Convocazione[]> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const { data, error } = await client
      .from('convocazioni')
      .select('id, branch_type, year_start, data')
      .eq('branch_type', branch);
    if (error) throw error;
    const invalid: Array<{ id: string; details: string }> = [];
    const list: Convocazione[] = [];
    for (const rowAny of data || []) {
      const row = rowAny as ConvocazioneRow;
      const parsed = convocazioneDataSchema.safeParse(row.data);
      if (!parsed.success) {
        invalid.push({ id: row.id, details: formatZodError(parsed.error) });
        continue;
      }
      list.push({ ...parsed.data, id: row.id } as Convocazione);
    }
    if (invalid.length) {
      const preview = invalid
        .slice(0, 3)
        .map(x => `- ${x.id}:\n${x.details}`)
        .join('\n');
      throw new Error(`Dati convocazioni non validi (${invalid.length}).\n${preview}`);
    }
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

    const parsed = convocazioneSchema.safeParse(toSave);
    if (!parsed.success) {
      throw new Error(`Impossibile salvare convocazione: dati non validi.\n${formatZodError(parsed.error)}`);
    }

    const row: ConvocazioneRow = {
      id: parsed.data.id,
      branch_type: parsed.data.branchType,
      year_start: parsed.data.yearStart,
      data: parsed.data,
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
      arch: createBranchData(),
      ram: createBranchData(),
      changelog: [],
    };
  }

  validateAndCleanAllMembers(members: Member[]): { cleaned: Member[]; report: string } {
    const report: string[] = [];
    let totalCleaned = 0;

    const cleaned = members.map(member => {
      const cleaned = { ...member };

      (['craft', 'mark', 'arch', 'ram'] as const).forEach(branchKey => {
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
    const { error: membersError } = await client.from('members').insert(
      demoMembers.map(m => {
        // Nel nuovo formato, l'id vive solo nella colonna 'id' della tabella, non in 'data'
        const { id: _ignored, ...data } = m as any;
        return { data };
      })
    );
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
