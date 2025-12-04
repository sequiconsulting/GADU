

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, deleteDoc, runTransaction } from "firebase/firestore";
import { Member, AppSettings } from "../types";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "gadu-33492",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MOCK_MEMBERS: Member[] = [
  // ... (keep the same mock data array as before)
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
    // Firebase is initialized outside, just a check
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
    const batch = runTransaction(db, async (transaction) => {
      for (const member of MOCK_MEMBERS) {
        const memberRef = doc(this.membersCollection, member.id);
        transaction.set(memberRef, member);
      }
    });

    try {
      await batch;
      console.log("Mock data successfully uploaded to Firebase!");
    } catch (error) {
      console.error("Error uploading mock data: ", error);
    }
  }

  async getMembers(): Promise<Member[]> {
    if (!this.USE_FIREBASE) {
      // Local fallback
      return new Promise(resolve => resolve([]));
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
      return new Promise(resolve => resolve(undefined));
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
      return new Promise(resolve => resolve(member));
    }
    let memberToSave = { ...member };
    if (!memberToSave.id) {
        memberToSave.id = doc(this.membersCollection).id; // Generate new ID
    }
    const memberRef = doc(this.membersCollection, memberToSave.id);
    await setDoc(memberRef, memberToSave, { merge: true });
    return memberToSave;
  }

  async deleteMember(id: string): Promise<void> {
    if (!this.USE_FIREBASE) {
      return new Promise(resolve => resolve());
    }
    const memberRef = doc(this.membersCollection, id);
    await deleteDoc(memberRef);
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.USE_FIREBASE) {
      return new Promise(resolve => resolve({ lodgeName: '', lodgeNumber: '', province: '' }));
    }
    const docSnap = await getDoc(this.settingsDoc);
    return docSnap.exists() ? docSnap.data() as AppSettings : { lodgeName: '', lodgeNumber: '', province: '' };
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    if (!this.USE_FIREBASE) {
      return new Promise(resolve => resolve(settings));
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

