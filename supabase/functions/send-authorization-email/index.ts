import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const ADMIN_EMAIL = "endora.dream@gmail.com"

serve(async (req) => {
  try {
    const { device_id, device_info, authorization_code } = await req.json()

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const emailBody = `
      <h2>New Patrol Device Authorization Request</h2>
      <p>A new device is requesting access to the Patrol Tracking System.</p>
      
      <h3>Device Information:</h3>
      <ul>
        <li><strong>Device ID:</strong> ${device_id}</li>
        <li><strong>Device Info:</strong> ${device_info || "Not provided"}</li>
        <li><strong>Authorization Code:</strong> <code>${authorization_code}</code></li>
        <li><strong>Request Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      
      <p>To authorize this device, log in to HQ Control and approve the request.</p>
      
      <hr>
      <p style="color: #666; font-size: 12px;">Patrol Tracking System - Automated Security Notification</p>
    `

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Patrol System <noreply@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `🔐 New Device Authorization Request - ${device_id.substring(0, 8)}`,
        html: emailBody,
      }),
    })

    const data = await res.json()

    if (res.ok) {
      return new Response(
        JSON.stringify({ success: true, message: "Email sent successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    } else {
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: data }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})