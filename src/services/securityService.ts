// Security Service - 2FA Authentication System
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AuthorizationRequest = Database["public"]["Tables"]["authorization_requests"]["Row"];
type AuthorizedDevice = Database["public"]["Tables"]["authorized_devices"]["Row"];

/**
 * Generate a random alphanumeric code
 */
function generateCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing characters
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get device fingerprint (unique identifier for this browser/device)
 */
export function getDeviceFingerprint(): string {
  // Use localStorage to persist device ID
  let deviceId = localStorage.getItem("device_fingerprint");
  
  if (!deviceId) {
    // Generate new device ID combining multiple factors
    const userAgent = navigator.userAgent;
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;
    
    // Create a hash-like identifier
    const fingerprint = `${userAgent}-${screenRes}-${timezone}-${language}-${platform}`;
    deviceId = btoa(fingerprint).substring(0, 32) + "-" + Date.now();
    
    localStorage.setItem("device_fingerprint", deviceId);
  }
  
  return deviceId;
}

/**
 * Check if current device is authorized
 */
export async function isDeviceAuthorized(): Promise<{
  authorized: boolean;
  device?: AuthorizedDevice;
  requiresCode?: boolean;
}> {
  const deviceId = getDeviceFingerprint();
  
  const { data: device, error } = await supabase
    .from("authorized_devices")
    .select("*")
    .eq("device_id", deviceId)
    .eq("is_active", true)
    .maybeSingle();
  
  if (error && error.code !== "PGRST116") {
    console.error("Error checking device authorization:", error);
    return { authorized: false };
  }
  
  if (device) {
    // Check if confirmation code has been entered
    if (device.confirmation_code && !device.confirmed_at) {
      return { 
        authorized: false, 
        device,
        requiresCode: true 
      };
    }
    
    return { 
      authorized: true, 
      device 
    };
  }
  
  return { authorized: false };
}

/**
 * Request authorization for new device
 */
export async function requestDeviceAuthorization(deviceName: string): Promise<{
  success: boolean;
  authCode?: string;
  error?: string;
}> {
  const deviceId = getDeviceFingerprint();
  const authCode = generateCode(8);
  
  // Check if there's already a pending request
  const { data: existingRequest } = await supabase
    .from("authorization_requests")
    .select("*")
    .eq("device_id", deviceId)
    .eq("status", "pending")
    .maybeSingle();
  
  if (existingRequest) {
    return {
      success: true,
      authCode: existingRequest.request_code,
    };
  }
  
  // Create new authorization request
  const { data, error } = await supabase
    .from("authorization_requests")
    .insert({
      device_id: deviceId,
      device_name: deviceName,
      request_code: authCode,
      status: "pending",
    })
    .select()
    .single();
  
  if (error) {
    console.error("Error creating authorization request:", error);
    return {
      success: false,
      error: error.message,
    };
  }
  
  // Trigger email notification
  try {
    await supabase.functions.invoke("send-authorization-email", {
      body: {
        device_id: deviceId,
        device_info: deviceName,
        authorization_code: authCode,
      },
    });
  } catch (emailError) {
    console.error("Error sending email:", emailError);
    // Don't fail the request if email fails
  }
  
  return {
    success: true,
    authCode,
  };
}

/**
 * Check authorization request status
 */
export async function checkAuthorizationStatus(): Promise<{
  status: "pending" | "approved" | "rejected" | "none";
  confirmationCode?: string;
}> {
  const deviceId = getDeviceFingerprint();
  
  // Check if device is already authorized
  const { data: device } = await supabase
    .from("authorized_devices")
    .select("*")
    .eq("device_id", deviceId)
    .eq("is_active", true)
    .maybeSingle();
  
  if (device) {
    if (device.confirmation_code && !device.confirmed_at) {
      return {
        status: "approved",
        confirmationCode: device.confirmation_code,
      };
    }
    return { status: "approved" };
  }
  
  // Check pending request
  const { data: request } = await supabase
    .from("authorization_requests")
    .select("*")
    .eq("device_id", deviceId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!request) {
    return { status: "none" };
  }
  
  return { status: request.status as "pending" | "approved" | "rejected" };
}

/**
 * HQ: Get all pending authorization requests
 */
export async function getPendingRequests(): Promise<AuthorizationRequest[]> {
  const { data, error } = await supabase
    .from("authorization_requests")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching pending requests:", error);
    return [];
  }
  
  return data || [];
}

/**
 * HQ: Approve authorization request and generate confirmation code
 */
export async function approveAuthorizationRequest(requestId: string): Promise<{
  success: boolean;
  confirmationCode?: string;
  error?: string;
}> {
  const confirmationCode = generateCode(6);
  
  // Get request details
  const { data: request, error: fetchError } = await supabase
    .from("authorization_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  
  if (fetchError || !request) {
    return {
      success: false,
      error: "Request not found",
    };
  }
  
  // Update request status (using reviewed_at instead of approved_at)
  const { error: updateError } = await supabase
    .from("authorization_requests")
    .update({ 
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  
  if (updateError) {
    return {
      success: false,
      error: updateError.message,
    };
  }
  
  // Create authorized device entry with confirmation code
  const { error: deviceError } = await supabase
    .from("authorized_devices")
    .insert({
      device_id: request.device_id,
      device_name: request.device_name,
      confirmation_code: confirmationCode,
      is_active: true,
    });
  
  if (deviceError) {
    return {
      success: false,
      error: deviceError.message,
    };
  }
  
  // Log the authorization
  await supabase
    .from("authorization_logs")
    .insert({
      device_id: request.device_id,
      action: "approved",
      details: { requestId, confirmationCode },
    });
  
  return {
    success: true,
    confirmationCode,
  };
}

/**
 * HQ: Reject authorization request
 */
export async function rejectAuthorizationRequest(requestId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { data: request } = await supabase
    .from("authorization_requests")
    .select("device_id")
    .eq("id", requestId)
    .single();
  
  // Update request status (using reviewed_at instead of approved_at)
  const { error } = await supabase
    .from("authorization_requests")
    .update({ 
      status: "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  
  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }
  
  // Log the rejection
  if (request) {
    await supabase
      .from("authorization_logs")
      .insert({
        device_id: request.device_id,
        action: "rejected",
        details: { requestId },
      });
  }
  
  return { success: true };
}

/**
 * Patrol: Verify and submit confirmation code
 */
export async function verifyConfirmationCode(code: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const deviceId = getDeviceFingerprint();
  
  const { data: device, error: fetchError } = await supabase
    .from("authorized_devices")
    .select("*")
    .eq("device_id", deviceId)
    .eq("confirmation_code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();
  
  if (fetchError || !device) {
    return {
      success: false,
      error: "Invalid confirmation code",
    };
  }
  
  // Mark device as confirmed
  const { error: updateError } = await supabase
    .from("authorized_devices")
    .update({
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", device.id);
  
  if (updateError) {
    return {
      success: false,
      error: updateError.message,
    };
  }
  
  // Log the confirmation
  await supabase
    .from("authorization_logs")
    .insert({
      device_id: deviceId,
      action: "confirmed",
      details: { code },
    });
  
  return { success: true };
}

/**
 * HQ: Get all authorized devices
 */
export async function getAuthorizedDevices(): Promise<AuthorizedDevice[]> {
  const { data, error } = await supabase
    .from("authorized_devices")
    .select("*")
    .eq("is_active", true)
    .order("authorized_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching authorized devices:", error);
    return [];
  }
  
  return data || [];
}

/**
 * HQ: Revoke device authorization
 */
export async function revokeDeviceAuthorization(deviceId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { error } = await supabase
    .from("authorized_devices")
    .update({ is_active: false })
    .eq("device_id", deviceId);
  
  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }
  
  // Log the revocation
  await supabase
    .from("authorization_logs")
    .insert({
      device_id: deviceId,
      action: "revoked",
      details: {},
    });
  
  return { success: true };
}