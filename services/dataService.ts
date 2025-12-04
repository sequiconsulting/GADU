
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, runTransaction } from "firebase/firestore";
import { Member, AppSettings } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyCz0_p2klHvYZJ5xXWJE_eSrKy4pAz4Poc",
  authDomain: "gadu-staging.firebaseapp.com",
  projectId: "gadu-staging",
  storageBucket: "gadu-staging.firebasestorage.app",
  messagingSenderId: "88758278794",
  appId: "1:88758278794:web:ac41da27e151d31bbf6b73",
  measurementId: "G-2FC590JYSL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MOCK_MEMBERS: Member[] = [
  {
    id: '1',
    matricula: '101',
    firstName: 'Mario',
    lastName: 'Rossi',
    city: 'Roma',
    email: 'mario.rossi@email.com',
    phone: '3331234567',
    craft: {
      statusEvents: [{ date: '2020-01-15', status: 'ACTIVE', note: 'Iniziazione' }],
      degrees: [
        { degreeName: 'Apprendista', date: '2020-01-15' },
        { degreeName: 'Compagno di Mestiere', date: '2021-02-20' },
        { degreeName: 'Maestro Muratore', date: '2022-03-25' },
      ],
      roles: [
        { roleName: 'Tesoriere', yearStart: 2023 },
      ],
      isMotherLodgeMember: true,
      isFounder: false,
    },
    mark: {
      statusEvents: [{ date: '2022-05-10', status: 'ACTIVE', note: 'Avanzamento' }],
      degrees: [
        { degreeName: 'Uomo del Marchio', date: '2022-05-10' },
        { degreeName: 'Maestro del Marchio', date: '2023-06-15' },
      ],
      roles: [],
      isMotherLodgeMember: true,
      isFounder: false,
    },
    chapter: {
      statusEvents: [],
      degrees: [],
      roles: [],
      isMotherLodgeMember: true,
    },
    ram: {
      statusEvents: [],
      degrees: [],
      roles: [],
      isMotherLodgeMember: true,
    },
  },
  {
    id: '2',
    matricula: '102',
    firstName: 'Luigi',
    lastName: 'Verdi',
    city: 'Milano',
    email: 'luigi.verdi@email.com',
    phone: '3357654321',
    craft: {
      statusEvents: [{ date: '2023-09-10', status: 'ACTIVE', note: 'Iniziazione' }],
      degrees: [
        { degreeName: 'Apprendista', date: '2023-09-10' },
      ],
      roles: [],
      isMotherLodgeMember: true,
      isFounder: false,
    },
    mark: { statusEvents: [], degrees: [], roles: [], isMotherLodgeMember: true },
    chapter: { statusEvents: [], degrees: [], roles: [], isMotherLodgeMember: true },
    ram: { statusEvents: [], degrees: [], roles: [], isMotherLodgeMember: true },
  },
    {
    id: '3',
    matricula: '103',
    firstName: 'Giuseppe',
    lastName: 'Bianchi',
    city: 'Napoli',
    email: 'giuseppe.bianchi@email.com',
    phone: '3471122334',
    craft: {
      statusEvents: [
        { date: '2019-03-01', status: 'ACTIVE', note: 'Iniziazione' },
        { date: '2022-11-20', status: 'INACTIVE', note: 'Dimissioni' },
    ],
      degrees: [
        { degreeName: 'Apprendista', date: '2019-03-01' },
        { degreeName: 'Compagno di Mestiere', date: '2020-04-05' },
      ],
      roles: [],
      isMotherLodgeMember: true,
      isFounder: false,
    },
    mark: { statusEvents: [], degrees: [], roles: [], isMotherLodgeMember: true },
    chapter: { statusEvents: [], degrees: [], roles: [], isMotherLodgeMember: true },
    ram: { statusEvents: [], degrees: [], roles: [], isMotherLodgeMember: true },
  }
];

class DataService {
  private USE_FIREBASE = true;
  public APP_VERSION = '0.24';
  private membersCollection = collection(db, "members");
  private settingsDoc = doc(db, "settings", "appSettings");

  constructor() {
    this.init();
  }

  private init() {
    if (this.USE_FIREBASE) {
      console.log("Firebase mode enabled.");
    } else {
      console.log("Local mode enabled. Firebase is not in use.");
    }
  }

  async uploadMockData() {
    if (!this.USE_FIREBASE) {
      console.log("Cannot upload mock data in local mode.");
      return;
    }

    console.log("Starting mock data upload to Firebase...");
    try {
        await runTransaction(db, async (transaction) => {
            for (const member of MOCK_MEMBERS) {
                const memberRef = doc(this.membersCollection, member.id);
                transaction.set(memberRef, member);
            }
        });
        console.log("Mock data successfully uploaded to Firebase!");
        alert("Mock data successfully uploaded to Firebase!");
    } catch (error) {
        console.error("Error uploading mock data: ", error);
        alert("Error uploading mock data. Check the console for details.");
    }
  }

  async getMembers(): Promise<Member[]> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve([]);
    }
    const querySnapshot = await getDocs(this.membersCollection);
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
    const docRef = doc(this.membersCollection, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Member : undefined;
  }

  async saveMember(member: Member): Promise<Member> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve(member);
    }
    let memberToSave = { ...member };
    if (!memberToSave.id) {
        const newDocRef = doc(this.membersCollection);
        memberToSave.id = newDocRef.id;
    }
    const memberRef = doc(this.membersCollection, memberToSave.id);
    await setDoc(memberRef, memberToSave, { merge: true });
    return memberToSave;
  }


  async deleteMember(id: string): Promise<void> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve();
    }
    const memberRef = doc(this.membersCollection, id);
    await deleteDoc(memberRef);
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve({ lodgeName: '', lodgeNumber: '', province: '' });
    }
    const docSnap = await getDoc(this.settingsDoc);
    return docSnap.exists() ? docSnap.data() as AppSettings : { lodgeName: '', lodgeNumber: '', province: '' };
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    if (!this.USE_FIREBASE) {
      return Promise.resolve(settings);
    }
    await setDoc(this.settingsDoc, settings);
    return settings;
  }
  
  getEmptyMember(): Member {
    const createBranchData = () => ({ 
      statusEvents: [],
      degrees: [], 
      roles: [],
      isMotherLodgeMember: true, 
      isFounder: false
    });

    return {
      id: '',
      matricula: '',
      firstName: '',
      lastName: '',
      city: '',
      email: '',
      phone: '',
      craft: { ...createBranchData(), statusEvents: [{ date: new Date().toISOString().split('T')[0], status: 'ACTIVE', note: 'Iniziazione' }] }, 
      mark: createBranchData(),
      chapter: createBranchData(),
      ram: createBranchData()
    };
  }
}

export const dataService = new DataService();
