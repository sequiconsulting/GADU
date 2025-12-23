
import React, { useState, useEffect } from 'react';
import { Layout, Users, LayoutDashboard, PlusCircle, Search, LogOut, Shield, Calendar, UserCog, BookOpen, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, List, Menu, X, Printer, Hash, MapPin, UserX, Settings, FileText, DollarSign, ClipboardList, Crown, Star } from 'lucide-react';
import { Member, AppSettings } from './types';
import { dataService } from './services/dataService';
const MemberDetail = React.lazy(() => import('./components/MemberDetail').then(m => ({ default: m.MemberDetail })));
const RolesReport = React.lazy(() => import('./components/RolesReport').then(m => ({ default: m.RolesReport })));
const RoleAssignment = React.lazy(() => import('./components/RoleAssignment').then(m => ({ default: m.RoleAssignment })));
const Piedilista = React.lazy(() => import('./components/Piedilista').then(m => ({ default: m.Piedilista })));
const InactiveMembers = React.lazy(() => import('./components/InactiveMembers').then(m => ({ default: m.InactiveMembers })));
const AdminPanel = React.lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const Legend = React.lazy(() => import('./components/Legend').then(m => ({ default: m.Legend })));
const RelazioneAnnuale = React.lazy(() => import('./components/RelazioneAnnuale').then(m => ({ default: m.RelazioneAnnuale })));
const RolesHistory = React.lazy(() => import('./components/RolesHistory').then(m => ({ default: m.RolesHistory })));
const Tornate = React.lazy(() => import('./components/Tornate').then(m => ({ default: m.Tornate })));
import { BRANCHES, getMasonicYear, isMemberActiveInYear, getDegreeAbbreviation, getDegreesByRitual } from './constants';

type View = 'DASHBOARD' | 'MEMBERS' | 'MEMBER_DETAIL' | 'REPORT' | 'ROLE_ASSIGNMENT' | 'ROLES_HISTORY' | 'PIEDILISTA' | 'INACTIVE_MEMBERS' | 'ADMIN' | 'LEGEND' | 'PROCEDURES' | 'CAPITAZIONI' | 'RELAZIONE_ANNUALE' | 'TORNATE';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [returnView, setReturnView] = useState<View>('MEMBERS');
  const [members, setMembers] = useState<Member[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ 
    lodgeName: '', 
    lodgeNumber: '', 
    province: '',
    dbVersion: 5
  });
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const currentCivilYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentCivilYear);
  const [yearOptions, setYearOptions] = useState<number[]>(Array.from({length: 8}, (_, i) => currentCivilYear - 5 + i));
  
  const [isMembersMenuOpen, setIsMembersMenuOpen] = useState(true);
  const [isRolesMenuOpen, setIsRolesMenuOpen] = useState(false);
  const [isSecretaryMenuOpen, setIsSecretaryMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => { 
      loadData(); 
  }, []);

  useEffect(() => {
    let title = `G.A.D.U. (${dataService.APP_VERSION})`;
    if (appSettings.lodgeName) {
        title = `G.A.D.U. - ${appSettings.lodgeName} ${appSettings.lodgeNumber} (${dataService.APP_VERSION})`;
    }
    document.title = title;
  }, [appSettings]);

  const loadData = async () => { 
      setMembers(await dataService.getMembers()); 
      setAppSettings(await dataService.getSettings());
  };

  const handleMemberClick = (id: string, origin: View = 'MEMBERS') => {
    setSelectedMemberId(id);
    setReturnView(origin);
    setCurrentView('MEMBER_DETAIL');
    setIsMobileMenuOpen(false);
  };

  const handleCreateMember = () => {
    setSelectedMemberId('new');
    setReturnView('MEMBERS');
    setCurrentView('MEMBER_DETAIL');
    setIsMobileMenuOpen(false);
  };

  const handleSaveMember = async () => {
    await loadData();
    setCurrentView(returnView);
  };

  const handleSaveSettings = async (settings: AppSettings) => {
      await dataService.saveSettings(settings);
      // Reload fresh data from Firestore to ensure sync (especially for users and userChangelog)
      await loadData();
  };

  const handleAddFutureYear = () => {
    const nextYear = selectedYear + 1;
    if (!yearOptions.includes(nextYear)) {
      setYearOptions(prev => [...prev, nextYear]);
    }
    setSelectedYear(nextYear);
  };

  const handleAddPastYear = () => {
    const prevYear = selectedYear - 1;
    if (!yearOptions.includes(prevYear)) {
      setYearOptions(prev => [prevYear, ...prev]);
    }
    setSelectedYear(prevYear);
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
    
    if (['MEMBERS', 'PIEDILISTA', 'INACTIVE_MEMBERS'].includes(view) || (view === 'MEMBER_DETAIL' && ['MEMBERS', 'PIEDILISTA', 'INACTIVE_MEMBERS'].includes(returnView))) {
        setIsMembersMenuOpen(true);
    }
    if (['ROLE_ASSIGNMENT', 'ROLES_HISTORY', 'REPORT'].includes(view)) {
        setIsRolesMenuOpen(true);
    }
    if (['PROCEDURES', 'CAPITAZIONI', 'RELAZIONE_ANNUALE', 'TORNATE'].includes(view)) {
        setIsSecretaryMenuOpen(true);
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = (m.firstName + ' ' + m.lastName + ' ' + m.matricula).toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterBranch === 'DB_ALL') return true;
    
    if (filterBranch === 'INACTIVE_YEAR_ALL') {
        const isActiveAnywhere = BRANCHES.some(b => {
             const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
             return isMemberActiveInYear(m[branchKey], selectedYear);
        });
        if (isActiveAnywhere) return false;

        const hasHistory = BRANCHES.some(b => {
            const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
            return (m[branchKey]?.degrees?.length > 0) || (m[branchKey]?.statusEvents?.length > 0);
        });
        return hasHistory;
    }

    if (filterBranch === 'INACTIVE_TOTAL_ALL') {
        const currentRealYear = new Date().getFullYear();
        const isActiveNow = BRANCHES.some(b => {
             const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
             return isMemberActiveInYear(m[branchKey], currentRealYear);
        });
        if (isActiveNow) return false;

        const hasHistory = BRANCHES.some(b => {
            const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
            return (m[branchKey]?.degrees?.length > 0) || (m[branchKey]?.statusEvents?.length > 0);
        });
        return hasHistory;
    }

    if (filterBranch === 'CRAFT_ONLY_NO_MARK') {
        return isMemberActiveInYear(m.craft, selectedYear) && !isMemberActiveInYear(m.mark, selectedYear);
    }
    if (filterBranch === 'CRAFT_ONLY_NO_CHAPTER') {
        return isMemberActiveInYear(m.craft, selectedYear) && !isMemberActiveInYear(m.chapter, selectedYear);
    }
    if (filterBranch === 'CRAFT_ONLY_NO_RAM') {
        return isMemberActiveInYear(m.craft, selectedYear) && !isMemberActiveInYear(m.ram, selectedYear);
    }

    if (filterBranch === 'ALL') {
        return BRANCHES.some(b => {
             const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
             return isMemberActiveInYear(m[branchKey], selectedYear);
        });
    }
    
    const branchKey = filterBranch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
    return isMemberActiveInYear(m[branchKey], selectedYear);
  }).sort((a, b) => a.lastName.localeCompare(b.lastName));

  const stats = {
    total: members.length,
    craft: members.filter(m => isMemberActiveInYear(m.craft, selectedYear)).length,
    mark: members.filter(m => isMemberActiveInYear(m.mark, selectedYear)).length,
    chapter: members.filter(m => isMemberActiveInYear(m.chapter, selectedYear)).length,
    ram: members.filter(m => isMemberActiveInYear(m.ram, selectedYear)).length,
  };

  // TEMPORARY: Cleanup function for test database
  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden print:h-auto print:overflow-visible">
      
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} print:hidden`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 text-masonic-gold">
                <Layout size={28} />
                <div className="flex items-baseline gap-2">
                    <h1 className="text-xl font-serif font-bold tracking-widest text-white">G.A.D.U.</h1>
                    <span className="text-[10px] text-slate-400 font-sans tracking-normal">v{dataService.APP_VERSION}/{dataService.DB_VERSION}</span>
                </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 uppercase tracking-wide">Gestione Associazioni Decisamente User-friendly</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800">
            {appSettings.lodgeName ? (
                <div>
                    <h3 className="text-white font-serif font-bold">{appSettings.lodgeName} N. {appSettings.lodgeNumber}</h3>
                    <p className="text-xs text-slate-500">{appSettings.province}</p>
                </div>
            ) : (
                <div className="text-xs text-slate-600 italic">Nessuna loggia configurata</div>
            )}
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => handleViewChange('DASHBOARD')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'DASHBOARD' ? 'bg-slate-800 text-white shadow-md border-l-4 border-masonic-gold' : 'hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard size={20} /> <span className="font-medium">Dashboard</span></button>
          
          <div>
            <button onClick={() => setIsMembersMenuOpen(!isMembersMenuOpen)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all hover:bg-slate-800 hover:text-white ${isMembersMenuOpen || ['MEMBERS', 'PIEDILISTA', 'MEMBER_DETAIL', 'INACTIVE_MEMBERS'].includes(currentView) ? 'text-white' : ''}`}>
               <div className="flex items-center gap-3"><Users size={20} /> <span className="font-medium">Anagrafiche</span></div>
               {isMembersMenuOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
            {isMembersMenuOpen && (
                <div className="ml-8 mt-1 space-y-1 border-l border-slate-700 pl-2">
                    <button onClick={() => handleViewChange('MEMBERS')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'MEMBERS' || (currentView === 'MEMBER_DETAIL' && returnView === 'MEMBERS') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <List size={16} /> Registro Fratelli
                    </button>
                    <button onClick={() => handleViewChange('PIEDILISTA')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'PIEDILISTA' || (currentView === 'MEMBER_DETAIL' && returnView === 'PIEDILISTA') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <BookOpen size={16} /> Piedilista
                    </button>
                    <button onClick={() => handleViewChange('INACTIVE_MEMBERS')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'INACTIVE_MEMBERS' || (currentView === 'MEMBER_DETAIL' && returnView === 'INACTIVE_MEMBERS') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <UserX size={16} /> Archivio Inattivi
                    </button>
                </div>
            )}
          </div>

          <div>
            <button onClick={() => setIsRolesMenuOpen(!isRolesMenuOpen)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all hover:bg-slate-800 hover:text-white ${isRolesMenuOpen || ['ROLE_ASSIGNMENT', 'ROLES_HISTORY', 'REPORT'].includes(currentView) ? 'text-white' : ''}`}>
               <div className="flex items-center gap-3"><Shield size={20} /> <span className="font-medium">Gestione Ufficiali</span></div>
               {isRolesMenuOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
            {isRolesMenuOpen && (
                <div className="ml-8 mt-1 space-y-1 border-l border-slate-700 pl-2">
                    <button onClick={() => handleViewChange('ROLE_ASSIGNMENT')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'ROLE_ASSIGNMENT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <UserCog size={16} /> Ruoli
                    </button>
                    <button onClick={() => handleViewChange('ROLES_HISTORY')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'ROLES_HISTORY' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <BookOpen size={16} /> Storico Ruoli
                    </button>
                    <button onClick={() => handleViewChange('REPORT')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'REPORT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <Shield size={16} /> Organigramma
                    </button>
                </div>
            )}
          </div>

          <div>
            <button onClick={() => setIsSecretaryMenuOpen(!isSecretaryMenuOpen)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all hover:bg-slate-800 hover:text-white ${isSecretaryMenuOpen || ['PROCEDURES', 'CAPITAZIONI', 'RELAZIONE_ANNUALE', 'TORNATE'].includes(currentView) ? 'text-white' : ''}`}>
               <div className="flex items-center gap-3"><FileText size={20} /> <span className="font-medium">Segreteria</span></div>
               {isSecretaryMenuOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
            {isSecretaryMenuOpen && (
                <div className="ml-8 mt-1 space-y-1 border-l border-slate-700 pl-2">
                    <button onClick={() => handleViewChange('TORNATE')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'TORNATE' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <FileText size={16} /> Tornate
                    </button>
                    <button onClick={() => handleViewChange('CAPITAZIONI')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'CAPITAZIONI' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <DollarSign size={16} /> Capitazioni
                    </button>
                    <button onClick={() => handleViewChange('RELAZIONE_ANNUALE')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'RELAZIONE_ANNUALE' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <ClipboardList size={16} /> Relazione Annuale
                    </button>
                </div>
            )}
          </div>
          
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-2">
            <button onClick={() => handleViewChange('LEGEND')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'LEGEND' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                <BookOpen size={16} /> Legenda
            </button>
            <button onClick={() => handleViewChange('ADMIN')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'ADMIN' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Settings size={16} /> Admin
            </button>
            <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full px-4 py-2">
                <LogOut size={16} /> Logout
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
        <header className="bg-white shadow-sm min-h-16 flex items-center px-4 md:px-8 justify-between sticky top-0 z-20 print:hidden flex-wrap py-2 md:py-0 gap-2">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                <Menu size={24} />
             </button>
             <h2 className="text-base md:text-lg font-medium text-slate-700 truncate">
                {currentView === 'DASHBOARD' && 'Panoramica'}
                {currentView === 'MEMBERS' && 'Elenco Associati'}
                {currentView === 'MEMBER_DETAIL' && 'Dettaglio Associato'}
                {currentView === 'ROLE_ASSIGNMENT' && 'Gestione Ufficiali'}
                {currentView === 'ROLES_HISTORY' && 'Storico Ruoli'}
                {currentView === 'REPORT' && 'Report Ruoli'}
                {currentView === 'PIEDILISTA' && 'Piedilista'}
                {currentView === 'INACTIVE_MEMBERS' && 'Archivio Fratelli Inattivi'}
                {currentView === 'ADMIN' && 'Amministrazione'}
                {currentView === 'LEGEND' && 'Legenda e Requisiti'}
                {currentView === 'PROCEDURES' && 'Procedure'}
                {currentView === 'TORNATE' && 'Tornate'}
                {currentView === 'CAPITAZIONI' && 'Capitazioni'}
                {currentView === 'RELAZIONE_ANNUALE' && 'Relazione Annuale'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center bg-slate-100 rounded-md p-1 border border-slate-200">
                <button onClick={handleAddPastYear} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronLeft size={16} /></button>
                <div className="flex items-center px-2 border-l border-r border-slate-200 mx-1">
                  <Calendar size={16} className="text-slate-500 mr-2 hidden sm:block" />
                  <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer max-w-[150px] sm:max-w-none">
                    {yearOptions.map(year => <option key={year} value={year}>{year}-{year + 1} | A.L. {getMasonicYear(year)}</option>)}
                  </select>
                </div>
                <button onClick={handleAddFutureYear} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronRight size={16} /></button>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible print:h-auto">
          {currentView === 'DASHBOARD' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium uppercase mb-1">Anagrafiche Totali</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.total}</div>
                 </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-masonic-blue">
                    <div className="text-masonic-blue text-xs md:text-sm font-medium uppercase mb-1">Attivi Craft {selectedYear}-{selectedYear+1}</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.craft}</div>
                 </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-masonic-red">
                    <div className="text-masonic-red text-xs md:text-sm font-medium uppercase mb-1">Attivi Capitolo {selectedYear}-{selectedYear+1}</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.chapter}</div>
                 </div>
                 <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-masonic-mark">
                    <div className="text-masonic-mark text-xs md:text-sm font-medium uppercase mb-1">Attivi Marchio {selectedYear}-{selectedYear+1}</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.mark}</div>
                 </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-serif font-bold text-lg text-slate-800 mb-4">Accesso Rapido</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={handleCreateMember} className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"><PlusCircle size={18} /> Nuova Anagrafica</button>
                  <button onClick={() => setCurrentView('ROLE_ASSIGNMENT')} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"><UserCog size={18} /> Assegna Ruoli</button>
                  <button onClick={() => setCurrentView('PIEDILISTA')} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"><BookOpen size={18} /> Vai al Piedilista</button>
                </div>
              </div>
            </div>
          )}

          {currentView === 'MEMBERS' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200 print:hidden">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
                  <input type="text" placeholder="Cerca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white max-w-[250px]">
                    <option value="ALL">Tutti i Rami (Attivi)</option>
                    <option value="CRAFT">Attivi in Loggia</option>
                    <option value="MARK">Attivi nel Marchio</option>
                    <option value="CHAPTER">Attivi nel Capitolo</option>
                    <option value="RAM">Attivi in RAM</option>
                    <optgroup label="Potenziali Candidati">
                        <option value="CRAFT_ONLY_NO_MARK">Attivi Loggia (No Marchio)</option>
                        <option value="CRAFT_ONLY_NO_CHAPTER">Attivi Loggia (No Capitolo)</option>
                        <option value="CRAFT_ONLY_NO_RAM">Attivi Loggia (No RAM)</option>
                    </optgroup>
                    <optgroup label="Membri Inattivi">
                        <option value="INACTIVE_YEAR_ALL">Inattivi (Anno Corrente)</option>
                        <option value="INACTIVE_TOTAL_ALL">Inattivi (Ad Oggi/Totale)</option>
                    </optgroup>
                    <option value="DB_ALL">Tutto il Database (Nessun Filtro)</option>
                    </select>
                    <button onClick={() => window.print()} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 font-medium shadow-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
                        <Printer size={18} /> Stampa
                    </button>
                    <button onClick={handleCreateMember} className="bg-masonic-gold text-white px-6 py-2 rounded-lg hover:bg-yellow-600 font-medium shadow-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"><PlusCircle size={18} /> Nuovo</button>
                </div>
              </div>

              <div className="hidden print:block text-center mb-6">
                <h1 className="text-3xl font-serif font-bold">G.A.D.U.</h1>
                <h2 className="text-xl font-bold mt-1">{appSettings.lodgeName} N. {appSettings.lodgeNumber}</h2>
                <h3 className="text-lg mt-2 font-serif text-slate-700">Registro Fratelli</h3>
                <p className="text-sm text-slate-500">Anno {selectedYear}-{selectedYear+1}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 uppercase tracking-wider print:border-b-2 print:border-slate-400">
                            <tr>
                                <th className="px-4 py-3 w-20"><div className="flex items-center gap-1"><Hash size={14}/> Matr.</div></th>
                                <th className="px-4 py-3">Fratello</th>
                                <th className="px-4 py-3 hidden sm:table-cell"><div className="flex items-center gap-1"><MapPin size={14}/> Città</div></th>
                                <th className="px-4 py-3 w-1/3">Stato Massonico</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMembers.map(member => {
                                const degreeInfos = BRANCHES.map(b => {
                                     const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'chapter' | 'ram'>;
                                     const branchData = member[branchKey];
                                     const isActive = isMemberActiveInYear(branchData, selectedYear);
                                     
                                     if (!isActive && filterBranch !== 'DB_ALL') return null;
                                     if (!isActive) return null;
                                     
                                     const degrees = branchData?.degrees;
                                     const highestDegree = degrees && degrees.length > 0 ? degrees[degrees.length - 1].degreeName : '';
                                     
                                     if (!highestDegree) return null;
                                     
                                     const badges = [];
                                     if (branchData?.isFounder) badges.push({ icon: 'crown', color: 'text-yellow-600', title: 'Fondatore' });
                                     if (branchData?.isHonorary) badges.push({ icon: 'star', color: 'text-amber-500', title: 'Onorario' });
                                     if (branchData?.isDualAppartenance) badges.push({ icon: 'users', color: 'text-blue-600', title: 'Doppia Appartenenza' });

                                     return { 
                                         label: b.shortLabel, 
                                         val: getDegreeAbbreviation(highestDegree),
                                         color: b.color,
                                         fullName: highestDegree,
                                         badges: badges
                                     };
                                }).filter(Boolean);

                                return (
                                    <tr key={member.id} onClick={() => handleMemberClick(member.id, 'MEMBERS')} className="hover:bg-slate-50 cursor-pointer transition-colors group break-inside-avoid">
                                        <td className="px-4 py-3 font-mono text-slate-500">{member.matricula}</td>
                                        <td className="px-4 py-3 font-bold text-slate-800 group-hover:text-masonic-blue transition-colors">
                                            {member.lastName} {member.firstName}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{member.city || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                {degreeInfos.length > 0 ? (
                                                    degreeInfos.map((info, i) => (
                                                        <span key={i} title={info.fullName} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 whitespace-nowrap print:border-slate-400">
                                                            <span className={`w-2 h-2 rounded-full ${info?.color} print:border print:border-slate-600`}></span>
                                                            <span className="text-slate-500">{info?.label}:</span>
                                                            <div className="flex items-center gap-1">
                                                              <span className="font-bold">{info?.val}</span>
                                                              {info.badges?.map((badge, idx) => (
                                                                <span key={idx} title={badge.title} className="flex items-center">
                                                                  {badge.icon === 'crown' && <Crown size={12} className={`${badge.color} shrink-0`} />}
                                                                  {badge.icon === 'star' && <Star size={12} className={`${badge.color} fill-amber-500 shrink-0`} />}
                                                                  {badge.icon === 'users' && <Users size={12} className={`${badge.color} shrink-0`} />}
                                                                </span>
                                                              ))}
                                                            </div>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-300 italic text-xs">-</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                        Nessun associato trovato con i filtri correnti.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}

          {currentView === 'INACTIVE_MEMBERS' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento archivio inattivi...</div>}>
               <InactiveMembers 
                  members={members} 
                  onMemberClick={(id) => handleMemberClick(id, 'INACTIVE_MEMBERS')} 
                  selectedYear={selectedYear} 
                  mode="TOTAL" 
                  lodgeName={appSettings.lodgeName}
                  lodgeNumber={appSettings.lodgeNumber}
               />
            </React.Suspense>
          )}

          {currentView === 'ADMIN' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento pannello admin...</div>}>
              <AdminPanel currentSettings={appSettings} onSave={handleSaveSettings} />
            </React.Suspense>
          )}

          {currentView === 'LEGEND' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento legenda...</div>}>
              <Legend />
            </React.Suspense>
          )}

          {currentView === 'MEMBER_DETAIL' && selectedMemberId && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento dettagli...</div>}>
              <MemberDetail memberId={selectedMemberId} onBack={() => setCurrentView(returnView)} onSave={handleSaveMember} defaultYear={selectedYear} appSettings={appSettings}/>
            </React.Suspense>
          )}
          {currentView === 'ROLE_ASSIGNMENT' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento Ruoli...</div>}>
              <RoleAssignment members={members} selectedYear={selectedYear} onUpdate={loadData} settings={appSettings}/>
            </React.Suspense>
          )}
          {currentView === 'PIEDILISTA' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento piedilista...</div>}>
              <Piedilista members={members} selectedYear={selectedYear} onMemberClick={(id) => handleMemberClick(id, 'PIEDILISTA')} lodgeName={appSettings.lodgeName} lodgeNumber={appSettings.lodgeNumber} />
            </React.Suspense>
          )}
          {currentView === 'REPORT' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento report...</div>}>
              <RolesReport members={members} selectedYear={selectedYear} lodgeName={appSettings.lodgeName} lodgeNumber={appSettings.lodgeNumber} settings={appSettings} />
            </React.Suspense>
          )}
          {currentView === 'ROLES_HISTORY' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento storico ruoli...</div>}>
              <RolesHistory members={members} selectedYear={selectedYear} appSettings={appSettings} />
            </React.Suspense>
          )}
          {currentView === 'PROCEDURES' && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-600">Procedure</h3>
              <p className="text-slate-500 mt-2">Sezione in sviluppo</p>
            </div>
          )}
          {currentView === 'CAPITAZIONI' && (
            <div className="text-center py-12">
              <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-600">Capitazioni</h3>
              <p className="text-slate-500 mt-2">Sezione in sviluppo</p>
            </div>
          )}
          {currentView === 'TORNATE' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento tornate...</div>}>
              <Tornate settings={appSettings} selectedYear={selectedYear} onUpdate={loadData} />
            </React.Suspense>
          )}
          {currentView === 'RELAZIONE_ANNUALE' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento relazione...</div>}>
              <RelazioneAnnuale members={members} selectedYear={selectedYear} settings={appSettings} />
            </React.Suspense>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
