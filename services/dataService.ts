
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Member, AppSettings, BranchType, Convocazione } from '../types';
import { PublicLodgeConfig } from '../types/lodge';

type MemberRow = { id: string; data: Member };
type SettingsRow = { id: string; data: AppSettings; db_version: number; schema_version: number };
type ConvocazioneRow = { id: string; branch_type: BranchType; year_start: number; data: Convocazione };

class DataService {
  public APP_VERSION = '0.138';
  public DB_VERSION = 12;
  public SUPABASE_SCHEMA_VERSION = 1;

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
    
    // Ricrea Supabase client con lodge config
    this.supabase = createClient(
      config.supabaseUrl,
      apiKey,
      { auth: { persistSession: true } }
    );
    
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
        lodgeNumber: '105',
        province: 'MI',
        dbVersion: this.DB_VERSION,
        users: [],
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
      }
    }

    // Auto-seed rimosso - ora si usa il bottone manuale in AdminPanel
  }

  public buildDemoMembers(): Member[] {
    const baseDate = new Date();
    const year = baseDate.getFullYear();

    const craftActiveStatus = (date: string) => [{ date, status: 'ACTIVE', reason: 'Iniziazione' }];

    const makeMember = (
      id: string,
      matricula: string,
      firstName: string,
      lastName: string,
      city: string,
      email: string,
      craftDegree?: string,
      craftRole?: string,
      chapterDegree?: string,
      chapterRole?: string,
      markDegree?: string,
      markRole?: string,
      ramDegree?: string,
      ramRole?: string,
    ): Member => {
      const today = new Date().toISOString().split('T')[0];
      const branchTemplate = () => ({
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

      const craft = branchTemplate();
      craft.statusEvents = craftActiveStatus(today);
      if (craftDegree) {
        craft.degrees = [{ degreeName: craftDegree, date: today, meetingNumber: '1', location: 'Milano' }];
      }
      if (craftRole) {
        craft.roles = [{ id: `role_${id}_craft`, yearStart: year, roleName: craftRole, branch: 'CRAFT' }];
      }

      const chapter = branchTemplate();
      if (chapterDegree || chapterRole) {
        chapter.statusEvents = craftActiveStatus(today);
        if (chapterDegree) {
          chapter.degrees = [{ degreeName: chapterDegree, date: today, meetingNumber: '1', location: 'Milano' }];
        }
        if (chapterRole) {
          chapter.roles = [{ id: `role_${id}_chapter`, yearStart: year, roleName: chapterRole, branch: 'CHAPTER' }];
        }
      }

      const mark = branchTemplate();
      if (markDegree || markRole) {
        mark.statusEvents = craftActiveStatus(today);
        if (markDegree) {
          mark.degrees = [{ degreeName: markDegree, date: today, meetingNumber: '1', location: 'Milano' }];
        }
        if (markRole) {
          mark.roles = [{ id: `role_${id}_mark`, yearStart: year, roleName: markRole, branch: 'MARK' }];
        }
      }

      const ram = branchTemplate();
      if (ramDegree || ramRole) {
        ram.statusEvents = craftActiveStatus(today);
        if (ramDegree) {
          ram.degrees = [{ degreeName: ramDegree, date: today, meetingNumber: '1', location: 'Milano' }];
        }
        if (ramRole) {
          ram.roles = [{ id: `role_${id}_ram`, yearStart: year, roleName: ramRole, branch: 'RAM' }];
        }
      }

      return {
        id,
        matricula,
        firstName,
        lastName,
        city,
        email,
        phone: '3330000000',
        craft,
        mark,
        chapter,
        ram,
        changelog: [],
      };
    };

    const firstNames = ['Giovanni', 'Marco', 'Luca', 'Andrea', 'Paolo', 'Francesco', 'Alessandro', 'Matteo', 'Lorenzo', 'Davide', 'Simone', 'Federico', 'Riccardo', 'Giuseppe', 'Antonio', 'Stefano', 'Roberto', 'Michele', 'Giorgio', 'Claudio'];
    const lastNames = ['Rossi', 'Bianchi', 'Conti', 'Ferrari', 'Russo', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Costa', 'Fontana', 'Esposito', 'Gentile', 'Caruso', 'Ferrara', 'Marchetti', 'Villa'];
    const cities = ['Milano', 'Torino', 'Bologna', 'Roma', 'Firenze', 'Genova', 'Napoli', 'Venezia', 'Verona', 'Brescia'];
    
    // Solo rituali di default: Emulation (Craft), Irlandese (Mark/Chapter), RAM
    const craftEmulationDegrees = ['Apprendista Ammesso', 'Compagno di Mestiere', 'Maestro Muratore', 'Maestro Installato'];
    const craftEmulationRoles = ['Maestro Venerabile', 'IEM', 'Primo Sorvegliante', 'Secondo Sorvegliante', 'Cappellano', 'Tesoriere', 'Segretario', 'Assistente Segretario', 'Direttore delle Cerimonie', 'Elemosiniere'];
    
    const markIrlandeseDegrees = ['Uomo del Marchio', 'Maestro del Marchio', 'Maestro Installato del Marchio'];
    const markIrlandeseRoles = ['Maestro Venerabile', 'Primo Sorvegliante', 'Secondo Sorvegliante', 'Maestro Supervisore', 'Primo Supervisore'];
    
    const chapterIrlandeseDegrees = ["Compagno dell'Arco Reale", "Principale dell'Arco Reale"];
    const chapterIrlandeseRoles = ['Re Eccellente', 'Sommo Sacerdote', 'Primo Scriba', 'Scriba E.', 'Scriba N.'];
    
    const ramDegrees = ["Marinaio dell'Arca Reale", 'Comandante del RAM'];
    const ramRoles = ['Venerabile Comandante Noè', 'Iafet (Primo Sorvegliante)', 'Sem (Secondo Sorvegliante)'];
    
    const members: Member[] = [];
    for (let i = 1; i <= 50; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / 2.5) % lastNames.length];
      const city = cities[i % cities.length];
      const matricula = String(100000 + i);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
      
      const craftDegree = craftEmulationDegrees[0];
      const craftRole = i <= 10 ? craftEmulationRoles[i - 1] : undefined;
      
      let chapterDegree: string | undefined;
      let chapterRole: string | undefined;
      if (i <= 10) {
        chapterDegree = chapterIrlandeseDegrees[0];
        chapterRole = i <= 5 ? chapterIrlandeseRoles[i - 1] : undefined;
      }
      
      let markDegree: string | undefined;
      let markRole: string | undefined;
      if (i <= 10) {
        markDegree = markIrlandeseDegrees[0];
        markRole = i <= 5 ? markIrlandeseRoles[i - 1] : undefined;
      }
      
      let ramDegree: string | undefined;
      let ramRole: string | undefined;
      if (i <= 6) {
        ramDegree = ramDegrees[0];
        ramRole = i <= 3 ? ramRoles[i - 1] : undefined;
      }
      
      members.push(makeMember(`seed-${i}`, matricula, firstName, lastName, city, email, craftDegree, craftRole, chapterDegree, chapterRole, markDegree, markRole, ramDegree, ramRole));
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
    const { data, error } = await client.from('members').select('id, data');
    if (error) throw error;
    return (data || []).map((row: MemberRow) => ({ ...row.data, id: row.id }));
  }

  async getMemberById(id: string): Promise<Member | undefined> {
    if (id === 'new') {
      return this.getEmptyMember();
    }
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
    const { data, error } = await client.from('members').select('id, data').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? { ...(data as MemberRow).data, id: (data as MemberRow).id } : undefined;
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
    
    // Rimuovi l'id dall'oggetto data per evitare duplicati
    const { id, ...dataWithoutId } = memberToSave;
    const row = { id, data: dataWithoutId };
    
    const { error } = await client.from('members').upsert(row);
    if (error) throw error;
    return memberToSave;
  }

  async deleteMember(id: string): Promise<void> {
    await this.ensureReady();
    const client = this.ensureSupabaseClient();
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
      return { lodgeName: '', lodgeNumber: '', province: '', dbVersion: this.DB_VERSION, users: [], userChangelog: [] };
    }
    const merged: AppSettings = {
      ...row.data,
      dbVersion: this.DB_VERSION,
      users: row.data.users || [],
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
      users: settings.users || [],
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
