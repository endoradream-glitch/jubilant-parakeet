import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { MapPin, Wifi, WifiOff, Radio, Shield, Users, Clock, Hash, CheckCircle, XCircle, History, Smartphone, Loader2, Check, X, LogOut, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mqttService, MQTT_TOPICS, MQTTMessage, PatrolData } from "@/lib/mqtt";
import { storageService, StoredPatrolData } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { getPendingRequests, approveAuthorizationRequest, rejectAuthorizationRequest } from "@/services/securityService";
import dynamic from "next/dynamic";
import { Database } from "@/integrations/supabase/types";
import { authService } from "@/services/authService";

// Dynamically import PatrolMap (client-side only due to Leaflet)
const PatrolMap = dynamic(
  () => import("@/components/PatrolMap").then((mod) => ({ default: mod.PatrolMap })),
  { ssr: false }
);

type AuthRequest = Database["public"]["Tables"]["authorization_requests"]["Row"];
type PatrolRecord = Database["public"]["Tables"]["patrols"]["Row"];

export default function HQControl() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [activePatrols, setActivePatrols] = useState<PatrolData[]>([]);
  const [patrolHistory, setPatrolHistory] = useState<PatrolRecord[]>([]);
  const [authCodes, setAuthCodes] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AuthRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isOnline, setIsOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [supabaseConnected, setSupabaseConnected] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        setIsAuthenticated(true);
        setUserEmail(user.email);
        setMounted(true);
      } else {
        router.push("/auth/login");
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    setMounted(true);
    
    // Initialize system
    const initialize = async () => {
      setIsLoading(true);
      
      // Load saved data
      const savedCodes = storageService.getAuthCodes();
      setAuthCodes(savedCodes);
      
      const savedPatrols = storageService.getActivePatrols();
      // Convert StoredPatrolData to PatrolData
      const hydratedPatrols: PatrolData[] = savedPatrols.map(p => ({
        id: p.id,
        code: p.code,
        ptlName: p.ptlName,
        comd: p.comd,
        str: p.str,
        wpn: p.wpn,
        ammo: p.ammo,
        purpose: p.purpose,
        location: p.location,
        status: p.status, // Type compatible
        lastSeen: new Date(p.lastSeen),
        startTime: new Date(p.startTime),
        lastUpdate: p.lastUpdate
      }));
      setActivePatrols(hydratedPatrols);

      // Initialize MQTT
      await initializeMQTT();

      // Load patrol history from Supabase
      await loadPatrolHistory();
      
      // Load active patrols
      await loadActivePatrols();
      
      // Load pending auth requests
      await loadPendingRequests();
      
      setIsLoading(false);
    };
    
    initialize();

    // Check patrol status periodically
    const statusInterval = setInterval(() => {
      checkPatrolStatus();
      loadPendingRequests(); // Also refresh pending requests
      loadActivePatrols(); // Refresh active patrols from DB
    }, 10000); // Every 10 seconds

    return () => {
      clearInterval(statusInterval);
      mqttService.disconnect();
    };
  }, []);

  const loadPendingRequests = async () => {
    try {
      const requests = await getPendingRequests();
      setPendingRequests(requests);
    } catch (error) {
      console.error("Failed to load pending requests:", error);
    }
  };

  // Load patrol history from database
  const loadPatrolHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("patrols")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setPatrolHistory(data || []);
    } catch (error) {
      console.error("Error loading patrol history:", error);
    }
  };

  // Load active patrols with locations
  const loadActivePatrols = async () => {
    try {
      const { data: patrols, error: patrolError } = await supabase
        .from("patrols")
        .select("*")
        .eq("status", "active");

      if (patrolError) throw patrolError;

      if (!patrols || patrols.length === 0) {
        return;
      }

      const patrolsWithLocations = await Promise.all(
        patrols.map(async (patrol) => {
          const { data: locations, error: locError } = await supabase
            .from("locations")
            .select("*")
            .eq("patrol_id", patrol.patrol_id)
            .order("timestamp", { ascending: false })
            .limit(1);

          if (locError) {
            console.error("Error loading location:", locError);
          }

          const lastLocation = locations?.[0];
          
          const patrolData: PatrolData = {
            id: patrol.patrol_id,
            code: patrol.code || "",
            ptlName: patrol.ptl_name,
            comd: patrol.comd,
            str: patrol.str,
            wpn: patrol.wpn,
            ammo: patrol.ammo || "",
            purpose: patrol.purpose || "",
            location: lastLocation ? { 
              lat: lastLocation.latitude, 
              lng: lastLocation.longitude 
            } : null,
            status: "active" as const,
            lastSeen: lastLocation ? new Date(lastLocation.timestamp!) : new Date(),
            startTime: new Date(patrol.start_time!),
            lastUpdate: Date.now()
          };
          
          return patrolData;
        })
      );

      // Merge with MQTT local state to avoid flickering
      setActivePatrols(prev => {
        const dbMap = new Map(patrolsWithLocations.map(p => [p.id, p]));
        
        // Use DB data but prefer local lastSeen if newer
        const merged = [...patrolsWithLocations];
        
        // Add any local-only patrols (MQTT) that aren't in DB yet
        prev.forEach(p => {
          if (!dbMap.has(p.id)) {
            merged.push(p);
          }
        });
        
        return merged;
      });
    } catch (error) {
      console.error("Error loading active patrols:", error);
    }
  };

  const initializeMQTT = async () => {
    try {
      await mqttService.connect();
      setIsOnline(true);
      setStatusMessage("Connected to MQTT broker");
      
      await mqttService.subscribe(MQTT_TOPICS.PATROL_START, handlePatrolStart);
      await mqttService.subscribe(MQTT_TOPICS.LOCATION_UPDATE, handleLocationUpdate);
      await mqttService.subscribe(MQTT_TOPICS.PATROL_END, handlePatrolEnd);
      
    } catch (error) {
      console.error("MQTT connection failed:", error);
      setIsOnline(false);
      setStatusMessage("Offline - using local storage");
    }
  };

  const saveToStorage = (patrols: PatrolData[]) => {
    // Explicitly cast to StoredPatrolData to match storage service requirements
    // This handles the Date -> string conversion that happens during JSON serialization
    const storable: StoredPatrolData[] = patrols.map(p => ({
      ...p,
      lastSeen: p.lastSeen, // Storage service handles the Date to string conversion
      startTime: p.startTime
    }));
    storageService.saveActivePatrols(storable);
  };

  const handlePatrolStart = async (message: MQTTMessage) => {
    if (message.type === "patrol_start") {
      const { patrolId, code, ptlName, comd, str, wpn, ammo, purpose, startTime } = message.payload;
      
      const newPatrol: PatrolData = {
        id: patrolId,
        code,
        ptlName,
        comd,
        str,
        wpn,
        ammo: ammo || "",
        purpose: purpose || "",
        location: null,
        status: "active" as const,
        lastSeen: new Date(),
        startTime: new Date(startTime),
        lastUpdate: Date.now()
      };
      
      setActivePatrols(prev => {
        const updated = [...prev.filter(p => p.id !== patrolId), newPatrol];
        saveToStorage(updated);
        return updated;
      });
      
      setStatusMessage(`✓ Patrol started: ${ptlName}`);
      loadActivePatrols(); // Sync with DB
    }
  };

  const handleLocationUpdate = async (message: MQTTMessage) => {
    if (message.type === "location_update") {
      const { patrolId, lat, lng } = message.payload;
      
      setActivePatrols(prev => {
        const updated = prev.map(patrol => 
          patrol.id === patrolId 
            ? { 
                ...patrol, 
                location: { lat, lng },
                status: "active" as const,
                lastSeen: new Date()
              }
            : patrol
        );
        saveToStorage(updated);
        return updated;
      });
    }
  };

  const handlePatrolEnd = async (message: MQTTMessage) => {
    if (message.type === "patrol_end") {
      const { patrolId } = message.payload;
      
      setActivePatrols(prev => {
        const updated = prev.filter(p => p.id !== patrolId);
        saveToStorage(updated);
        return updated;
      });

      setStatusMessage(`✓ Patrol ended: ${patrolId}`);
      loadPatrolHistory(); // Reload history
    }
  };

  const checkPatrolStatus = () => {
    const now = Date.now();
    setActivePatrols(prev => {
      const updated = prev.map(patrol => {
        const timeSinceLastSeen = now - patrol.lastSeen.getTime();
        // Mark as offline if no update in 2 minutes
        if (timeSinceLastSeen > 120000 && patrol.status === "active") {
          return { ...patrol, status: "offline" as const };
        }
        return patrol;
      });
      saveToStorage(updated);
      return updated;
    });
  };

  const handleApproveRequest = async (request: AuthRequest) => {
    setProcessingId(request.id);
    try {
      const result = await approveAuthorizationRequest(request.id);
      if (result.success && result.confirmationCode) {
        setStatusMessage(`✓ Approved ${request.device_name}. Code: ${result.confirmationCode}`);
        setPendingRequests(prev => prev.filter(r => r.id !== request.id));
        
        // Add to auth codes so we can track it
        setAuthCodes(prev => [...prev, result.confirmationCode!]);
        
        // Show alert with the code
        alert(`Device Approved!\n\nProvide this code to the user:\n\n${result.confirmationCode}`);
      } else {
        setStatusMessage(`✗ Approval failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Approval error:", error);
      setStatusMessage("✗ Approval failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (request: AuthRequest) => {
    if (!confirm(`Reject request from ${request.device_name}?`)) return;
    
    setProcessingId(request.id);
    try {
      const result = await rejectAuthorizationRequest(request.id);
      if (result.success) {
        setStatusMessage(`✓ Rejected request from ${request.device_name}`);
        setPendingRequests(prev => prev.filter(r => r.id !== request.id));
      } else {
        setStatusMessage(`✗ Rejection failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Rejection error:", error);
      setStatusMessage("✗ Rejection failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSignOut = async () => {
    const { error } = await authService.signOut();
    if (!error) {
      router.push("/");
    }
  };

  const formatDuration = (startTime: Date) => {
    const duration = Date.now() - startTime.getTime();
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const formatHistoryDuration = (start: string, end: string | null) => {
    if (!end) return "Ongoing";
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Prepare patrol markers for map
  const patrolMarkers = activePatrols
    .filter(p => p.location)
    .map(p => ({
      id: p.id,
      ptlName: p.ptlName,
      lat: p.location!.lat,
      lng: p.location!.lng,
      status: p.status,
      lastUpdate: p.lastSeen.getTime()
    }));

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-400 mx-auto mb-4 animate-spin" />
          <p className="text-emerald-200">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!mounted || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <SEO 
        title="HQ Control - Command Center"
        description="Real-time patrol monitoring and control dashboard"
      />
      <div className="fixed top-2 right-2 z-50 text-[10px] text-white/30 pointer-events-none font-mono">
        Developed By BA-8993 Major Wahid
      </div>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-3 rounded-lg">
                <MapPin className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  HQ Control Center
                </h1>
                <p className="text-emerald-200">Real-time Patrol Monitoring</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge className={supabaseConnected ? "bg-blue-500/20 text-blue-400 border-blue-500/50 px-4 py-2" : "bg-gray-500/20 text-gray-400 border-gray-500/50 px-4 py-2"}>
                💾 {supabaseConnected ? "Database Connected" : "Local Only"}
              </Badge>
              <Badge className={isOnline ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 px-4 py-2" : "bg-amber-500/20 text-amber-400 border-amber-500/50 px-4 py-2"}>
                <Radio className="w-4 h-4 mr-2" />
                {isOnline ? "System Online" : "Offline Mode"}
              </Badge>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <Alert className="mb-6 bg-blue-900/20 border-blue-500/50">
              <AlertDescription className="text-blue-200">
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Authorization Requests & Stats */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Pending Requests */}
              <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-blue-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-blue-400" />
                  <h2 className="text-xl font-bold text-white">
                    Access Requests
                  </h2>
                  {pendingRequests.length > 0 && (
                     <Badge className="bg-amber-500 text-black font-bold ml-auto">{pendingRequests.length}</Badge>
                  )}
                </div>
                
                {pendingRequests.length === 0 ? (
                  <p className="text-blue-200 text-sm text-center py-4">
                    No pending authorization requests.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pendingRequests.map((request) => (
                      <div 
                        key={request.id}
                        className="bg-slate-900/80 rounded-lg p-3 border border-blue-500/30"
                      >
                        <div className="flex justify-between items-start mb-2">
                           <div>
                             <h4 className="text-white font-semibold text-sm">{request.device_name}</h4>
                             <p className="text-xs text-blue-300 font-mono mt-1">
                               ID: {request.device_id.substring(0, 8)}...
                             </p>
                             <p className="text-xs text-gray-400 mt-1">
                               {new Date(request.requested_at).toLocaleString()}
                             </p>
                           </div>
                           <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs">Pending</Badge>
                        </div>
                        
                        <div className="flex gap-2 mt-3">
                           <Button 
                             size="sm" 
                             className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8"
                             onClick={() => handleApproveRequest(request)}
                             disabled={processingId === request.id}
                           >
                             {processingId === request.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                             Approve
                           </Button>
                           <Button 
                             size="sm" 
                             variant="destructive"
                             className="flex-1 h-8"
                             onClick={() => handleRejectRequest(request)}
                             disabled={processingId === request.id}
                           >
                             <X className="w-3 h-3 mr-1" />
                             Reject
                           </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Statistics */}
              <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-emerald-500/30">
                <h3 className="text-lg font-bold text-white mb-4">
                  Statistics
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-200">Active Patrols</span>
                    <span className="text-white font-bold text-xl">
                      {activePatrols.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-200">Online Units</span>
                    <span className="text-white font-bold text-xl">
                      {activePatrols.filter(p => p.status === "active").length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-200">History Records</span>
                    <span className="text-white font-bold text-xl">
                      {patrolHistory.length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column - Map and Patrol Data */}
            <div className="lg:col-span-2 space-y-6">
              {/* Live Map */}
              <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-emerald-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    Live Map View
                  </h2>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                    📍 Tracking {patrolMarkers.length} units
                  </Badge>
                </div>
                
                <div className="rounded-lg overflow-hidden" style={{ height: '500px' }}>
                  <PatrolMap 
                    patrols={patrolMarkers}
                    center={patrolMarkers.length > 0 ? [patrolMarkers[0].lat, patrolMarkers[0].lng] : [1.3521, 103.8198]}
                    zoom={13}
                  />
                </div>
              </Card>

              {/* Tabs for Active Patrols and History */}
              <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-emerald-500/30">
                <Tabs defaultValue="active" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-900/50">
                    <TabsTrigger value="active" className="data-[state=active]:bg-emerald-600">
                      <Users className="w-4 h-4 mr-2" />
                      Active Patrols ({activePatrols.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-blue-600">
                      <History className="w-4 h-4 mr-2" />
                      History ({patrolHistory.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Active Patrols Tab */}
                  <TabsContent value="active" className="mt-4">
                    {activePatrols.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                        <p className="text-emerald-200 mb-2">
                          No active patrols
                        </p>
                        <p className="text-blue-200 text-sm">
                          Patrols will appear here once they start tracking
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 max-h-[600px] overflow-y-auto">
                        {activePatrols.map((patrol) => (
                          <div 
                            key={patrol.id}
                            className="bg-slate-900/50 rounded-lg p-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                  {patrol.ptlName}
                                  {patrol.status === "active" ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-amber-400" />
                                  )}
                                </h3>
                                <p className="text-emerald-200 text-sm">
                                  Commander: {patrol.comd}
                                </p>
                                <p className="text-blue-200 text-xs mt-1">
                                  Code: {patrol.code} • Duration: {formatDuration(patrol.startTime)}
                                </p>
                              </div>
                              <Badge 
                                className={
                                  patrol.status === "active"
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                    : "bg-amber-500/20 text-amber-400 border-amber-500/50"
                                }
                              >
                                {patrol.status}
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-400">Patrol ID:</span>
                                  <div className="font-mono text-xs text-white truncate">{patrol.id}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">Strength:</span>
                                  <div className="font-medium text-white">{patrol.str}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">Weapons:</span>
                                  <div className="font-medium text-white">{patrol.wpn}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">Ammunition:</span>
                                  <div className="font-medium text-white">{patrol.ammo}</div>
                                </div>
                              </div>
                              
                              <div className="border-t border-emerald-500/20 pt-2">
                                <div className="text-sm text-gray-400 mb-1">Purpose:</div>
                                <div className="text-sm font-medium text-white leading-relaxed">{patrol.purpose}</div>
                              </div>
                            </div>

                            {patrol.location ? (
                              <div className="mt-3 pt-3 border-t border-emerald-500/20">
                                <div className="flex items-center gap-2 text-xs text-blue-200 mb-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="font-semibold">Current Location:</span>
                                </div>
                                <div className="text-xs text-white font-mono bg-slate-800/50 rounded p-2">
                                  Lat: {patrol.location.lat.toFixed(6)}, Lng: {patrol.location.lng.toFixed(6)}
                                </div>
                                <div className="text-xs text-emerald-200 mt-1">
                                  Last seen: {new Date(patrol.lastSeen).toLocaleTimeString()}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 pt-3 border-t border-emerald-500/20 text-center">
                                <p className="text-amber-200 text-xs">
                                  Waiting for GPS data...
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* History Tab */}
                  <TabsContent value="history" className="mt-4">
                    {!supabaseConnected ? (
                      <div className="text-center py-12">
                        <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">
                          Database Not Connected
                        </p>
                        <p className="text-gray-500 text-sm">
                          Connect Supabase to view patrol history
                        </p>
                      </div>
                    ) : patrolHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <History className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                        <p className="text-blue-200 mb-2">
                          No patrol history yet
                        </p>
                        <p className="text-gray-400 text-sm">
                          Completed patrols will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 max-h-[600px] overflow-y-auto">
                        {patrolHistory.map((patrol) => (
                          <div 
                            key={patrol.patrol_id}
                            className="bg-slate-900/50 rounded-lg p-4 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-white font-bold text-lg">
                                  {patrol.ptl_name}
                                </h3>
                                <p className="text-blue-200 text-sm">
                                  Commander: {patrol.comd}
                                </p>
                                <p className="text-gray-400 text-xs mt-1">
                                  {new Date(patrol.start_time).toLocaleString()} • {formatHistoryDuration(patrol.start_time, patrol.end_time)}
                                </p>
                              </div>
                              <Badge 
                                className={
                                  patrol.status === "completed"
                                    ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                                    : patrol.status === "active"
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                    : "bg-gray-500/20 text-gray-400 border-gray-500/50"
                                }
                              >
                                {patrol.status}
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-gray-400">Code:</span>
                                  <div className="font-mono text-white">{patrol.code}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">Strength:</span>
                                  <div className="text-white">{patrol.str}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">Weapons:</span>
                                  <div className="text-white">{patrol.wpn}</div>
                                </div>
                                <div>
                                  <span className="text-gray-400">Ammunition:</span>
                                  <div className="text-white">{patrol.ammo}</div>
                                </div>
                              </div>
                              
                              <div className="border-t border-blue-500/20 pt-2">
                                <div className="text-gray-400 mb-1">Purpose:</div>
                                <div className="text-white leading-relaxed">{patrol.purpose}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}