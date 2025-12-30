
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Member, AppSettings, BranchType, Convocazione } from '../types';

type MemberRow = { id: string; data: Member };
type SettingsRow = { id: string; data: AppSettings; db_version: number; schema_version: number };
type ConvocazioneRow = { id: string; branch_type: BranchType; year_start: number; data: Convocazione };

class DataService {
  public APP_VERSION = '0.124';
  public DB_VERSION = 12;
  public SUPABASE_SCHEMA_VERSION = 1;

  private supabase: SupabaseClient | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.ensureInitialized();
  }

  private readEnv(key: string): string | undefined {
    const env = (import.meta as any)?.env || {};
    return env[key];
  }

  private ensureSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    const url = this.readEnv('VITE_SUPABASE_URL') || this.readEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://jqelokmsjosjwmrbwnyz.supabase.co';
    const anonKey =
      this.readEnv('VITE_SUPABASE_ANON_KEY') ||
      this.readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
      this.readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY') ||
      'sb_publishable_OB7Uozbjy1Fc7z5QpOjGAA_SpS-TuFt';

    if (!url || !anonKey) {
      throw new Error('Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).');
    }

    this.supabase = createClient(url, anonKey, { auth: { persistSession: true } });
    return this.supabase;
  }

  private async ensureInitialized(): Promise<void> {
    this.ensureSupabaseClient();
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

    const { count, error: countError } = await client
      .from('members')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      this.mapSchemaError(countError);
    }

    if ((count ?? 0) === 0) {
      const demoMembers = this.buildDemoMembers();
      await client.from('members').insert(demoMembers.map(m => ({ data: m })));
    }

    const { count: convCount, error: convCountError } = await client
      .from('convocazioni')
      .select('id', { count: 'exact', head: true });

    if (convCountError) {
      this.mapSchemaError(convCountError);
    }

    if ((convCount ?? 0) === 0) {
      const demoConvocazioni = this.buildDemoConvocazioni();
      await client.from('convocazioni').insert(
        demoConvocazioni.map(c => ({
          branch_type: c.branchType,
          year_start: c.yearStart,
          data: c,
        }))
      );
    }
  }

  private buildDemoMembers(): Member[] {
    const baseDate = new Date();
    const year = baseDate.getFullYear();

    const craftActiveStatus = (date: string) => [{ date, status: 'ACTIVE', reason: 'Iniziazione' }];
    const degree = (name: string, date: string) => ({ degreeName: name, date, meetingNumber: '1', location: 'Milano' });

    const makeMember = (
      id: string,
      matricula: string,
      firstName: string,
      lastName: string,
      city: string,
      email: string,
      craftRole?: string,
      chapterRole?: string,
      markRole?: string,
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
      craft.degrees = [degree('Apprendista Ammesso', today)];
      if (craftRole) {
        craft.roles = [{ id: `role_${id}_craft`, yearStart: year, roleName: craftRole, branch: 'CRAFT' }];
      }

      const chapter = branchTemplate();
      if (chapterRole) {
        chapter.statusEvents = craftActiveStatus(today);
        chapter.degrees = [degree("Compagno dell'Arco Reale", today)];
        chapter.roles = [{ id: `role_${id}_chapter`, yearStart: year, roleName: chapterRole, branch: 'CHAPTER' }];
      }

      const mark = branchTemplate();
      if (markRole) {
        mark.statusEvents = craftActiveStatus(today);
        mark.degrees = [degree('Uomo del Marchio', today)];
        mark.roles = [{ id: `role_${id}_mark`, yearStart: year, roleName: markRole, branch: 'MARK' }];
      }

      const ram = branchTemplate();
      if (ramRole) {
        ram.statusEvents = craftActiveStatus(today);
        ram.degrees = [degree("Marinaio dell'Arca Reale", today)];
        ram.roles = [{ id: `role_${id}_ram`, yearStart: year, roleName: ramRole, branch: 'RAM' }];
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
    
    // Use roles from constants.ts (Emulation default for Craft, Irlandese for Mark/Chapter/RAM)
    const craftRoles = ['Maestro Venerabile', 'IEM', 'Primo Sorvegliante', 'Secondo Sorvegliante', 'Cappellano', 'Tesoriere', 'Segretario', 'Assistente Segretario', 'Direttore delle Cerimonie', 'Elemosiniere'];
    const chapterRoles = ['Re Eccellente', 'Sommo Sacerdote', 'Primo Scriba', 'Scriba E.', 'Scriba N.'];
    const markRoles = ['Maestro Venerabile', 'Primo Sorvegliante', 'Secondo Sorvegliante', 'Maestro Supervisore', 'Primo Supervisore'];
    const ramRoles = ['Venerabile Comandante Noè', 'Iafet (Primo Sorvegliante)', 'Sem (Secondo Sorvegliante)'];
    
    const members: Member[] = [];
    for (let i = 1; i <= 50; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / 2.5) % lastNames.length];
      const city = cities[i % cities.length];
      const matricula = String(100000 + i);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
      
      let craftRole: string | undefined;
      let chapterRole: string | undefined;
      let markRole: string | undefined;
      let ramRole: string | undefined;
      
      if (i <= 10) {
        craftRole = craftRoles[i - 1];
      }
      if (i <= 5) {
        chapterRole = chapterRoles[i - 1];
      }
      if (i <= 5) {
        markRole = markRoles[i - 1];
      }
      if (i <= 3) {
        ramRole = ramRoles[i - 1];
      }
      
      members.push(makeMember(`seed-${i}`, matricula, firstName, lastName, city, email, craftRole, chapterRole, markRole, ramRole));
    }
    
    return members;
  }

  private buildDemoConvocazioni(): Convocazione[] {
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
    const row = { id: memberToSave.id, data: memberToSave };
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
}

export const dataService = new DataService();
