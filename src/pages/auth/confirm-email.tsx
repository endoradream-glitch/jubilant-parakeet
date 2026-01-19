import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ConfirmEmail() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the token from URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const type = hashParams.get("type");

        if (!accessToken) {
          setStatus("error");
          setMessage("No confirmation token found. Please check your email link.");
          return;
        }

        if (type === "signup") {
          // Verify the email token
          const { error } = await supabase.auth.verifyOtp({
            token_hash: accessToken,
            type: "email"
          });

          if (error) {
            setStatus("error");
            setMessage(error.message || "Failed to verify email. The link may have expired.");
          } else {
            setStatus("success");
            setMessage("Email verified successfully! You can now sign in.");
            
            // Redirect to home page after 3 seconds
            setTimeout(() => {
              router.push("/");
            }, 3000);
          }
        } else {
          setStatus("error");
          setMessage("Invalid confirmation type.");
        }
      } catch (error) {
        console.error("Email confirmation error:", error);
        setStatus("error");
        setMessage("An unexpected error occurred during email confirmation.");
      }
    };

    // Only run on client side
    if (typeof window !== "undefined") {
      handleEmailConfirmation();
    }
  }, [router]);

  return (
    <>
      <SEO 
        title="Confirm Email - Patrol Tracking System"
        description="Email confirmation page"
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-slate-800/50 backdrop-blur-sm border-blue-500/30">
          <div className="text-center">
            {status === "loading" && (
              <>
                <div className="bg-blue-500/20 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Verifying Email</h1>
                <p className="text-blue-200">Please wait while we confirm your email address...</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="bg-emerald-500/20 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
                <p className="text-emerald-200 mb-6">{message}</p>
                <Alert className="bg-emerald-900/20 border-emerald-500/50 mb-4">
                  <AlertDescription className="text-emerald-200 text-sm">
                    Redirecting you to the home page...
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => router.push("/")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Go to Home
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="bg-red-500/20 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
                <p className="text-red-200 mb-6">{message}</p>
                <Alert className="bg-red-900/20 border-red-500/50 mb-4">
                  <AlertDescription className="text-red-200 text-sm">
                    The confirmation link may have expired or is invalid. Please try signing up again.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => router.push("/")}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Return to Home
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}