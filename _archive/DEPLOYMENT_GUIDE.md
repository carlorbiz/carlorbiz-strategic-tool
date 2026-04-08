# Cloudflare Pages Deployment Guide

## Quick Setup (5 minutes)

### Step 1: Log in to Cloudflare Pages
1. Go to https://dash.cloudflare.com/
2. Log in with your Cloudflare account
3. Navigate to "Workers & Pages" in the left sidebar
4. Click "Create application"
5. Select the "Pages" tab
6. Click "Connect to Git"

### Step 2: Connect GitHub Repository
1. Click "Connect GitHub" (or select existing connection)
2. Select the repository: `carlorbiz/carlorbiz-strategic-tool`
3. Click "Begin setup"

### Step 3: Configure Build Settings
Use these exact settings:

**Project name:** `carlorbiz-strategic-tool` (or choose your own)

**Production branch:** `master`

**Build settings:**
- **Framework preset:** None
- **Build command:** (leave empty - this is a static site)
- **Build output directory:** `/` (root directory)

**Environment variables:** (none needed)

### Step 4: Deploy
1. Click "Save and Deploy"
2. Wait 1-2 minutes for the first deployment to complete
3. Your site will be available at: `https://carlorbiz-strategic-tool.pages.dev`

### Step 5: Custom Domain (Optional)
If you want to use a custom domain:
1. Go to your Pages project settings
2. Click "Custom domains"
3. Click "Set up a custom domain"
4. Follow the DNS configuration instructions

---

## Automatic Deployments

Once set up, Cloudflare Pages will automatically:
- Deploy every push to the `master` branch
- Create preview deployments for pull requests
- Provide deployment status in GitHub

---

## Deployment Status

You can check deployment status at:
- Cloudflare Pages dashboard: https://dash.cloudflare.com/ → Workers & Pages
- GitHub repository: Check the "Deployments" tab

---

## Troubleshooting

### Deployment fails
- Check the build log in Cloudflare Pages dashboard
- Ensure all files are committed and pushed to GitHub
- Verify the build output directory is set to `/`

### Site not loading
- Wait 2-3 minutes after deployment completes
- Clear browser cache and try again
- Check Cloudflare Pages dashboard for deployment status

### Service Worker issues
- The service worker will cache the site for offline use
- To force a fresh load: Open DevTools → Application → Clear storage → Clear site data

---

## Production URL

After deployment, your site will be available at:
**https://carlorbiz-strategic-tool.pages.dev**

(Or your custom domain if configured)

---

## Testing Checklist

After deployment, verify:
- ✅ All 6 sections display correctly
- ✅ Charts and visualizations load
- ✅ Interactive map works
- ✅ Service worker registers successfully
- ✅ "Install for Offline Access" button works
- ✅ PDF export generates correctly
- ✅ Responsive design on mobile/tablet

---

## Updating the Site

To update the deployed site:
1. Make changes locally
2. Commit to Git: `git commit -m "Your message"`
3. Push to GitHub: `git push origin master`
4. Cloudflare Pages will automatically deploy the update (1-2 minutes)

---

## Support

If you encounter issues:
1. Check Cloudflare Pages documentation: https://developers.cloudflare.com/pages/
2. Review deployment logs in the Cloudflare dashboard
3. Contact Cloudflare support if needed
