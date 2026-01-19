import { useState, useEffect, useRef } from "react";
import { SEO } from "@/components/SEO";
import { MapPin, Wifi, WifiOff, Radio, Shield, Loader2, Smartphone, CheckCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { mqttService, MQTT_TOPICS, MQTTMessage } from "@/lib/mqtt";
import { storageService } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { 
  requestDeviceAuthorization, 
  verifyConfirmationCode,
  getDeviceFingerprint 
} from "@/services/securityService";

type AuthStep = "device_registration" | "awaiting_approval" | "confirmation_code" | "authorized";

export default function PatrolMobile() {
  const [mounted, setMounted] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("device_registration");
  const [deviceId, setDeviceId] = useState<string>("");
  const [deviceName, setDeviceName] = useState("");
  const [requestCode, setRequestCode] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [supabaseConnected, setSupabaseConnected] = useState(true); // Default to true with direct client
  
  // Patrol state
  const [patrolActive, setPatrolActive] = useState(false);
  const [currentPatrolId, setCurrentPatrolId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Patrol form data
  const [formData, setFormData] = useState({
    ptlName: "",
    comd: "",
    str: "",
    wpn: "",
    ammo: "",
    purpose: "",
  });

  const watchIdRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and check authorization status
  useEffect(() => {
    setMounted(true);
    
    const initDevice = async () => {
      // Get or create device ID
      const id = getDeviceFingerprint();
      setDeviceId(id);

      // Check if device is already authorized
      const { data: device } = await supabase
        .from("authorized_devices")
        .select("*")
        .eq("device_id", id)
        .eq("is_active", true)
        .single();

      if (device) {
        if (device.confirmation_code && !device.confirmed_at) {
           setAuthStep("confirmation_code");
           setAuthStatus("Device approved by HQ. Please enter the confirmation code.");
        } else {
           setAuthStep("authorized");
           setConfirmationCode(device.confirmation_code || "AUTH-OK");
           
           // Restore saved patrol data
           const savedData = storageService.getPatrolData();
           if (savedData) {
             setFormData({
               ptlName: savedData.ptlName,
               comd: savedData.comd,
               str: savedData.str,
               wpn: savedData.wpn,
               ammo: savedData.ammo || "",
               purpose: savedData.purpose || "",
             });
           }
           
           const isActive = storageService.isPatrolActive();
           if (isActive && savedData) {
             setPatrolActive(true);
             setCurrentPatrolId(`patrol_${Date.now()}`);
             startLocationTracking();
           }
        }
      } else {
        // Check if there's a pending request
        const { data: request } = await supabase
          .from("authorization_requests")
          .select("*")
          .eq("device_id", id)
          .eq("status", "pending")
          .single();

        if (request) {
          setRequestCode(request.request_code);
          setAuthStep("awaiting_approval");
          startPollingForApproval(id);
        }
      }
    };

    initDevice();
    initializeMQTT();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      mqttService.disconnect();
    };
  }, []);

  const initializeMQTT = async () => {
    try {
      await mqttService.connect();
      setIsOnline(true);
      await mqttService.subscribe(MQTT_TOPICS.AUTH_RESPONSE, () => {});
      await mqttService.syncOfflineQueue();
    } catch (error) {
      console.error("MQTT connection failed:", error);
      setIsOnline(false);
    }
  };

  const handleRequestAuthorization = async () => {
    if (!deviceName.trim()) {
      setError("Please enter a device name");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await requestDeviceAuthorization(deviceName);
      
      if (result.success && result.authCode) {
        setRequestCode(result.authCode);
        setAuthStep("awaiting_approval");
        setAuthStatus(`✓ Request sent! Code: ${result.authCode}`);
        startPollingForApproval(deviceId);
      } else {
        setError(result.error || "Failed to send authorization request");
      }
    } catch (error) {
      console.error("Authorization request error:", error);
      setError("Failed to send request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startPollingForApproval = (devId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      const { data: request } = await supabase
        .from("authorization_requests")
        .select("*")
        .eq("device_id", devId)
        .eq("status", "pending")
        .single();

      if (!request) {
        // Request is no longer pending, check if approved
        const { data: device } = await supabase
          .from("authorized_devices")
          .select("*")
          .eq("device_id", devId)
          .eq("is_active", true)
          .single();

        if (device) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setAuthStep("confirmation_code");
          setAuthStatus("✓ Request approved by HQ! Enter confirmation code to proceed.");
        }
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleConfirmDevice = async () => {
    if (!confirmationCode.trim()) {
      setError("Please enter the confirmation code from HQ Control");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await verifyConfirmationCode(confirmationCode.toUpperCase());
      
      if (result.success) {
        setAuthStep("authorized");
        setAuthStatus("✓ Device authorized! You can now start patrols.");
      } else {
        setError(result.error || "Invalid confirmation code");
      }
    } catch (error) {
      console.error("Confirmation error:", error);
      setError("Failed to confirm device. Please check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const startPatrol = async () => {
    if (!formData.ptlName || !formData.comd || !formData.str || !formData.wpn || !formData.ammo || !formData.purpose) {
      setAuthStatus("⚠️ Please fill in all fields");
      return;
    }

    setPatrolActive(true);
    setAuthStatus("✓ Patrol started - GPS tracking active");
    
    const patrolId = `patrol_${Date.now()}`;
    setCurrentPatrolId(patrolId);
    
    storageService.savePatrolData({
      ...formData,
      authCode: confirmationCode,
      timestamp: Date.now()
    });
    storageService.setPatrolActive(true);

    try {
      // Direct Supabase call instead of wrapper
      const { error } = await supabase.from("patrols").insert({
        patrol_id: patrolId,
        code: confirmationCode,
        ptl_name: formData.ptlName,
        comd: formData.comd,
        str: formData.str,
        wpn: formData.wpn,
        ammo: formData.ammo,
        purpose: formData.purpose,
        status: "active",
        device_id: deviceId
      });
      
      if (error) throw error;
      setAuthStatus("✓ Patrol started & saved to database");
    } catch (error) {
      console.error("Failed to save to database:", error);
      setAuthStatus("✓ Patrol started (local only - database unavailable)");
    }

    await mqttService.publish(MQTT_TOPICS.PATROL_START, {
      type: "patrol_start",
      payload: {
        patrolId,
        code: confirmationCode,
        ptlName: formData.ptlName,
        comd: formData.comd,
        str: formData.str,
        wpn: formData.wpn,
        ammo: formData.ammo,
        purpose: formData.purpose,
        startTime: Date.now(),
      },
      timestamp: Date.now(),
    });

    startLocationTracking();
  };

  const startLocationTracking = () => {
    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          sendLocationUpdate(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setError("Unable to access location. Please enable GPS.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setError("Geolocation is not supported by your device");
    }
  };

  const sendLocationUpdate = async (lat: number, lng: number, accuracy?: number) => {
    const location = { lat, lng, accuracy };
    setCurrentLocation(location);
    setLastUpdate(new Date());

    if (currentPatrolId) {
      try {
        await supabase.from("locations").insert({
          patrol_id: currentPatrolId,
          latitude: lat,
          longitude: lng,
          accuracy
        });
      } catch (error) {
        console.error("Failed to save location to database:", error);
      }
    }

    const message: MQTTMessage = {
      type: "location_update",
      payload: { patrolId: currentPatrolId || `patrol_${Date.now()}`, lat, lng, accuracy },
      timestamp: Date.now(),
    };

    if (isOnline) {
      try {
        await mqttService.publish(MQTT_TOPICS.LOCATION_UPDATE, message);
      } catch (error) {
        console.error("Failed to send location:", error);
        storageService.queueOfflineMessage(message);
      }
    } else {
      storageService.queueOfflineMessage(message);
    }
  };

  const handleEndPatrol = async () => {
    if (!confirm("End current patrol?")) return;

    if (currentPatrolId) {
      try {
        await supabase
          .from("patrols")
          .update({ 
            status: "completed",
            end_time: new Date().toISOString()
          })
          .eq("patrol_id", currentPatrolId);
      } catch (error) {
        console.error("Failed to update patrol status:", error);
      }

      // Publish end event via MQTT
      await mqttService.publish(MQTT_TOPICS.PATROL_END, {
        type: "patrol_end",
        payload: { patrolId: currentPatrolId },
        timestamp: Date.now(),
      });
    }

    localStorage.removeItem("current_patrol");
    setPatrolActive(false);
    setCurrentPatrolId(null);
    setCurrentLocation(null);
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <SEO 
        title="Patrol Mobile - Field Operations"
        description="Mobile patrol tracking interface for field personnel"
      />
      <div className="fixed top-2 right-2 z-50 text-[10px] text-white/30 pointer-events-none font-mono">
        Developed By BA-8993 Major Wahid
      </div>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
        <div className="container mx-auto max-w-md py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4 relative">
              <div className="bg-blue-500/20 p-4 rounded-full">
                <Radio className="w-12 h-12 text-blue-400" />
              </div>
              <div className="absolute -top-2 -right-2">
                <Badge className={isOnline ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-slate-500/20 text-slate-400 border-slate-500/50"}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                </Badge>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Patrol Mobile</h1>
            <p className="text-blue-200">Field Operations Interface</p>
            <div className="mt-2 flex justify-center gap-2">
              <Badge className={isOnline ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-amber-500/20 text-amber-400 border-amber-500/50"}>
                {isOnline ? "Online" : "Offline Mode"}
              </Badge>
              <Badge className={supabaseConnected ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : "bg-gray-500/20 text-gray-400 border-gray-500/50"}>
                💾 {supabaseConnected ? "DB Connected" : "Local"}
              </Badge>
            </div>
          </div>

          {/* Device Registration */}
          {authStep === "device_registration" && (
            <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-blue-500/30">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <Smartphone className="w-16 h-16 text-blue-400 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-white mb-2">Device Registration</h2>
                  <p className="text-blue-200 text-sm">Register this device to request access</p>
                  <div className="mt-3 bg-blue-900/20 rounded-lg p-3">
                    <p className="text-xs text-blue-300 font-mono">Device ID: {deviceId.substring(0, 12)}...</p>
                  </div>
                </div>

                {error && (
                  <Alert className="bg-red-900/20 border-red-500/50">
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="deviceName" className="text-white">Device Name</Label>
                  <Input
                    id="deviceName"
                    type="text"
                    placeholder="e.g., Patrol Unit 01 - Officer Smith"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    className="mt-2 bg-slate-900/50 border-blue-500/30 text-white"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-blue-300 mt-2">This helps HQ identify your device</p>
                </div>

                <Button 
                  onClick={handleRequestAuthorization}
                  disabled={isLoading || !deviceName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    "Request Authorization"
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Awaiting Approval */}
          {authStep === "awaiting_approval" && (
            <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-amber-500/30">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <div className="bg-amber-500/20 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Awaiting Approval</h2>
                  <p className="text-amber-200 text-sm mb-4">Your request has been sent to HQ Control</p>
                  
                  <div className="bg-amber-900/20 rounded-lg p-4">
                    <p className="text-xs text-amber-300 mb-2">Request Code</p>
                    <p className="text-2xl font-bold text-amber-400 font-mono tracking-wider">{requestCode}</p>
                  </div>
                </div>

                <Alert className="bg-blue-900/20 border-blue-500/50">
                  <AlertDescription className="text-blue-200 text-sm">
                    ✉️ An email has been sent to the administrator. Please wait for approval.
                  </AlertDescription>
                </Alert>

                <div className="text-center text-xs text-gray-400 mt-4">
                  <p>This page will automatically update when approved</p>
                </div>
              </div>
            </Card>
          )}

          {/* Confirmation Code Entry */}
          {authStep === "confirmation_code" && (
            <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-emerald-500/30">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <Shield className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-white mb-2">Enter Confirmation Code</h2>
                  <p className="text-emerald-200 text-sm">Your request has been approved! Enter the code from HQ Control</p>
                </div>

                {error && (
                  <Alert className="bg-red-900/20 border-red-500/50">
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                  </Alert>
                )}

                {authStatus && (
                  <Alert className="bg-emerald-900/20 border-emerald-500/50">
                    <AlertDescription className="text-emerald-200">{authStatus}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="confirmCode" className="text-white">Confirmation Code</Label>
                  <Input
                    id="confirmCode"
                    type="text"
                    placeholder="Enter code from HQ..."
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                    className="mt-2 bg-slate-900/50 border-emerald-500/30 text-white text-center text-lg font-mono tracking-wider"
                    maxLength={8}
                    disabled={isLoading}
                  />
                </div>

                <Button 
                  onClick={handleConfirmDevice}
                  disabled={isLoading || !confirmationCode.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Confirm & Activate"
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Patrol Form (Authorized) */}
          {authStep === "authorized" && !patrolActive && (
            <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-emerald-500/30">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <div className="inline-block bg-emerald-500/20 px-4 py-1 rounded-full mb-3">
                    <span className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
                       <CheckCircle className="w-4 h-4" /> AUTHORIZED
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Patrol Details</h2>
                  <p className="text-blue-200 text-sm">Fill in the patrol information to begin tracking</p>
                </div>

                {authStatus && (
                  <Alert className="bg-blue-900/20 border-blue-500/50 mb-4">
                    <AlertDescription className="text-blue-200">{authStatus}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="ptlName" className="text-white">Ptl Name (Patrol Name)</Label>
                    <Input
                      id="ptlName"
                      type="text"
                      placeholder="e.g., Patrol-Alpha-01"
                      value={formData.ptlName}
                      onChange={(e) => setFormData({ ...formData, ptlName: e.target.value })}
                      className="mt-2 bg-slate-900/50 border-emerald-500/30 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="comd" className="text-white">Comd (Commander)</Label>
                    <Input
                      id="comd"
                      type="text"
                      placeholder="Officer name"
                      value={formData.comd}
                      onChange={(e) => setFormData({ ...formData, comd: e.target.value })}
                      className="mt-2 bg-slate-900/50 border-emerald-500/30 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="str" className="text-white">Str (Strength)</Label>
                      <Input
                        id="str"
                        type="text"
                        placeholder="Number"
                        value={formData.str}
                        onChange={(e) => setFormData({ ...formData, str: e.target.value })}
                        className="mt-2 bg-slate-900/50 border-emerald-500/30 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ammo" className="text-white">Ammo</Label>
                      <Input
                        id="ammo"
                        type="text"
                        placeholder="Counts"
                        value={formData.ammo}
                        onChange={(e) => setFormData({ ...formData, ammo: e.target.value })}
                        className="mt-2 bg-slate-900/50 border-emerald-500/30 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="wpn" className="text-white">Wpn (Weapons)</Label>
                    <Input
                      id="wpn"
                      type="text"
                      placeholder="Equipment details"
                      value={formData.wpn}
                      onChange={(e) => setFormData({ ...formData, wpn: e.target.value })}
                      className="mt-2 bg-slate-900/50 border-emerald-500/30 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="purpose" className="text-white">Purpose</Label>
                    <Textarea
                      id="purpose"
                      placeholder="Patrol objective"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="mt-2 bg-slate-900/50 border-emerald-500/30 text-white"
                      rows={3}
                    />
                  </div>
                </div>

                <Button 
                  onClick={startPatrol}
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    "Start Patrol"
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Active Patrol Tracking */}
          {authStep === "authorized" && patrolActive && (
            <Card className="p-6 bg-slate-800/50 backdrop-blur-sm border-emerald-500/30">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <div className="inline-block bg-emerald-500/20 px-4 py-2 rounded-full mb-3 animate-pulse">
                    <span className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      TRACKING ACTIVE
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">{formData.ptlName}</h2>
                  <p className="text-blue-200 text-sm">Code: {confirmationCode}</p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-blue-200">Commander:</span>
                    <span className="text-white font-semibold">{formData.comd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Strength:</span>
                    <span className="text-white font-semibold">{formData.str}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-200">Weapons:</span>
                    <span className="text-white font-semibold">{formData.wpn}</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-500/20 pt-2">
                    <span className="text-blue-200">Ammo:</span>
                    <span className="text-white font-semibold">{formData.ammo}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-blue-200 text-sm block mb-1">Purpose:</span>
                    <span className="text-white text-sm leading-relaxed">{formData.purpose}</span>
                  </div>
                </div>

                {currentLocation ? (
                  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Current Location</span>
                    </div>
                    <div className="text-white text-sm font-mono">
                      <div>Lat: {currentLocation.lat.toFixed(6)}</div>
                      <div>Lng: {currentLocation.lng.toFixed(6)}</div>
                      {currentLocation.accuracy && (
                        <div className="text-gray-400 text-xs mt-1">
                          Accuracy: ±{Math.round(currentLocation.accuracy)}m
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-blue-200">
                      {isOnline ? "Sending updates to HQ..." : "Updates queued for sync"}
                    </div>
                    {lastUpdate && (
                      <div className="text-xs text-emerald-200/70 mt-1">
                        Last update: {lastUpdate.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-center">
                    <Loader2 className="w-6 h-6 text-blue-400 mx-auto mb-2 animate-spin" />
                    <p className="text-blue-200 text-sm">Acquiring GPS signal...</p>
                  </div>
                )}

                <Button 
                  onClick={handleEndPatrol}
                  variant="destructive"
                  className="w-full"
                >
                  End Patrol
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}