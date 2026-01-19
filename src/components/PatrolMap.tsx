import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface PatrolMarker {
  id: string;
  ptlName: string;
  lat: number;
  lng: number;
  status: "active" | "offline" | "pending";
  lastUpdate: number;
}

interface PatrolMapProps {
  patrols: PatrolMarker[];
  center?: [number, number];
  zoom?: number;
}

export function PatrolMap({ patrols, center = [1.3521, 103.8198], zoom = 13 }: PatrolMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        // Dynamically import Leaflet
        const L = await import("leaflet");

        // Fix default marker icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        // Initialize map
        if (!mapRef.current && mapContainerRef.current) {
          const map = L.map(mapContainerRef.current).setView(center, zoom);

          // Add tile layer
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(map);

          mapRef.current = map;

          if (mounted) {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error("Failed to initialize map:", err);
        if (mounted) {
          setError("Failed to load map");
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      mounted = false;
      // Clean up markers
      markersRef.current.forEach(marker => {
        try {
          marker.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      markersRef.current = [];

      // Clean up map
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        mapRef.current = null;
      }
    };
  }, [center, zoom]);

  // Update markers when patrols change
  useEffect(() => {
    if (!mapRef.current || isLoading) return;

    const updateMarkers = async () => {
      try {
        const L = await import("leaflet");

        // Remove old markers
        markersRef.current.forEach(marker => {
          try {
            marker.remove();
          } catch (e) {
            // Ignore
          }
        });
        markersRef.current = [];

        // Add new markers
        patrols.forEach(patrol => {
          const statusColor = 
            patrol.status === "active" ? "#10b981" : 
            patrol.status === "offline" ? "#f59e0b" : 
            "#3b82f6";

          const customIcon = L.divIcon({
            className: "custom-marker",
            html: `
              <div style="
                background-color: ${statusColor};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: white;
                font-weight: bold;
              ">
                📍
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const marker = L.marker([patrol.lat, patrol.lng], { icon: customIcon }).addTo(mapRef.current);

          const statusText = 
            patrol.status === "active" ? "🟢 Active" : 
            patrol.status === "offline" ? "🟡 Offline" : 
            "🔵 Pending";

          marker.bindPopup(`
            <div style="min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${patrol.ptlName}</h3>
              <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">
                <div style="display: flex; justify-between;">
                  <span style="color: #666;">Status:</span>
                  <span style="font-weight: 600;">${statusText}</span>
                </div>
                <div style="display: flex; justify-between;">
                  <span style="color: #666;">Location:</span>
                  <span style="font-family: monospace; font-size: 11px;">${patrol.lat.toFixed(6)}, ${patrol.lng.toFixed(6)}</span>
                </div>
                <div style="display: flex; justify-between;">
                  <span style="color: #666;">Last Update:</span>
                  <span style="font-size: 11px;">${new Date(patrol.lastUpdate).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          `);

          markersRef.current.push(marker);
        });

        // Fit bounds if we have patrols
        if (patrols.length > 0 && mapRef.current) {
          const bounds = patrols.map(p => [p.lat, p.lng] as [number, number]);
          const latLngBounds = L.latLngBounds(bounds);
          mapRef.current.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 15 });
        }
      } catch (err) {
        console.error("Failed to update markers:", err);
      }
    };

    updateMarkers();
  }, [patrols, isLoading]);

  if (error) {
    return (
      <div className="w-full h-full bg-slate-900/50 flex items-center justify-center rounded-lg border-2 border-red-500/20">
        <div className="text-center p-6">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <p className="text-red-200 font-semibold mb-2">Map Loading Error</p>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full bg-slate-900/50 flex items-center justify-center rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-sm text-emerald-200">Loading map...</p>
        </div>
      </div>
    );
  }

  if (patrols.length === 0) {
    return (
      <div className="w-full h-full relative" style={{ minHeight: "500px" }}>
        <div 
          ref={mapContainerRef}
          className="w-full h-full rounded-lg border-2 border-emerald-500/20"
          style={{ minHeight: "500px" }}
        />
        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center rounded-lg z-[1000] pointer-events-none">
          <div className="text-center bg-slate-800/90 p-8 rounded-lg border border-emerald-500/30">
            <div className="text-6xl mb-4">📍</div>
            <p className="text-emerald-200 font-semibold mb-2 text-lg">
              No Active Patrols with GPS
            </p>
            <p className="text-blue-200 text-sm">
              Patrols will appear on map once they start tracking
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef}
      className="w-full h-full rounded-lg border-2 border-emerald-500/20"
      style={{ minHeight: "500px" }}
    />
  );
}