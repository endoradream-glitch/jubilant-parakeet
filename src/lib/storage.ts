export interface OfflinePatrolData {
  ptlName: string;
  comd: string;
  str: string;
  wpn: string;
  ammo: string;
  purpose: string;
  authCode: string;
  timestamp: number;
}

export interface OfflineLocationUpdate {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface StoredPatrolData {
  id: string;
  code: string;
  ptlName: string;
  comd: string;
  str: string;
  wpn: string;
  ammo: string;
  purpose: string;
  location: { lat: number; lng: number; } | null;
  status: "active" | "offline" | "pending";
  lastSeen: string | Date;
  startTime: string | Date;
  lastUpdate: number;
}

class StorageService {
  private readonly LOCATION_QUEUE_KEY = "location_queue";

  // Authorization
  saveAuthCode(code: string): void {
    localStorage.setItem("patrol_auth_code", code);
  }

  getAuthCode(): string | null {
    return localStorage.getItem("patrol_auth_code");
  }

  clearAuthCode(): void {
    localStorage.removeItem("patrol_auth_code");
  }

  // Patrol Data
  savePatrolData(data: OfflinePatrolData): void {
    localStorage.setItem("patrol_data", JSON.stringify(data));
  }

  getPatrolData(): OfflinePatrolData | null {
    try {
      const data = localStorage.getItem("patrol_data");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  clearPatrolData(): void {
    localStorage.removeItem("patrol_data");
  }

  // Location Queue (for offline mode)
  queueLocationUpdate(location: OfflineLocationUpdate): void {
    const queue = this.getLocationQueue();
    // Ensure accuracy is defined or handle it. Here we just push strictly compliant objects if needed, 
    // but better to align types. 
    // We cast to any or create a compatible object to store.
    queue.push(location as any); 
    
    // Keep only last 100 locations to avoid storage overflow
    if (queue.length > 100) {
      queue.shift();
    }
    
    localStorage.setItem(this.LOCATION_QUEUE_KEY, JSON.stringify(queue));
  }

  getLocationQueue(): OfflineLocationUpdate[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(this.LOCATION_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  queueOfflineMessage(message: any) {
    if (typeof window === "undefined") return;
    const queue = this.getOfflineQueue();
    queue.push(message);
    localStorage.setItem("mqtt_offline_queue", JSON.stringify(queue));
  }

  getOfflineQueue(): any[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("mqtt_offline_queue");
    return stored ? JSON.parse(stored) : [];
  }

  clearOfflineQueue() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("mqtt_offline_queue");
  }

  clearLocationQueue(): void {
    localStorage.removeItem("location_queue");
  }

  // Patrol Status
  setPatrolActive(active: boolean): void {
    localStorage.setItem("patrol_active", active.toString());
  }

  isPatrolActive(): boolean {
    return localStorage.getItem("patrol_active") === "true";
  }

  // HQ - Active Patrols Management
  saveActivePatrols(patrols: StoredPatrolData[]): void {
    const serialized = patrols.map(p => ({
      ...p,
      lastSeen: p.lastSeen instanceof Date ? p.lastSeen.toISOString() : p.lastSeen,
      startTime: p.startTime instanceof Date ? p.startTime.toISOString() : p.startTime
    }));
    localStorage.setItem("hq_active_patrols", JSON.stringify(serialized));
  }

  getActivePatrols(): StoredPatrolData[] {
    try {
      const patrols = localStorage.getItem("hq_active_patrols");
      return patrols ? JSON.parse(patrols) : [];
    } catch {
      return [];
    }
  }

  // HQ - Auth Codes Management
  saveAuthCodes(codes: string[]): void {
    localStorage.setItem("hq_auth_codes", JSON.stringify(codes));
  }

  getAuthCodes(): string[] {
    try {
      const codes = localStorage.getItem("hq_auth_codes");
      return codes ? JSON.parse(codes) : [];
    } catch {
      return [];
    }
  }

  // Network Status
  setLastOnlineTime(): void {
    localStorage.setItem("last_online", Date.now().toString());
  }

  getLastOnlineTime(): number | null {
    const time = localStorage.getItem("last_online");
    return time ? parseInt(time) : null;
  }
}

export const storageService = new StorageService();