import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { Shield, Radio, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <SEO 
        title="Patrol Tracking System - Real-time Monitoring"
        description="Complete patrol tracking system with mobile check-in and real-time location monitoring for field operations"
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        {/* Header with Auth Link */}
        <div className="absolute top-4 right-4 z-10">
          <Button 
            onClick={() => router.push("/auth/login")}
            variant="outline"
            className="bg-slate-800/50 backdrop-blur-sm border-blue-500/30 text-blue-400 hover:bg-slate-800/70 hover:text-blue-300"
          >
            HQ Sign In
          </Button>
        </div>

        {/* Hero Section */}
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse"></div>
              <Shield className="w-24 h-24 text-blue-400 relative z-10" />
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              Patrol Tracking
              <span className="block text-blue-400 mt-2">System</span>
            </h1>

            <p className="text-xl text-blue-100 mb-12 max-w-2xl leading-relaxed">
              Real-time location monitoring and patrol management system with offline support and MQTT communication
            </p>

            <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
              {/* Mobile Patrol App */}
              <div 
                onClick={() => router.push("/patrol")}
                className="group cursor-pointer bg-slate-800/50 backdrop-blur-sm border-2 border-blue-500/30 rounded-2xl p-8 hover:border-blue-400 hover:bg-slate-800/70 transition-all duration-300 hover:scale-105"
              >
                <div className="flex flex-col items-center">
                  <div className="bg-blue-500/20 p-4 rounded-full mb-4 group-hover:bg-blue-500/30 transition-colors">
                    <Radio className="w-8 h-8 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Patrol Mobile
                  </h2>
                  <p className="text-blue-200 text-sm mb-4">
                    For field personnel
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    Enter Patrol
                  </Button>
                </div>
              </div>

              {/* Desktop HQ Controller */}
              <div 
                onClick={() => router.push("/hq")}
                className="group cursor-pointer bg-slate-800/50 backdrop-blur-sm border-2 border-emerald-500/30 rounded-2xl p-8 hover:border-emerald-400 hover:bg-slate-800/70 transition-all duration-300 hover:scale-105"
              >
                <div className="flex flex-col items-center">
                  <div className="bg-emerald-500/20 p-4 rounded-full mb-4 group-hover:bg-emerald-500/30 transition-colors">
                    <MapPin className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    HQ Control
                  </h2>
                  <p className="text-emerald-200 text-sm mb-4">
                    Command center
                  </p>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Open Dashboard
                  </Button>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-4xl">
              <div className="text-center">
                <div className="bg-blue-500/10 p-3 rounded-lg inline-block mb-3">
                  <MapPin className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-white font-semibold mb-1">Real-time Tracking</h3>
                <p className="text-blue-200 text-sm">Live GPS location updates via MQTT</p>
              </div>

              <div className="text-center">
                <div className="bg-blue-500/10 p-3 rounded-lg inline-block mb-3">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-white font-semibold mb-1">Secure Authorization</h3>
                <p className="text-blue-200 text-sm">Code-based patrol activation system</p>
              </div>

              <div className="text-center">
                <div className="bg-blue-500/10 p-3 rounded-lg inline-block mb-3">
                  <Radio className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-white font-semibold mb-1">Offline Support</h3>
                <p className="text-blue-200 text-sm">Works in low-network conditions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}