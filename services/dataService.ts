

import { Member, BranchType, AppSettings } from "../types";

// Helper for dates
const d = (year: number, month: number, day: number) => `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

// Years for reference
const Y25 = 2025;
const Y24 = 2024;
const Y23 = 2023;

const MOCK_MEMBERS: Member[] = [
  // --- GRUPPO STORICO / FONDATORI ---
  {
    id: '1', matricula: '1001', firstName: 'Giuseppe', lastName: 'Garibaldi', city: 'Nizza', email: 'g.garibaldi@eroe.it', phone: '3330000001',
    craft: { statusEvents: [{date: '1844-07-04', status: 'ACTIVE'}], initiationDate: '1844-07-04', degrees: [{degreeName: 'Maestro Muratore', date: '1844-09-01', meetingNumber: '15'}], roles: [{id: 'c1a', yearStart: Y25, roleName: 'IEM', branch: 'CRAFT'}, {id: 'c1b', yearStart: Y24, roleName: 'Maestro Venerabile', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1850-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, isFounder: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1850-01-01', meetingNumber: '1'}], roles: [{id: 'm1a', yearStart: Y25, roleName: 'Maestro Venerabile', branch: 'MARK'}] },
    chapter: { statusEvents: [{date: '1855-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Compagno dell\'Arco Reale', date: '1855-01-01', meetingNumber: '1'}], roles: [{id: 'ch1a', yearStart: Y25, roleName: 'Il Re', branch: 'CHAPTER'}, {id: 'ch1b', yearStart: Y24, roleName: 'Il Sommo Sacerdote', branch: 'CHAPTER'}] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '2', matricula: '1002', firstName: 'Camillo', lastName: 'Benso di Cavour', city: 'Torino', email: 'cavour@regno.it', phone: '3330000002',
    craft: { statusEvents: [{date: '1850-02-02', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1850-05-01', meetingNumber: '20'}], roles: [{id: 'c2a', yearStart: Y25, roleName: 'Segretario', branch: 'CRAFT'}, {id: 'c2b', yearStart: Y24, roleName: 'Segretario', branch: 'CRAFT'}, {id: 'c2c', yearStart: Y23, roleName: 'Segretario', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [{date: '1855-03-03', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Compagno dell\'Arco Reale', date: '1855-03-03', meetingNumber: '5'}], roles: [{id: 'ch2a', yearStart: Y25, roleName: 'Lo Scriba Capo', branch: 'CHAPTER'}] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '3', matricula: '1003', firstName: 'Giuseppe', lastName: 'Mazzini', city: 'Genova', email: 'mazzini@giovine.it', phone: '3330000003',
    craft: { statusEvents: [{date: '1840-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1840-01-01', meetingNumber: '8'}], roles: [{id: 'c3a', yearStart: Y25, roleName: 'Cappellano', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1842-01-01', status: 'ACTIVE'}], isMotherLodgeMember: false, otherLodgeName: 'Loggia Propaganda', isDualMember: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1842-01-01', meetingNumber: '2'}], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [{date: '1845-06-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Marinaio dell\'Arca Reale', date: '1845-06-01', meetingNumber: '10'}], roles: [{id: 'r3a', yearStart: Y25, roleName: 'Comandante Noachita', branch: 'RAM'}] }
  },
  // --- UFFICIALI ATTUALI CRAFT (2025) ---
  {
    id: '4', matricula: '1004', firstName: 'Leonardo', lastName: 'Da Vinci', city: 'Vinci', email: 'leo@inventor.it', phone: '3330000004',
    craft: { statusEvents: [{date: '1480-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Installato', date: '1490-01-01', meetingNumber: '50'}], roles: [{id: 'c4a', yearStart: Y25, roleName: 'Maestro Venerabile', branch: 'CRAFT'}, {id: 'c4b', yearStart: Y24, roleName: 'Primo Sorvegliante', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1495-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1495-01-01', meetingNumber: '55'}], roles: [{id: 'm4a', yearStart: Y25, roleName: 'Primo Sorvegliante', branch: 'MARK'}] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '5', matricula: '1005', firstName: 'Michelangelo', lastName: 'Buonarroti', city: 'Firenze', email: 'miche@sculptor.it', phone: '3330000005',
    craft: { statusEvents: [{date: '1500-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1502-01-01', meetingNumber: '60'}], roles: [{id: 'c5a', yearStart: Y25, roleName: 'Primo Sorvegliante', branch: 'CRAFT'}, {id: 'c5b', yearStart: Y24, roleName: 'Secondo Sorvegliante', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [{date: '1505-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Compagno dell\'Arco Reale', date: '1505-01-01', meetingNumber: '65'}], roles: [{id: 'ch5a', yearStart: Y25, roleName: 'Il Sommo Sacerdote', branch: 'CHAPTER'}] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '6', matricula: '1006', firstName: 'Raffaello', lastName: 'Sanzio', city: 'Urbino', email: 'raff@painter.it', phone: '3330000006',
    craft: { statusEvents: [{date: '1505-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1507-01-01', meetingNumber: '70'}], roles: [{id: 'c6a', yearStart: Y25, roleName: 'Secondo Sorvegliante', branch: 'CRAFT'}, {id: 'c6b', yearStart: Y24, roleName: 'Primo Diacono', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  // --- TESORIERE E ELEMOSINIERE ---
  {
    id: '7', matricula: '1007', firstName: 'Enrico', lastName: 'Fermi', city: 'Roma', email: 'enrico@atomo.it', phone: '3330000007',
    craft: { statusEvents: [{date: '1925-06-15', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1925-06-15', meetingNumber: '101'}], roles: [{id: 'c7a', yearStart: Y25, roleName: 'Tesoriere', branch: 'CRAFT'}, {id: 'c7b', yearStart: Y24, roleName: 'Tesoriere', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1926-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1926-01-01', meetingNumber: '102'}], roles: [{id: 'm7a', yearStart: Y25, roleName: 'Tesoriere', branch: 'MARK'}] },
    chapter: { statusEvents: [{date: '1927-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Compagno dell\'Arco Reale', date: '1927-01-01', meetingNumber: '105'}], roles: [{id: 'ch7a', yearStart: Y25, roleName: 'Tesoriere', branch: 'CHAPTER'}] },
    ram: { statusEvents: [{date: '1928-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Marinaio dell\'Arca Reale', date: '1928-01-01', meetingNumber: '108'}], roles: [{id: 'r7a', yearStart: Y25, roleName: 'Tesoriere', branch: 'RAM'}] }
  },
  {
    id: '8', matricula: '1008', firstName: 'Sandro', lastName: 'Pertini', city: 'Savona', email: 'sandro@president.it', phone: '3330000008',
    craft: { statusEvents: [{date: '1945-04-25', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1946-01-01', meetingNumber: '120'}], roles: [{id: 'c8a', yearStart: Y25, roleName: 'Elemosiniere', branch: 'CRAFT'}, {id: 'c8b', yearStart: Y24, roleName: 'Elemosiniere', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  // --- UFFICIALI MINORI ---
  {
    id: '9', matricula: '1009', firstName: 'Dante', lastName: 'Alighieri', city: 'Firenze', email: 'dante@inferno.it', phone: '3330000009',
    craft: { statusEvents: [{date: '1300-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1302-01-01', meetingNumber: '33'}], roles: [{id: 'c9a', yearStart: Y25, roleName: 'Cappellano', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1305-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1305-01-01', meetingNumber: '40'}], roles: [{id: 'm9a', yearStart: Y25, roleName: 'Cappellano', branch: 'MARK'}] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [{date: '1310-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Marinaio dell\'Arca Reale', date: '1310-01-01', meetingNumber: '45'}], roles: [{id: 'r9a', yearStart: Y25, roleName: 'Guardiano', branch: 'RAM'}] }
  },
  {
    id: '10', matricula: '1010', firstName: 'Giacomo', lastName: 'Puccini', city: 'Lucca', email: 'giacomo@opera.it', phone: '3330000010',
    craft: { statusEvents: [{date: '1900-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1902-01-01', meetingNumber: '150'}], roles: [{id: 'c10a', yearStart: Y25, roleName: 'Organista', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '11', matricula: '1011', firstName: 'Federico', lastName: 'Fellini', city: 'Rimini', email: 'fede@cinema.it', phone: '3330000011',
    craft: { statusEvents: [{date: '1960-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1962-01-01', meetingNumber: '180'}], roles: [{id: 'c11a', yearStart: Y25, roleName: 'Direttore delle Cerimonie', branch: 'CRAFT'}, {id: 'c11b', yearStart: Y24, roleName: 'Direttore delle Cerimonie Agg.', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '12', matricula: '1012', firstName: 'Alessandro', lastName: 'Manzoni', city: 'Milano', email: 'alex@promessi.it', phone: '3330000012',
    craft: { statusEvents: [{date: '1830-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Compagno di Mestiere', date: '1831-01-01', meetingNumber: '22'}], roles: [{id: 'c12a', yearStart: Y25, roleName: 'Primo Diacono', branch: 'CRAFT'}, {id: 'c12b', yearStart: Y24, roleName: 'Secondo Diacono', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '13', matricula: '1013', firstName: 'Ugo', lastName: 'Foscolo', city: 'Zante', email: 'ugo@sepolcri.it', phone: '3330000013',
    craft: { statusEvents: [{date: '1800-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Compagno di Mestiere', date: '1801-01-01', meetingNumber: '15'}], roles: [{id: 'c13a', yearStart: Y25, roleName: 'Secondo Diacono', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '14', matricula: '1014', firstName: 'Guglielmo', lastName: 'Marconi', city: 'Bologna', email: 'guglielmo@radio.it', phone: '3330000014',
    craft: { statusEvents: [{date: '1900-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1902-01-01', meetingNumber: '160'}], roles: [{id: 'c14a', yearStart: Y25, roleName: 'Copritore Interno', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1905-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1905-01-01', meetingNumber: '165'}], roles: [{id: 'm14a', yearStart: Y25, roleName: 'Copritore', branch: 'MARK'}] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '15', matricula: '1015', firstName: 'Antonio', lastName: 'Meucci', city: 'Firenze', email: 'anto@telefono.it', phone: '3330000015',
    craft: { statusEvents: [{date: '1850-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1852-01-01', meetingNumber: '110'}], roles: [{id: 'c15a', yearStart: Y25, roleName: 'Copritore Esterno', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [{date: '1855-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Compagno dell\'Arco Reale', date: '1855-01-01', meetingNumber: '115'}], roles: [{id: 'ch15a', yearStart: Y25, roleName: 'Janitor', branch: 'CHAPTER'}] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  // --- ALTRI FRATELLI (SOLO MAESTRI O APPRENDISTI) ---
  {
    id: '16', matricula: '1016', firstName: 'Roberto', lastName: 'Benigni', city: 'Arezzo', email: 'bob@life.it', phone: '3330000016',
    craft: { statusEvents: [{date: '1990-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1992-01-01', meetingNumber: '250'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '17', matricula: '1017', firstName: 'Totò', lastName: 'De Curtis', city: 'Napoli', email: 'toto@principe.it', phone: '3330000017',
    craft: { statusEvents: [{date: '1950-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1952-01-01', meetingNumber: '200'}], roles: [{id: 'c17a', yearStart: Y23, roleName: 'Secondo Diacono', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1955-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1955-01-01', meetingNumber: '205'}], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '18', matricula: '1018', firstName: 'Enzo', lastName: 'Ferrari', city: 'Modena', email: 'enzo@rossa.it', phone: '3330000018',
    craft: { statusEvents: [{date: '1940-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1942-01-01', meetingNumber: '190'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '19', matricula: '1019', firstName: 'Luciano', lastName: 'Pavarotti', city: 'Modena', email: 'big@luciano.it', phone: '3330000019',
    craft: { statusEvents: [{date: '1980-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1982-01-01', meetingNumber: '230'}], roles: [{id: 'c19a', yearStart: Y25, roleName: 'Assistente Segretario', branch: 'CRAFT'}] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '20', matricula: '1020', firstName: 'Cristoforo', lastName: 'Colombo', city: 'Genova', email: 'chris@america.it', phone: '3330000020',
    craft: { statusEvents: [{date: '1490-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1492-10-12', meetingNumber: '60'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '21', matricula: '1021', firstName: 'Marco', lastName: 'Polo', city: 'Venezia', email: 'marco@milione.it', phone: '3330000021',
    craft: { statusEvents: [{date: '1290-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1295-01-01', meetingNumber: '30'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '22', matricula: '1022', firstName: 'Galileo', lastName: 'Galilei', city: 'Pisa', email: 'gali@stars.it', phone: '3330000022',
    craft: { statusEvents: [{date: '1600-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Installato', date: '1610-01-01', meetingNumber: '90'}], roles: [{id: 'c22a', yearStart: Y23, roleName: 'Maestro Venerabile', branch: 'CRAFT'}, {id: 'c22b', yearStart: Y24, roleName: 'IEM', branch: 'CRAFT'}] },
    mark: { statusEvents: [{date: '1615-01-01', status: 'ACTIVE'}], isMotherLodgeMember: true, degrees: [{degreeName: 'Maestro del Marchio', date: '1615-01-01', meetingNumber: '95'}], roles: [{id: 'm22a', yearStart: Y24, roleName: 'Maestro Venerabile', branch: 'MARK'}] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '23', matricula: '1023', firstName: 'Alessandro', lastName: 'Volta', city: 'Como', email: 'alex@watt.it', phone: '3330000023',
    craft: { statusEvents: [{date: '1800-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1805-01-01', meetingNumber: '110'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '24', matricula: '1024', firstName: 'Luigi', lastName: 'Pirandello', city: 'Agrigento', email: 'luigi@masks.it', phone: '3330000024',
    craft: { statusEvents: [{date: '1920-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1922-01-01', meetingNumber: '200'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '25', matricula: '1025', firstName: 'Gabriele', lastName: 'D\'Annunzio', city: 'Pescara', email: 'gabri@vater.it', phone: '3330000025',
    craft: { statusEvents: [{date: '1910-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Maestro Muratore', date: '1912-01-01', meetingNumber: '180'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  // --- NUOVI INIZIATI / APPRENDISTI ---
  {
    id: '26', matricula: '1026', firstName: 'Roberto', lastName: 'Baggio', city: 'Caldogno', email: 'rob@codino.it', phone: '3330000026',
    craft: { statusEvents: [{date: '2024-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Apprendista', date: '2024-01-01', meetingNumber: '300'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '27', matricula: '1027', firstName: 'Francesco', lastName: 'Totti', city: 'Roma', email: 'fra@pupone.it', phone: '3330000027',
    craft: { statusEvents: [{date: '2025-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Apprendista', date: '2025-01-01', meetingNumber: '310'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '28', matricula: '1028', firstName: 'Alessandro', lastName: 'Del Piero', city: 'Conegliano', email: 'alex@pint.it', phone: '3330000028',
    craft: { statusEvents: [{date: '2023-01-01', status: 'ACTIVE'}], degrees: [{degreeName: 'Compagno di Mestiere', date: '2024-06-01', meetingNumber: '305'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  // --- INATTIVI ---
  {
    id: '29', matricula: '1029', firstName: 'Niccolò', lastName: 'Machiavelli', city: 'Firenze', email: 'nicco@princ.it', phone: '3330000029',
    craft: { statusEvents: [{date: '1500-01-01', status: 'ACTIVE'}, {date: '1520-01-01', status: 'INACTIVE', note: 'Passato all\'Oriente Eterno'}], degrees: [{degreeName: 'Maestro Muratore', date: '1510-01-01', meetingNumber: '66'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  },
  {
    id: '30', matricula: '1030', firstName: 'Giordano', lastName: 'Bruno', city: 'Nola', email: 'gio@fire.it', phone: '3330000030',
    craft: { statusEvents: [{date: '1580-01-01', status: 'ACTIVE'}, {date: '1600-02-17', status: 'INACTIVE', note: 'Passato all\'Oriente Eterno'}], degrees: [{degreeName: 'Maestro Muratore', date: '1590-01-01', meetingNumber: '80'}], roles: [] },
    mark: { statusEvents: [], degrees: [], roles: [] },
    chapter: { statusEvents: [], degrees: [], roles: [] },
    ram: { statusEvents: [], degrees: [], roles: [] }
  }
];

class DataService {
  private members: Member[] = [];
  private settings: AppSettings = { lodgeName: '', lodgeNumber: '', province: '' };
  private STORAGE_KEY = 'masonic_app_data';
  private SETTINGS_KEY = 'masonic_app_settings';
  private VERSION_KEY = 'masonic_app_version';
  private DATA_VERSION = '2.4'; // Incrementing this forces a data reset
  public APP_VERSION = '0.14';

  constructor() {
    this.init();
  }

  private init() {
    const storedVersion = localStorage.getItem(this.VERSION_KEY);
    
    // Deep copy helper to avoid mutating the const MOCK_MEMBERS
    const loadMocks = () => JSON.parse(JSON.stringify(MOCK_MEMBERS));

    // If version mismatch or no data, force reset to MOCK_MEMBERS
    if (storedVersion !== this.DATA_VERSION) {
        console.log("New data version detected. Resetting database with fresh mocks.");
        this.members = loadMocks();
        this.persist();
        localStorage.setItem(this.VERSION_KEY, this.DATA_VERSION);
    } else {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.members = JSON.parse(stored);
        } else {
            this.members = loadMocks();
            this.persist();
        }
    }

    // Load Settings
    const storedSettings = localStorage.getItem(this.SETTINGS_KEY);
    if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
    }
  }

  private persist() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.members));
  }

  private persistSettings() {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
  }

  // In a real Firebase app, these methods would be async calls to Firestore
  
  async getMembers(): Promise<Member[]> {
    return new Promise((resolve) => {
      // Return a copy to avoid reference issues
      setTimeout(() => resolve(JSON.parse(JSON.stringify(this.members))), 100);
    });
  }

  async getMemberById(id: string): Promise<Member | undefined> {
    return new Promise((resolve) => {
      const member = this.members.find(m => m.id === id);
      setTimeout(() => resolve(member ? JSON.parse(JSON.stringify(member)) : undefined), 50);
    });
  }

  async saveMember(member: Member): Promise<Member> {
    return new Promise((resolve) => {
      const index = this.members.findIndex(m => m.id === member.id);
      if (index >= 0) {
        this.members[index] = member;
      } else {
        member.id = Date.now().toString(); // Simple ID generation
        this.members.push(member);
      }
      this.persist();
      setTimeout(() => resolve(member), 100);
    });
  }

  async deleteMember(id: string): Promise<void> {
    return new Promise((resolve) => {
      this.members = this.members.filter(m => m.id !== id);
      this.persist();
      setTimeout(() => resolve(), 100);
    });
  }

  async getSettings(): Promise<AppSettings> {
      return new Promise((resolve) => {
          setTimeout(() => resolve({ ...this.settings }), 50);
      });
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
      return new Promise((resolve) => {
          this.settings = settings;
          this.persistSettings();
          setTimeout(() => resolve(settings), 100);
      });
  }

  getEmptyMember(): Member {
    const defaultBranchData = { 
      statusEvents: [],
      degrees: [], 
      roles: [],
      isMotherLodgeMember: true, // Default to true
      isFounder: false
    };

    return {
      id: '',
      matricula: '',
      firstName: '',
      lastName: '',
      city: '',
      email: '',
      phone: '',
      // Craft initialized as active for new member today
      craft: { ...defaultBranchData, statusEvents: [{ date: new Date().toISOString().split('T')[0], status: 'ACTIVE', note: 'Iniziazione' }] }, 
      mark: { ...defaultBranchData },
      chapter: { ...defaultBranchData },
      ram: { ...defaultBranchData }
    };
  }
}

export const dataService = new DataService();