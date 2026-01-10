
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Layout, Users, LayoutDashboard, PlusCircle, Search, LogOut, Shield, Calendar, UserCog, BookOpen, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, List, Menu, X, Printer, Hash, MapPin, UserX, Settings, FileText, DollarSign, ClipboardList, Crown, Star, Key, User } from 'lucide-react';
import { Member, AppSettings } from './types';
import { PublicLodgeConfig } from './types/lodge';
import { dataService } from './services/dataService';
import { lodgeRegistry } from './services/lodgeRegistry';
import { LoginInterface } from './components/LoginInterface';
import { SetupWizard } from './components/SetupWizard';
import { InvalidLodge } from './components/InvalidLodge';
import { AuthSession, changePassword, clearSession, clearSupabaseSession, getStoredSession, loadActiveSession } from './utils/emailAuthService';
const MemberDetail = React.lazy(() => import('./components/MemberDetail').then(m => ({ default: m.MemberDetail })));
const RolesReport = React.lazy(() => import('./components/RolesReport').then(m => ({ default: m.RolesReport })));
const RoleAssignment = React.lazy(() => import('./components/RoleAssignment').then(m => ({ default: m.RoleAssignment })));
const Piedilista = React.lazy(() => import('./components/Piedilista').then(m => ({ default: m.Piedilista })));
const AdminPanel = React.lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const Legend = React.lazy(() => import('./components/Legend').then(m => ({ default: m.Legend })));
const RelazioneAnnuale = React.lazy(() => import('./components/RelazioneAnnuale').then(m => ({ default: m.RelazioneAnnuale })));
const RolesHistory = React.lazy(() => import('./components/RolesHistory').then(m => ({ default: m.RolesHistory })));
const Convocazioni = React.lazy(() => import('./components/Tornate').then(m => ({ default: m.Tornate })));
const SetupAdmin = React.lazy(() => import('./components/SetupAdmin').then(m => ({ default: m.SetupAdmin })));
const SuperadminConsole = React.lazy(() => import('./components/AdminConsole').then(m => ({ default: m.default })));
import { BRANCHES, getMasonicYear, isMemberActiveInYear, getDegreeAbbreviation, getDegreesByRitual } from './constants';

type View = 'DASHBOARD' | 'MEMBERS' | 'MEMBER_DETAIL' | 'REPORT' | 'ROLE_ASSIGNMENT' | 'ROLES_HISTORY' | 'PIEDILISTA' | 'ADMIN' | 'LEGEND' | 'PROCEDURES' | 'CAPITAZIONI' | 'RELAZIONE_ANNUALE' | 'CONVOCAZIONI';

// Inner app component that uses URL params
const AppContent: React.FC = () => {
  const { glriNumber } = useParams<{ glriNumber: string }>();
  
  // If no glriNumber in URL, show error
  if (!glriNumber) {
    return <InvalidLodge />;
  }

  return <AppWithLodge glriNumber={glriNumber} />;
};

// App component that receives glriNumber
interface AppWithLodgeProps {
  glriNumber: string;
}

const AppWithLodge: React.FC<AppWithLodgeProps> = ({ glriNumber }) => {
  const [currentLodge, setCurrentLodge] = useState<PublicLodgeConfig | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [lodgeLoadError, setLodgeLoadError] = useState<string | null>(null);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [isPasswordChangeForced, setIsPasswordChangeForced] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const openMenu = (menu: 'members' | 'roles' | 'secretary' | null) => {
    setIsMembersMenuOpen(menu === 'members');
    setIsRolesMenuOpen(menu === 'roles');
    setIsSecretaryMenuOpen(menu === 'secretary');
  };

  const toggleMenu = (menu: 'members' | 'roles' | 'secretary') => {
    const isOpen =
      (menu === 'members' && isMembersMenuOpen) ||
      (menu === 'roles' && isRolesMenuOpen) ||
      (menu === 'secretary' && isSecretaryMenuOpen);

    if (isOpen) {
      openMenu(null);
    } else {
      openMenu(menu);
    }
  };

  // Check if user must change password on first login
  useEffect(() => {
    if (currentUser?.mustChangePassword) {
      setShowChangePasswordModal(true);
      setIsPasswordChangeForced(true);
    }
  }, [currentUser]);

  // Check for saved lodge on mount and load config from URL param
  useEffect(() => {
    const initializeLodgeFromURL = async () => {
      try {
        setCheckingAuth(true);
        setLodgeLoadError(null);
        const config = await lodgeRegistry.getLodgeConfig(glriNumber);
        
        if (!config) {
          setLodgeLoadError(`Loggia ${glriNumber} non trovata nel registry`);
          setCheckingAuth(false);
          return;
        }
        
        setCurrentLodge(config);

        const activeSession = await loadActiveSession(config.supabaseUrl, config.supabaseAnonKey);
        
        // Initialize dataService (uses cache, won't duplicate client)
        dataService.initializeLodge(config);
        
        if (activeSession) {
          setCurrentUser(activeSession);
          setIsAuthenticated(true);
          setShowLogin(false);
        } else {
          const storedSession = getStoredSession();
          if (storedSession) {
            setCurrentUser(storedSession);
            setIsAuthenticated(true);
            setShowLogin(false);
          } else {
            setShowLogin(true);
          }
        }
        setCheckingAuth(false);
      } catch (err) {
        console.error('Error loading lodge config:', err);
        setLodgeLoadError(err instanceof Error ? err.message : 'Errore caricamento configurazione loggia');
        setCheckingAuth(false);
      }
    };
    
    initializeLodgeFromURL();
  }, [glriNumber]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);
  
  useEffect(() => {
    let title = `G.A.D.U. (${dataService.APP_VERSION})`;
    if (currentLodge) {
        title = `G.A.D.U. - ${currentLodge.lodgeName} ${currentLodge.glriNumber} (${dataService.APP_VERSION})`;
    }
    document.title = title;
  }, [currentLodge]);

  const loadData = async () => {
    try {
      setMembers(await dataService.getMembers()); 
      setAppSettings(await dataService.getSettings());
      setDataLoadError(null);
    } catch (err) {
      console.error('[APP] Error loading data:', err);
      setDataLoadError(err instanceof Error ? err.message : 'Errore caricamento dati');
    }
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
    // Validate returnView is still a valid view before returning to it
    const validViews: View[] = ['DASHBOARD', 'MEMBERS', 'REPORT', 'ROLE_ASSIGNMENT', 'ROLES_HISTORY', 'PIEDILISTA', 'ADMIN', 'LEGEND', 'PROCEDURES', 'CAPITAZIONI', 'RELAZIONE_ANNUALE', 'CONVOCAZIONI'];
    const safeReturnView = validViews.includes(returnView) ? returnView : 'MEMBERS';
    setCurrentView(safeReturnView);
    // Reset search/filter when returning to list view (issue #26)
    if (safeReturnView === 'MEMBERS') {
      setSearchTerm('');
      setFilterBranch('ALL');
    }
  };

  const handleSaveSettings = async (settings: AppSettings) => {
      await dataService.saveSettings(settings);
      // Reload fresh data from Supabase to ensure sync (especially for users and userChangelog)
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

  const handleLoginSuccess = (lodge: PublicLodgeConfig, session?: AuthSession) => {
    lodgeRegistry.saveCurrentLodge(lodge);
    dataService.initializeLodge(lodge);
    setCurrentLodge(lodge);

    const hydrateSession = async () => {
      try {
        const activeSession = session || (await loadActiveSession(lodge.supabaseUrl, lodge.supabaseAnonKey)) || getStoredSession();
        if (activeSession) {
          setCurrentUser(activeSession);
          console.log('[APP] User authenticated with privileges:', activeSession.privileges);
        }
      } finally {
        setShowLogin(false);
        setIsAuthenticated(true);
      }
    };

    void hydrateSession();
  };

  const handleLogout = async () => {
    const lodge = currentLodge;
    
    // Pulisci sessione Supabase e token
    if (lodge) {
      await clearSupabaseSession(lodge.supabaseUrl, lodge.supabaseAnonKey);
    }
    
    // Cancella TUTTO il localStorage per sicurezza
    localStorage.clear();
    
    // Pulisci registry
    lodgeRegistry.clearCurrentLodge();
    
    // Reset stato applicazione
    setCurrentLodge(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setMembers([]);
    setAppSettings({ lodgeName: '', lodgeNumber: '', province: '', dbVersion: 5 });
    
    // Reset search/filter state (issue #19)
    setSearchTerm('');
    setFilterBranch('ALL');
    
    // Redirect alla pagina iniziale (login)
    window.location.href = '/';
  };

  const handleChangePassword = async () => {
    if (!currentLodge || !currentUser) return;
    
    setPasswordError(null);
    setPasswordSuccess(false);
    
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('La password deve essere di almeno 8 caratteri');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono');
      return;
    }
    
    try {
      const updatedSession = await changePassword(
        newPassword,
        currentLodge.supabaseUrl,
        currentLodge.supabaseAnonKey,
        currentUser.userId || ''
      );

      setCurrentUser(updatedSession);
      
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      
      // Ricarica la sessione per aggiornare mustChangePassword
      if (isPasswordChangeForced && currentLodge) {
        setIsPasswordChangeForced(false);
      }
      
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || 'Errore durante il cambio password');
    }
  };

  // Show login interface if lodge found but not authenticated
  if (showLogin && currentLodge && !isAuthenticated) {
    return <LoginInterface glriNumber={glriNumber} onLoginSuccess={handleLoginSuccess} />;
  }

  // Hard-fail: show explicit lodge/config load error (no redirects)
  if (lodgeLoadError) {
    return <InvalidLodge title="Errore caricamento loggia" message={lodgeLoadError} />;
  }

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-masonic-gold mx-auto mb-4"></div>
          <p className="text-slate-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Render authenticated app
  const renderAuthenticatedApp = () => {
    const handleViewChange = (view: View) => {
      setCurrentView(view);
      setIsMobileMenuOpen(false);
      
      if (['MEMBERS', 'PIEDILISTA'].includes(view) || (view === 'MEMBER_DETAIL' && ['MEMBERS', 'PIEDILISTA'].includes(returnView))) {
        openMenu('members');
        return;
      }
      if (['ROLE_ASSIGNMENT', 'ROLES_HISTORY', 'REPORT'].includes(view)) {
        openMenu('roles');
        return;
      }
      if (['PROCEDURES', 'CAPITAZIONI', 'RELAZIONE_ANNUALE', 'CONVOCAZIONI'].includes(view)) {
        openMenu('secretary');
        return;
      }
      openMenu(null);
    };

  const filteredMembers = members.filter(m => {
    const matchesSearch = (m.firstName + ' ' + m.lastName + ' ' + m.matricula).toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterBranch === 'DB_ALL') return true;
    
    if (filterBranch === 'INACTIVE_YEAR_ALL') {
        const isActiveAnywhere = BRANCHES.some(b => {
               const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
             return isMemberActiveInYear(m[branchKey], selectedYear);
        });
        if (isActiveAnywhere) return false;

        const hasHistory = BRANCHES.some(b => {
            const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
            return (m[branchKey]?.degrees?.length > 0) || (m[branchKey]?.statusEvents?.length > 0);
        });
        return hasHistory;
    }

    if (filterBranch === 'INACTIVE_TOTAL_ALL') {
        const currentRealYear = new Date().getFullYear();
        const isActiveNow = BRANCHES.some(b => {
               const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
             return isMemberActiveInYear(m[branchKey], currentRealYear);
        });
        if (isActiveNow) return false;

        const hasHistory = BRANCHES.some(b => {
            const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
            return (m[branchKey]?.degrees?.length > 0) || (m[branchKey]?.statusEvents?.length > 0);
        });
        return hasHistory;
    }

    if (filterBranch === 'CRAFT_ONLY_NO_MARK') {
        return isMemberActiveInYear(m.craft, selectedYear) && !isMemberActiveInYear(m.mark, selectedYear);
    }
    if (filterBranch === 'CRAFT_ONLY_NO_ARCH') {
      return isMemberActiveInYear(m.craft, selectedYear) && !isMemberActiveInYear(m.arch, selectedYear);
    }
    if (filterBranch === 'CRAFT_ONLY_NO_RAM') {
        return isMemberActiveInYear(m.craft, selectedYear) && !isMemberActiveInYear(m.ram, selectedYear);
    }

    if (filterBranch === 'ALL') {
        return BRANCHES.some(b => {
             const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
             return isMemberActiveInYear(m[branchKey], selectedYear);
        });
    }
    
    const branchKey = filterBranch.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
    return isMemberActiveInYear(m[branchKey], selectedYear);
  }).sort((a, b) => a.lastName.localeCompare(b.lastName));

  const stats = {
    total: members.length,
    craft: members.filter(m => isMemberActiveInYear(m.craft, selectedYear)).length,
    mark: members.filter(m => isMemberActiveInYear(m.mark, selectedYear)).length,
    arch: members.filter(m => isMemberActiveInYear(m.arch, selectedYear)).length,
    ram: members.filter(m => isMemberActiveInYear(m.ram, selectedYear)).length,
  };

  // Secret setup admin page via URL param ?setup=TOKEN
  const setupToken = new URLSearchParams(window.location.search).get('setup');
  const envToken = (import.meta as any).env?.VITE_SETUP_SECRET;
  if (envToken && setupToken === envToken) {
    return (
      <React.Suspense fallback={<div className="p-6">Caricamento…</div>}>
        <SetupAdmin onComplete={() => {
          // After bootstrap, reload app normally
          window.history.replaceState({}, '', window.location.pathname);
        }} />
      </React.Suspense>
    );
  }

  // App shell
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
            {currentLodge ? (
                <div>
                    <h3 className="text-white font-serif font-bold">{currentLodge.lodgeName} N. {currentLodge.glriNumber}</h3>
                    <p className="text-xs text-slate-500">{currentLodge.province}</p>
                </div>
            ) : (
                <div className="text-xs text-slate-600 italic">Nessuna loggia configurata</div>
            )}
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => handleViewChange('DASHBOARD')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentView === 'DASHBOARD' ? 'bg-slate-800 text-white shadow-md border-l-4 border-masonic-gold' : 'hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard size={20} /> <span className="font-medium">Dashboard</span></button>
          
          <div>
            <button onClick={() => toggleMenu('members')} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all hover:bg-slate-800 hover:text-white ${isMembersMenuOpen || ['MEMBERS', 'PIEDILISTA', 'MEMBER_DETAIL'].includes(currentView) ? 'text-white' : ''}`}>
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
                </div>
            )}
          </div>

          <div>
            <button onClick={() => toggleMenu('roles')} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all hover:bg-slate-800 hover:text-white ${isRolesMenuOpen || ['ROLE_ASSIGNMENT', 'ROLES_HISTORY', 'REPORT'].includes(currentView) ? 'text-white' : ''}`}>
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
            <button onClick={() => toggleMenu('secretary')} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all hover:bg-slate-800 hover:text-white ${isSecretaryMenuOpen || ['PROCEDURES', 'CAPITAZIONI', 'RELAZIONE_ANNUALE', 'CONVOCAZIONI'].includes(currentView) ? 'text-white' : ''}`}>
               <div className="flex items-center gap-3"><FileText size={20} /> <span className="font-medium">Segreteria</span></div>
               {isSecretaryMenuOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
            {isSecretaryMenuOpen && (
                <div className="ml-8 mt-1 space-y-1 border-l border-slate-700 pl-2">
                    <button onClick={() => handleViewChange('CONVOCAZIONI')} className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${currentView === 'CONVOCAZIONI' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <FileText size={16} /> Convocazioni
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
            
            {currentLodge && (
              <div className="pt-2 border-t border-slate-800">
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-full text-left flex items-center justify-between hover:bg-slate-800/50 rounded-lg p-2 transition-colors group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <User size={16} className="text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">
                          {currentUser?.name || 'Utente'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          {currentUser?.email || 'email@loggia.it'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isUserMenuOpen && (
                    <div className="mt-1 bg-slate-800 rounded-lg border border-slate-700 shadow-lg overflow-hidden">
                      <button
                        onClick={() => {
                          setShowChangePasswordModal(true);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                      >
                        <Key size={14} />
                        Cambia Password
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                      >
                        <LogOut size={14} />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                {currentView === 'ADMIN' && 'Amministrazione'}
                {currentView === 'LEGEND' && 'Legenda e Requisiti'}
                {currentView === 'PROCEDURES' && 'Procedure'}
                {currentView === 'CONVOCAZIONI' && 'Convocazioni'}
                {currentView === 'CAPITAZIONI' && 'Capitazioni'}
                {currentView === 'RELAZIONE_ANNUALE' && 'Relazione Annuale'}
            </h2>
          </div>

          {currentView !== 'ADMIN' && (
            <div className="flex items-center gap-4">
             <div className="flex items-center bg-slate-100 rounded-md p-1 border border-slate-200">
                <button onClick={handleAddPastYear} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronLeft size={16} /></button>
                <div className="flex items-center px-2 border-l border-r border-slate-200 mx-1">
                  <Calendar size={16} className="text-slate-500 mr-2 hidden sm:block" />
                  <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer max-w-[150px] sm:max-w-none">
                    {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <button onClick={handleAddFutureYear} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronRight size={16} /></button>
             </div>
            </div>
          )}
        </header>
        {dataLoadError && (
          <div className="px-4 md:px-8 pt-4 print:hidden">
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex flex-col gap-3">
              <div>
                <p className="font-semibold">Errore caricamento dati</p>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-red-900/90">{dataLoadError}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setCurrentView('ADMIN');
                    setIsMobileMenuOpen(false);
                    openMenu(null);
                  }}
                  className="px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Apri Admin (ripulisci DB)
                </button>
                <button
                  onClick={loadData}
                  className="px-3 py-2 text-sm rounded-md border border-red-300 text-red-800 hover:bg-red-100 transition-colors"
                >
                  Riprova
                </button>
              </div>
            </div>
          </div>
        )}

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
                    <div className="text-masonic-red text-xs md:text-sm font-medium uppercase mb-1">Attivi Arco Reale {selectedYear}-{selectedYear+1}</div>
                    <div className="text-3xl font-bold text-slate-800">{stats.arch}</div>
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
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors" title="Cancella ricerca">
                      <X size={20} />
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg outline-none bg-white max-w-[250px]">
                    <option value="ALL">Tutti i Rami (Attivi)</option>
                    <option value="CRAFT">Attivi in Loggia</option>
                    <option value="MARK">Attivi nel Marchio</option>
                    <option value="ARCH">Attivi nell'Arco Reale</option>
                    <option value="RAM">Attivi in RAM</option>
                    <optgroup label="Potenziali Candidati">
                        <option value="CRAFT_ONLY_NO_MARK">Attivi Loggia (No Marchio)</option>
                      <option value="CRAFT_ONLY_NO_ARCH">Attivi Loggia (No Arco Reale)</option>
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
                <h2 className="text-xl font-bold mt-1">{currentLodge?.lodgeName} N. {currentLodge?.glriNumber}</h2>
                <h3 className="text-lg mt-2 font-serif text-slate-700">Registro Fratelli</h3>
                <p className="text-sm text-slate-500">Anno {selectedYear}</p>
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
                                 const branchKey = b.type.toLowerCase() as keyof Pick<Member, 'craft' | 'mark' | 'arch' | 'ram'>;
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

          {currentView === 'ADMIN' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento pannello admin...</div>}>
              <AdminPanel currentSettings={appSettings} onSave={handleSaveSettings} onDataChange={loadData} currentUserEmail={currentUser?.email} currentUserToken={currentUser?.accessToken} />
            </React.Suspense>
          )}

          {currentView === 'LEGEND' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento legenda...</div>}>
              <Legend />
            </React.Suspense>
          )}

          {currentView === 'MEMBER_DETAIL' && selectedMemberId && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento dettagli...</div>}>
              <MemberDetail memberId={selectedMemberId} onBack={() => setCurrentView(returnView)} onSave={handleSaveMember} defaultYear={selectedYear} appSettings={appSettings} currentUserEmail={currentUser?.email}/>
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
          {currentView === 'CONVOCAZIONI' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento convocazioni...</div>}>
              <Convocazioni settings={appSettings} selectedYear={selectedYear} onUpdate={loadData} />
            </React.Suspense>
          )}
          {currentView === 'RELAZIONE_ANNUALE' && (
            <React.Suspense fallback={<div className="text-center py-12">Caricamento relazione...</div>}>
              <RelazioneAnnuale members={members} selectedYear={selectedYear} settings={appSettings} />
            </React.Suspense>
          )}
        </div>
      </main>
      
      {/* Modale Cambio Password */}
      {showChangePasswordModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Impedisci chiusura con click sul backdrop se password change è forzato
            if (!isPasswordChangeForced && e.target === e.currentTarget) {
              setShowChangePasswordModal(false);
              setNewPassword('');
              setConfirmPassword('');
              setPasswordError(null);
              setPasswordSuccess(false);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-masonic-gold/10 rounded-full flex items-center justify-center">
                <Key className="text-masonic-gold" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                {isPasswordChangeForced ? 'Cambio Password Obbligatorio' : 'Cambia Password'}
              </h3>
            </div>
            
            {isPasswordChangeForced && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
                <p className="font-medium">Per motivi di sicurezza, devi cambiare la password prima di accedere all'applicazione.</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nuova Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-masonic-gold"
                  placeholder="Minimo 8 caratteri"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Conferma Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-masonic-gold"
                  placeholder="Ripeti la password"
                />
              </div>
              
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}
              
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  Password modificata con successo!
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              {!isPasswordChangeForced && (
                <button
                  onClick={() => {
                    // Reset password modal state on close (issue #18)
                    setShowChangePasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError(null);
                    setPasswordSuccess(false);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Annulla
                </button>
              )}
              <button
                onClick={handleChangePassword}
                disabled={passwordSuccess}
                className={`${isPasswordChangeForced ? 'w-full' : 'flex-1'} px-4 py-2 bg-masonic-gold text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

  // Main render with routing - no longer wraps BrowserRouter
  return renderAuthenticatedApp();
};

// Export main App with BrowserRouter
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/superadmin" element={
          <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-100">Caricamento superadmin...</div>}>
            <SuperadminConsole />
          </React.Suspense>
        } />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/:glriNumber/*" element={<AppContent />} />
        <Route path="/" element={<InvalidLodge />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
