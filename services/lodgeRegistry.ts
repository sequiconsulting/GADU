import { PublicLodgeConfig } from '../types/lodge';

class LodgeRegistryService {
  private cache = new Map<string, PublicLodgeConfig>();
  private cacheExpiry = 5 * 60 * 1000; // 5 min
  private lastFetch = 0;
  
  async getLodgeConfig(glriNumber: string): Promise<PublicLodgeConfig | null> {
    const cached = this.cache.get(glriNumber);
    if (cached && Date.now() - this.lastFetch < this.cacheExpiry) {
      return cached;
    }
    
    try {
      const response = await fetch(
        `/.netlify/functions/get-lodge-config?number=${glriNumber}`
      );
      
      if (response.status === 404) return null;
      if (!response.ok) {
        // Check if we got HTML instead of JSON (functions not available)
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/html')) {
          throw new Error('Netlify Functions not available. Use "netlify dev" instead of "npm run dev"');
        }

        let details = response.statusText;
        try {
          const payload = await response.json();
          details = payload?.error || payload?.message || details;
        } catch {
          // ignore JSON parse errors
        }

        throw new Error(`Errore caricamento configurazione loggia (${response.status}): ${details}`);
      }
      
      const config: PublicLodgeConfig = await response.json();
      this.cache.set(glriNumber, config);
      this.lastFetch = Date.now();
      
      return config;
    } catch (error) {
      console.error('Registry error:', error);
      throw error;
    }
  }
  
  saveCurrentLodge(config: PublicLodgeConfig): void {
    localStorage.setItem('gadu_current_lodge', JSON.stringify(config));
  }
  
  getCurrentLodge(): PublicLodgeConfig | null {
    const stored = localStorage.getItem('gadu_current_lodge');
    return stored ? JSON.parse(stored) : null;
  }
  
  clearCurrentLodge(): void {
    localStorage.removeItem('gadu_current_lodge');
    sessionStorage.clear();
  }
  
  formatLodgeName(config: PublicLodgeConfig): string {
    return `Loggia ${config.lodgeName} n. ${config.glriNumber} - ${config.province}`;
  }
}

export const lodgeRegistry = new LodgeRegistryService();
