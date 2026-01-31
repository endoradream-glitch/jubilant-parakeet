# Vercel Deployment Guide

## Required Environment Variables

Before deploying to Vercel, you need to configure the following environment variables in your Vercel project settings:

### Required Variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

## How to Set Environment Variables in Vercel:

1. Go to your project in the Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with the appropriate value
4. Select the environments where each variable should be available (Production, Preview, Development)
5. Click **Save**

## Deployment Steps:

### Option 1: Deploy via Vercel Dashboard
1. Connect your GitHub repository to Vercel
2. Set the required environment variables (see above)
3. Click **Deploy**

### Option 2: Deploy via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (will prompt for environment variables if not set)
vercel

# For production deployment
vercel --prod
```

## Build Configuration

The project is configured to work with Vercel's default Next.js build settings:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (or `next build`)
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## Development vs Production

### Development Mode
- Uses Turbopack for fast HMR (`npm run dev`)
- Element tagger is enabled for visual editing

### Production Mode
- Uses Webpack for optimized builds
- Element tagger is disabled to ensure clean production builds
- Image optimization is configured for external images via `remotePatterns`

## Troubleshooting

### Build Fails with "Missing Supabase environment variables"
- Ensure environment variables are set in Vercel project settings
- Check that variable names are exact: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Build Succeeds but App Doesn't Work
- Verify Supabase credentials are correct
- Check Vercel deployment logs for runtime errors
- Ensure Supabase RLS policies allow public access where needed

## Next Steps After Deployment

1. Test all authentication flows (login, signup, password reset)
2. Verify patrol tracking functionality works
3. Check HQ dashboard displays correctly
4. Test database connectivity (patrols, locations, authorization)
5. Monitor Vercel Analytics and Logs for any issues
