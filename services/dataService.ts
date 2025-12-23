
import { Member, AppSettings, BranchType, OfficerRole, ChangeLogEntry, Convocazione, AppUser, UserPrivilege } from "../types";
import { isMemberActiveInYear } from "../constants";

const firebaseConfig = {
  apiKey: "AIzaSyCz0_p2klHvYZJ5xXWJE_eSrKy4pAz4Poc",
  authDomain: "gadu-staging.firebaseapp.com",
  projectId: "gadu-staging",
  storageBucket: "gadu-staging.firebasestorage.app",
  messagingSenderId: "88758278794",
  appId: "1:88758278794:web:ac41da27e151d31bbf6b73",
  measurementId: "G-2FC590JYSL"
};

class DataService {
  private USE_FIREBASE = true;
  public APP_VERSION = '0.121'; // RelazioneAnnuale: calcolo Quota per capitazione/ramo
  public DB_VERSION = 11; // AppSettings schema change
  private app: any = null;
  private db: any = null;
  private membersCollection: any = null;
  private convocazioniCollection: any = null;
  private settingsDoc: any = null;
  private firebaseFns: any = null;
  private firebaseInitialized = false;

  constructor() {
    this.init();
  }

  private async ensureFirebase() {
    if (!this.USE_FIREBASE) return;
    if (this.firebaseInitialized) return;
    const { initializeApp } = await import('firebase/app');
    const firestore = await import('firebase/firestore');
    const { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, query, where, deleteField, addDoc } = firestore;

    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
    this.membersCollection = collection(this.db, 'members');
    this.convocazioniCollection = collection(this.db, 'convocazioni');
    this.settingsDoc = doc(this.db, 'settings', 'appSettings');
    this.firebaseFns = { collection, getDocs, doc, getDoc, setDoc, deleteDoc, writeBatch, query, where, addDoc };
    this.firebaseInitialized = true;
  }

  private async syncVersionToFirestore(): Promise<void> {
    if (!this.USE_FIREBASE) return;
    await this.ensureFirebase();
    try {
      const docSnap = await this.firebaseFns.getDoc(this.settingsDoc);
      const data = docSnap.exists() ? docSnap.data() : undefined;
      const dbVersion = data?.dbVersion;
      
      // If version mismatch, automatically update Firestore to current version
      if (dbVersion !== this.DB_VERSION) {
        console.log(`DB Version mismatch detected: Firestore has ${dbVersion}, code expects ${this.DB_VERSION}. Auto-syncing...`);
        await this.firebaseFns.setDoc(this.settingsDoc, { dbVersion: this.DB_VERSION }, { merge: true });
        console.log(`DB Version synced to ${this.DB_VERSION}`);
      }
      // Schema migration: remove legacy convocazioni field from settings
      if (data && typeof data === 'object' && 'convocazioni' in data) {
        console.log('Removing legacy settings.convocazioni field...');
        await this.firebaseFns.setDoc(this.settingsDoc, { convocazioni: deleteField() }, { merge: true });
        console.log('Legacy convocazioni field removed.');
      }
    } catch (error) {
      console.error("Error syncing DB version:", error);
    }
  }

  private init() {
    if (this.USE_FIREBASE) {
      console.log("Firebase mode enabled.");
    } else {
      console.log("Local mode enabled. Firebase is not in use.");
    }
  }

  async getMembers(): Promise<Member[]> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve([]);
    }
    await this.ensureFirebase();
    const querySnapshot = await this.firebaseFns.getDocs(this.membersCollection);
    const members: Member[] = [];
    querySnapshot.forEach((doc) => {
      members.push({ id: doc.id, ...doc.data() } as Member);
    });
    return members;
  }

  async getMemberById(id: string): Promise<Member | undefined> {
    if (!this.USE_FIREBASE) {
        return Promise.resolve(undefined);
    }
    if (id === 'new') {
        return this.getEmptyMember();
    }
    await this.ensureFirebase();
    const docRef = this.firebaseFns.doc(this.membersCollection, id);
    const docSnap = await this.firebaseFns.getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Member : undefined;
  }

  async saveMember(member: Member): Promise<Member> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve(member);
    }
    let memberToSave = { ...member };
    if (!memberToSave.id) {
        await this.ensureFirebase();
        const newDocRef = this.firebaseFns.doc(this.membersCollection);
        memberToSave.id = newDocRef.id;
    }
    await this.ensureFirebase();
    // Enforce changelog maximum length (keep most recent 100 entries)
    if (memberToSave.changelog && Array.isArray(memberToSave.changelog)) {
      memberToSave.changelog = memberToSave.changelog.slice(-100);
    }
    const memberRef = this.firebaseFns.doc(this.membersCollection, memberToSave.id);
    await this.firebaseFns.setDoc(memberRef, memberToSave, { merge: true });
    // Automatically sync version after member save
    await this.syncVersionToFirestore();
    return memberToSave;
  }


  async deleteMember(id: string): Promise<void> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve();
    }
    await this.ensureFirebase();
    const memberRef = this.firebaseFns.doc(this.membersCollection, id);
    await this.firebaseFns.deleteDoc(memberRef);
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve({ lodgeName: '', lodgeNumber: '', province: '', dbVersion: this.DB_VERSION, users: [], userChangelog: [] });
    }
    await this.ensureFirebase();
    const docSnap = await this.firebaseFns.getDoc(this.settingsDoc);
    const settings = docSnap.exists() ? docSnap.data() as AppSettings : { lodgeName: '', lodgeNumber: '', province: '', dbVersion: this.DB_VERSION, users: [], userChangelog: [] };
    if (!settings.users) {
      settings.users = [];
    }
    if (!settings.userChangelog) {
      settings.userChangelog = [];
    }
    // Ensure dbVersion is set
    if (!settings.dbVersion) {
      settings.dbVersion = this.DB_VERSION;
    }
    // Automatically sync version if mismatch detected
    await this.syncVersionToFirestore();
    return settings;
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve(settings);
    }
    await this.ensureFirebase();
    // Ensure dbVersion is preserved in settings before saving
    const settingsToSave = {
      ...settings,
      dbVersion: this.DB_VERSION,
      users: settings.users || [],
      userChangelog: settings.userChangelog || [],
    };
    // Enforce userChangelog maximum length (keep most recent 100 entries)
    if (settingsToSave.userChangelog && Array.isArray(settingsToSave.userChangelog)) {
      settingsToSave.userChangelog = settingsToSave.userChangelog.slice(-100);
    }
    await this.firebaseFns.setDoc(this.settingsDoc, settingsToSave, { merge: true });
    // Automatically sync version after settings save
    await this.syncVersionToFirestore();
    return settingsToSave;
  }

  async bootstrapLodge(settings: { lodgeName: string; lodgeNumber: string; province: string }, admin: { email: string; name: string; privileges: UserPrivilege[] }): Promise<void> {
    if (!this.USE_FIREBASE) return Promise.resolve();
    await this.ensureFirebase();
    const now = new Date().toISOString();
    const docSnap = await this.firebaseFns.getDoc(this.settingsDoc);
    const existing = docSnap.exists() ? (docSnap.data() as AppSettings) : undefined;

    const adminUser: AppUser = {
      id: `user_${Date.now()}`,
      email: admin.email,
      name: admin.name,
      privileges: admin.privileges,
      createdAt: now,
      updatedAt: now,
    };

    const newSettings: AppSettings = {
      lodgeName: settings.lodgeName,
      lodgeNumber: settings.lodgeNumber,
      province: settings.province,
      dbVersion: this.DB_VERSION,
      users: [adminUser],
      userChangelog: [
        {
          timestamp: now,
          action: 'CREATE',
          userEmail: admin.email,
          performedBy: admin.email,
          details: `Bootstrap lodge and initial admin (${admin.name})`,
        },
      ],
      branchPreferences: existing?.branchPreferences || undefined,
      yearlyRituals: existing?.yearlyRituals || undefined,
    };

    await this.firebaseFns.setDoc(this.settingsDoc, newSettings, { merge: false });
    await this.syncVersionToFirestore();
  }

  // === Convocazioni API ===
  async getConvocazioniForBranch(branch: BranchType): Promise<Convocazione[]> {
    if (!this.USE_FIREBASE) return Promise.resolve([]);
    await this.ensureFirebase();
    // Fetch all and filter client-side to avoid dependency on Firestore indexes
    const snap = await this.firebaseFns.getDocs(this.convocazioniCollection);
    const list: Convocazione[] = [];
    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      if (data.branchType === branch) {
        list.push({ id: docSnap.id, ...data } as Convocazione);
      }
    });
    // Sort by numeroConvocazione ascending for consistency
    list.sort((a, b) => a.numeroConvocazione - b.numeroConvocazione);
    return list;
  }

  async getConvocazioni(branch: BranchType, yearStart: number): Promise<Convocazione[]> {
    const all = await this.getConvocazioniForBranch(branch);
    return all.filter(c => c.yearStart === yearStart);
  }

  async saveConvocazione(conv: Convocazione): Promise<Convocazione> {
    if (!this.USE_FIREBASE) return Promise.resolve(conv);
    await this.ensureFirebase();
    const now = new Date().toISOString();
    let toSave = { ...conv } as Convocazione;
    if (!toSave.id || toSave.id === 'new') {
      toSave.createdAt = now;
      toSave.updatedAt = now;
      const docRef = await this.firebaseFns.addDoc(this.convocazioniCollection, toSave);
      toSave.id = docRef.id;
      return toSave;
    } else {
      toSave.updatedAt = now;
      const ref = this.firebaseFns.doc(this.convocazioniCollection, toSave.id);
      await this.firebaseFns.setDoc(ref, toSave, { merge: true });
      return toSave;
    }
  }

  async deleteConvocazione(id: string): Promise<void> {
    if (!this.USE_FIREBASE) return Promise.resolve();
    await this.ensureFirebase();
    const ref = this.firebaseFns.doc(this.convocazioniCollection, id);
    await this.firebaseFns.deleteDoc(ref);
  }

  async toggleConvocazioneLock(id: string, lock?: boolean): Promise<void> {
    if (!this.USE_FIREBASE) return Promise.resolve();
    await this.ensureFirebase();
    const ref = this.firebaseFns.doc(this.convocazioniCollection, id);
    const now = new Date().toISOString();
    await this.firebaseFns.setDoc(ref, { bloccata: lock, updatedAt: now }, { merge: true });
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
      initiationDate: undefined
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
      changelog: []
    };
  }

  validateAndCleanAllMembers(members: Member[]): { cleaned: Member[]; report: string } {
    const report: string[] = [];
    let totalCleaned = 0;

    const cleaned = members.map(member => {
      const cleaned = { ...member };
      
      // Pulisci status events per ogni branch
      (['craft', 'mark', 'chapter', 'ram'] as const).forEach(branchKey => {
        const branch = cleaned[branchKey];
        if (!branch || !branch.statusEvents) return;

        const originalCount = branch.statusEvents.length;
        
        // Rimuovi eventi duplicati consecutivi (stesso status e data)
        const deduped: typeof branch.statusEvents = [];
        branch.statusEvents.forEach((event, idx) => {
          const prev = deduped[deduped.length - 1];
          if (!prev || prev.status !== event.status || prev.date !== event.date) {
            deduped.push(event);
          }
        });

        // Ordina per data
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
    // Converti dati in CSV
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escapa le virgole e le virgolette
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Crea blob e scarica
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
