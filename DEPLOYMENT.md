# GitHub Pages Deployment Instructions

This repository is now configured for automatic deployment to GitHub Pages. Follow the steps below to enable and complete the deployment.

## Quick Setup

### 1. Enable GitHub Pages in Repository Settings

1. Go to your repository on GitHub: `https://github.com/endoradream-glitch/jubilant-parakeet`
2. Click on **Settings** tab
3. In the left sidebar, click **Pages** (under "Code and automation")
4. Under **Source**, select **GitHub Actions**
5. Save the settings

### 2. Trigger the First Deployment

The deployment will automatically trigger when you:
- Merge this PR to the `main` branch, OR
- Manually trigger the workflow:
  1. Go to **Actions** tab
  2. Click on **Deploy to GitHub Pages** workflow
  3. Click **Run workflow** button
  4. Select `main` branch
  5. Click **Run workflow**

### 3. Access Your Deployed Site

After the workflow completes (usually 2-5 minutes), your site will be available at:

**https://endoradream-glitch.github.io/jubilant-parakeet/**

## Important Notes

### Environment Variables

This application uses Supabase for backend functionality. You need to configure environment variables:

1. The app will work without environment variables during build
2. At runtime, you need to provide Supabase credentials
3. Add environment variables to your `.env.local` file for local development:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

**Optional:** To change the base path (default: `/jubilant-parakeet`), set:
   ```
   NEXT_PUBLIC_BASE_PATH=/your-custom-path
   ```

**Note:** GitHub Pages serves static files only. Environment variables prefixed with `NEXT_PUBLIC_` are embedded during build time. If you need runtime configuration, consider using a different hosting solution like Vercel or Netlify.

### What Was Changed

1. **GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
   - Automatically builds and deploys on push to `main` branch
   - Can also be triggered manually

2. **Next.js Configuration** (`next.config.mjs`):
   - Added `output: 'export'` for static HTML export
   - Added `basePath: '/jubilant-parakeet'` for GitHub Pages subdirectory
   - Added `images: { unoptimized: true }` since GitHub Pages doesn't support Next.js Image Optimization

3. **TypeScript Configuration** (`tsconfig.json`):
   - Added path aliases configuration
   - Excluded Supabase functions directory

4. **Supabase Client** (`src/integrations/supabase/client.ts`):
   - Modified to not throw errors during build time
   - Uses placeholder values if environment variables are missing during build

5. **Jekyll Configuration** (`public/.nojekyll`):
   - Prevents GitHub Pages from processing files with Jekyll

6. **Git Ignore** (`.gitignore`):
   - Excludes build artifacts and dependencies from version control

### Limitations

Since GitHub Pages only serves static files:
- API routes (`/api/*`) will not work
- Server-side rendering is not available
- All pages are pre-rendered at build time
- Real-time features require client-side connections (MQTT still works)

### Testing Locally

Build and test the static export locally:

```bash
npm install
npm run build
```

The static files will be generated in the `out/` directory.

### Troubleshooting

**Build fails in GitHub Actions:**
- Check the Actions tab for error logs
- Ensure all dependencies are in `package.json`
- Verify TypeScript compilation passes

**404 errors on deployed site:**
- Ensure you've enabled GitHub Pages with "GitHub Actions" as source
- Check that the basePath in `next.config.mjs` matches your repository name
- Wait a few minutes for DNS propagation

**App doesn't work on GitHub Pages:**
- Remember that API routes don't work on static hosting
- Verify environment variables are set correctly
- Check browser console for errors

## Next Steps

1. Merge this PR to deploy to production
2. Set up your Supabase project and add credentials
3. Consider using Vercel or Netlify for full Next.js features if needed

## Additional Resources

- [Next.js Static Exports Documentation](https://nextjs.org/docs/pages/building-your-application/deploying/static-exports)
- [GitHub Pages Documentation](https://docs.github.com/pages)
- [GitHub Actions Documentation](https://docs.github.com/actions)
