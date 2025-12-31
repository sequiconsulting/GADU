import { PublicLodgeConfig } from '../types/lodge';

class DemoModeService {
  getDemoConfig(): PublicLodgeConfig {
    return {
      glriNumber: import.meta.env.VITE_DEMO_LODGE_NUMBER || '999',
      lodgeName: import.meta.env.VITE_DEMO_LODGE_NAME || 'Loggia Demo',
      province: import.meta.env.VITE_DEMO_PROVINCE || 'DEMO',
      supabaseUrl: import.meta.env.VITE_DEMO_SUPABASE_URL!,
      supabaseAnonKey: import.meta.env.VITE_DEMO_SUPABASE_ANON_KEY!
    };
  }
  
  isDemoAvailable(): boolean {
    return !!(
      import.meta.env.VITE_DEMO_SUPABASE_URL &&
      import.meta.env.VITE_DEMO_SUPABASE_ANON_KEY
    );
  }
  
  activateDemoMode(): void {
    sessionStorage.setItem('gadu_is_demo', 'true');
    localStorage.setItem('gadu_current_lodge', JSON.stringify(this.getDemoConfig()));
  }
  
  isDemoMode(): boolean {
    return sessionStorage.getItem('gadu_is_demo') === 'true';
  }
  
  exitDemoMode(): void {
    sessionStorage.removeItem('gadu_is_demo');
    localStorage.removeItem('gadu_current_lodge');
  }
}

export const demoMode = new DemoModeService();
