# Patrol Tracking System - Complete Real-time Solution

A Progressive Web App (PWA) for real-time patrol monitoring with Android mobile support and desktop HQ control.

## 📊 Current Status:

All features are implemented and tested. The app:
- ✅ Passes all type checks
- ✅ Has no linting errors
- ✅ Uses proper MQTT protocol
- ✅ Implements offline-first architecture
- ✅ Is installable as PWA on Android
- ✅ Has comprehensive error handling
- ✅ Includes live interactive map with patrol markers
- ✅ Integrates Supabase database for persistent storage
- ✅ Saves patrol history and location tracking
- ✅ Displays real-time patrol movements on map

## 🚀 Features

### Mobile Patrol App (Android/Mobile)
- **Authorization System**: Request and enter code from HQ to activate patrol
- **Patrol Form**: Fill in Ptl Name, Comd (Commander), Str (Strength), Wpn (Weapons), Ammo, Purpose
- **Real-time GPS Tracking**: Continuous location updates sent to HQ
- **Database Integration**: All patrol data saved to Supabase for history
- **Offline Support**: Works without internet, queues data for later sync
- **PWA Installation**: Install on Android home screen like a native app
- **Connection Status**: Visual indicators for online/offline and database status

### Desktop HQ Dashboard
- **Live Interactive Map**: Real-time patrol markers with movement tracking
- **Authorization Code Generation**: Generate unique codes for patrol units
- **Live Patrol Monitoring**: See all active patrols with real-time status
- **Visual Map Display**: OpenStreetMap integration with patrol markers
- **Patrol Details Panel**: View commander, strength, weapons, ammo, purpose for each patrol
- **Status Management**: Track patrol start time, duration, online/offline status
- **Patrol History**: View past patrols from database with filters
- **Database Analytics**: Total patrols count, historical data
- **Statistics Dashboard**: Total patrols, personnel count, online/offline units

### Technical Features
- **MQTT Protocol**: Real-time bidirectional communication via HiveMQ Cloud
- **Supabase Backend**: PostgreSQL database for persistent storage
- **Live Map**: Leaflet.js with OpenStreetMap tiles
- **Offline-First Architecture**: LocalStorage queuing for data synchronization
- **Service Worker**: Background sync and offline page caching
- **Responsive Design**: Optimized for mobile and desktop experiences
- **Type-Safe**: Full TypeScript implementation

## Installation on Android

### For Patrol Officers (Mobile):
1. Open Chrome/Edge browser on Android
2. Navigate to the patrol page
3. Tap browser menu and select "Install app" or "Add to Home Screen"
4. App icon appears on home screen
5. Launch like any native Android app

### For HQ Control (Desktop):
1. Open browser (Chrome/Edge/Firefox recommended)
2. Navigate to the HQ dashboard
3. Bookmark for quick access or install as PWA

## How It Works

### 1. Authorization Workflow

HQ Side:
1. HQ opens dashboard
2. Click "Generate Code" button
3. Share generated code with patrol officer
4. Code is saved and ready for validation

Patrol Side:
1. Officer opens mobile app
2. Enters authorization code received from HQ
3. App sends auth request via MQTT to HQ
4. HQ validates code and sends response
5. If valid, patrol form is unlocked

### 2. Patrol Start Workflow

After Authorization:
1. Officer fills patrol form with Ptl Name, Comd, Str, Wpn
2. Click "Start Patrol"
3. GPS tracking begins automatically
4. Location updates sent to HQ every 10 seconds
5. HQ sees patrol appear on dashboard with live location

### 3. Real-time Tracking

Mobile (Patrol):
- GPS acquires location using browser Geolocation API
- Location queued in LocalStorage
- Every 10 seconds, sends batch update via MQTT
- Shows current coordinates on screen
- Connection status indicator (online/offline)

Desktop (HQ):
- Receives location updates via MQTT subscription
- Updates patrol card with latest GPS coordinates
- Tracks "last seen" timestamp
- Marks patrol as "offline" if no update in 2 minutes
- Shows patrol duration timer

### 4. Offline Mode

When Network Lost:
- Mobile app continues GPS tracking
- Locations queued in LocalStorage
- UI shows "Offline Mode" badge
- All data preserved locally

When Network Restored:
- MQTT reconnects automatically
- Queued locations sent to HQ
- Status updates to "Online"
- No data loss

### 5. Ending Patrol

Patrol Side:
1. Officer clicks "End Patrol" button
2. Final location sent to HQ
3. GPS tracking stops
4. LocalStorage cleared
5. App returns to authorization screen

HQ Side:
- Patrol removed from active list
- Historical data preserved

## Technical Architecture

### MQTT Topics Structure
- patrol/auth/request: Patrol requests authorization
- patrol/auth/response: HQ responds with validation
- patrol/start: Patrol announces start with form data
- patrol/location: Continuous GPS updates
- patrol/end: Patrol announces completion
- patrol/heartbeat: Connection health check

### Data Persistence

LocalStorage Keys:
- patrol_auth_code: Current authorization code
- patrol_data: Form data (ptlName, comd, str, wpn)
- patrol_active: Boolean flag for active patrol
- location_queue: Array of GPS points (offline queue)
- mqtt_offline_queue: MQTT messages pending send
- hq_active_patrols: HQ patrol list
- hq_auth_codes: HQ generated codes

## System Requirements

### Mobile (Patrol)
- Android 8.0+ (or iOS 11.3+)
- Chrome/Edge browser (for PWA support)
- GPS/Location services enabled
- 2MB storage for offline data
- Network: Works in 2G/3G/4G/WiFi or offline

### Desktop (HQ)
- Modern browser (Chrome, Edge, Firefox, Safari)
- Screen resolution: 1280x720 minimum
- Stable internet connection recommended
- 5MB storage for patrol history

## Troubleshooting

Mobile App Not Installing:
- Ensure using Chrome/Edge (Safari doesn't support PWA install)
- Check that HTTPS is enabled (PWA requires secure connection)
- Clear browser cache and try again

GPS Not Working:
- Grant location permissions in browser settings
- Ensure location services enabled in Android settings
- Try outdoors for better GPS signal
- Restart app if accuracy is poor

MQTT Connection Failed:
- Check internet connection
- App will work offline and sync when connected
- Try refreshing page

Authorization Not Working:
- Ensure HQ has generated code first
- Wait 5 seconds for response
- Code may have been revoked by HQ

Location Not Updating on HQ:
- Check patrol mobile shows "Online" status
- Verify "Tracking Active" indicator on mobile
- Refresh HQ dashboard

## Built With

Next.js 15, TypeScript, MQTT.js, Tailwind CSS, Shadcn/UI

## 🛠️ Technical Architecture

### Database Schema (Supabase)

**Patrols Table:**
```sql
CREATE TABLE patrols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patrol_id TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  ptl_name TEXT NOT NULL,
  comd TEXT NOT NULL,
  str TEXT NOT NULL,
  wpn TEXT NOT NULL,
  ammo TEXT NOT NULL,
  purpose TEXT NOT NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Locations Table:**
```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patrol_id TEXT NOT NULL REFERENCES patrols(patrol_id),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  accuracy FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### Supabase Setup

1. **Create Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Note your project URL and anon key

2. **Run SQL Schema**:
   - Go to SQL Editor in Supabase dashboard
   - Copy the schema from `src/lib/supabase.ts`
   - Execute to create tables

3. **Configure Environment Variables**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Set Row Level Security**:
   - Tables are configured with public access for demo
   - In production, add proper RLS policies

### Map Integration

**Leaflet Configuration:**
- Uses OpenStreetMap tiles (free, no API key required)
- Real-time marker updates every 10 seconds
- Color-coded markers (green=active, amber=offline, blue=pending)
- Click markers for patrol details popup
- Auto-center on new patrols

**Map Controls:**
- Zoom in/out buttons
- Drag to pan
- Click markers for info
- Responsive sizing

### **Step 4: Monitor on HQ**
- View all active patrols on **live interactive map**
- See real-time GPS markers moving on map
- Click patrol markers for detailed popup
- View patrol cards with full details below map
- Track patrol duration and status
- Monitor online/offline status
- **View patrol history** from database

### **Step 5: End Patrol**
- Patrol officer clicks "End Patrol"
- Final location sent to HQ
- **Data saved permanently to Supabase database**
- Patrol removed from HQ active list
- Historical record retained for analytics