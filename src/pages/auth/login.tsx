import { useState } from "react";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, Mail, Lock, UserPlus, LogIn } from "lucide-react";
import { authService } from "@/services/authService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  
  // Sign In State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState("");
  
  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState("");
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  
  // Password Reset State
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError("");
    setSignInLoading(true);

    try {
      const { user, error } = await authService.signIn(signInEmail, signInPassword);
      
      if (error) {
        setSignInError(error.message);
      } else if (user) {
        router.push("/hq");
      }
    } catch (err) {
      setSignInError("An unexpected error occurred");
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError("");

    if (signUpPassword.length < 6) {
      setSignUpError("Password must be at least 6 characters long");
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError("Passwords do not match");
      return;
    }

    setSignUpLoading(true);

    try {
      const { user, error } = await authService.signUp(signUpEmail, signUpPassword);
      
      if (error) {
        setSignUpError(error.message);
      } else {
        setSignUpSuccess(true);
      }
    } catch (err) {
      setSignUpError("An unexpected error occurred");
    } finally {
      setSignUpLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetLoading(true);

    try {
      const { error } = await authService.resetPassword(resetEmail);
      
      if (error) {
        setResetError(error.message);
      } else {
        setResetSuccess(true);
      }
    } catch (err) {
      setResetError("An unexpected error occurred");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <SEO 
        title="Authentication - Patrol Tracking System"
        description="Sign in or create an account"
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-slate-800/50 backdrop-blur-sm border-blue-500/30">
          <div className="text-center mb-8">
            <div className="bg-blue-500/20 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Shield className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">HQ Control Access</h1>
            <p className="text-blue-200">Sign in or create an account</p>
          </div>

          {showResetForm ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white text-center mb-4">Reset Password</h2>
              
              {resetSuccess ? (
                <Alert className="bg-emerald-900/20 border-emerald-500/50">
                  <AlertDescription className="text-emerald-200">
                    ✓ Password reset email sent! Check your inbox for further instructions.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  {resetError && (
                    <Alert className="bg-red-900/20 border-red-500/50">
                      <AlertDescription className="text-red-200">{resetError}</AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <Label htmlFor="resetEmail" className="text-white">Email Address</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="your@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="mt-2 bg-slate-900/50 border-blue-500/30 text-white"
                      disabled={resetLoading}
                      required
                    />
                  </div>

                  <Button 
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Email"
                    )}
                  </Button>
                </form>
              )}

              <Button 
                variant="ghost"
                onClick={() => {
                  setShowResetForm(false);
                  setResetError("");
                  setResetSuccess(false);
                }}
                className="w-full text-blue-400 hover:text-blue-300"
              >
                ← Back to Sign In
              </Button>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "signup")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* Sign In Tab */}
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  {signInError && (
                    <Alert className="bg-red-900/20 border-red-500/50">
                      <AlertDescription className="text-red-200">{signInError}</AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <Label htmlFor="signInEmail" className="text-white">Email Address</Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <Input
                        id="signInEmail"
                        type="email"
                        placeholder="your@email.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-blue-500/30 text-white"
                        disabled={signInLoading}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="signInPassword" className="text-white">Password</Label>
                    <div className="relative mt-2">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <Input
                        id="signInPassword"
                        type="password"
                        placeholder="••••••••"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-blue-500/30 text-white"
                        disabled={signInLoading}
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit"
                    disabled={signInLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {signInLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>

                  <Button 
                    type="button"
                    variant="link"
                    onClick={() => setShowResetForm(true)}
                    className="w-full text-blue-400 hover:text-blue-300"
                  >
                    Forgot password?
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up Tab */}
              <TabsContent value="signup" className="space-y-4">
                {signUpSuccess ? (
                  <Alert className="bg-emerald-900/20 border-emerald-500/50">
                    <AlertDescription className="text-emerald-200">
                      <div className="space-y-2">
                        <p className="font-semibold">✓ Account created successfully!</p>
                        <p className="text-sm">Please check your email to verify your account before signing in.</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    {signUpError && (
                      <Alert className="bg-red-900/20 border-red-500/50">
                        <AlertDescription className="text-red-200">{signUpError}</AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <Label htmlFor="signUpEmail" className="text-white">Email Address</Label>
                      <div className="relative mt-2">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
                        <Input
                          id="signUpEmail"
                          type="email"
                          placeholder="your@email.com"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          className="pl-10 bg-slate-900/50 border-blue-500/30 text-white"
                          disabled={signUpLoading}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="signUpPassword" className="text-white">Password</Label>
                      <div className="relative mt-2">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
                        <Input
                          id="signUpPassword"
                          type="password"
                          placeholder="••••••••"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          className="pl-10 bg-slate-900/50 border-blue-500/30 text-white"
                          disabled={signUpLoading}
                          required
                          minLength={6}
                        />
                      </div>
                      <p className="text-xs text-blue-300 mt-1">At least 6 characters</p>
                    </div>

                    <div>
                      <Label htmlFor="signUpConfirmPassword" className="text-white">Confirm Password</Label>
                      <div className="relative mt-2">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
                        <Input
                          id="signUpConfirmPassword"
                          type="password"
                          placeholder="••••••••"
                          value={signUpConfirmPassword}
                          onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                          className="pl-10 bg-slate-900/50 border-blue-500/30 text-white"
                          disabled={signUpLoading}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit"
                      disabled={signUpLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {signUpLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Create Account
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-6 text-center">
            <Button 
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-blue-400 hover:text-blue-300"
            >
              ← Back to Home
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}