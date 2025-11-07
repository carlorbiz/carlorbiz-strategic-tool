# RWAV Strategic Tool - Testing Checklist

Use this checklist to verify the tool is working correctly after deployment to Cloudflare Pages.

---

## Pre-Deployment Testing (Local)

### ✅ All Sections Display Content

- [ ] **Executive Overview**
  - [ ] Current State section shows text
  - [ ] Future Vision section shows text
  - [ ] Evidence section shows "Survey data from 120 stakeholders..."
  - [ ] 5 Required Board Decisions display with titles and priorities
  - [ ] Dependencies show correctly (e.g., "Dependencies: strategic_direction")

- [ ] **Three Pillars**
  - [ ] DOERS column displays (green/teal)
  - [ ] DRIVERS column displays (blue)
  - [ ] ENABLERS column displays (orange)
  - [ ] Each pillar shows multiple initiatives
  - [ ] Success metrics display at bottom of each pillar

- [ ] **Community Pulse Survey**
  - [ ] 6 statistics display (91%, 74%, 66%, 92%, 72%, 95%)
  - [ ] Horizontal bar charts display
  - [ ] All text is readable

- [ ] **Pilot Communities**
  - [ ] Overview text displays
  - [ ] Interactive map loads with markers
  - [ ] 3 community cards display (Bendigo, Gippsland Lakes, Mallee)
  - [ ] Each card shows complete information

- [ ] **Financial Strategy**
  - [ ] Revenue Diversification Target gauge displays (25-30%)
  - [ ] Ethical Framework text displays
  - [ ] Revenue Breakdown chart displays (4 streams)
  - [ ] Revenue Stream Launch Timeline chart displays

- [ ] **Implementation Timeline**
  - [ ] 2026 phase displays with 4 milestones
  - [ ] 2027 phase displays with 4 milestones
  - [ ] 2028 phase displays with 3 milestones

### ✅ Interactive Features Work

- [ ] Tab navigation works (clicking each tab changes content)
- [ ] Active tab is highlighted
- [ ] Scrolling works smoothly
- [ ] Charts are interactive (hover shows tooltips)

### ✅ PWA Features Work

- [ ] "Install for Offline Access" button appears
- [ ] Service Worker registers (check browser console)
- [ ] No JavaScript errors in console

### ✅ Browser Compatibility

- [ ] Works in Chrome
- [ ] Works in Edge
- [ ] Works in Firefox
- [ ] Works in Safari (if available)

---

## Post-Deployment Testing (Cloudflare Pages)

### ✅ Deployment Successful

- [ ] Site loads at: https://carlorbiz-strategic-tool.pages.dev
- [ ] No 404 or error pages
- [ ] All assets load (CSS, JS, images)

### ✅ All Sections Display (Same as Local)

- [ ] Executive Overview ✓
- [ ] Three Pillars ✓
- [ ] Community Pulse Survey ✓
- [ ] Pilot Communities ✓
- [ ] Financial Strategy ✓
- [ ] Implementation Timeline ✓

### ✅ PWA Installation

- [ ] Click "Install for Offline Access"
- [ ] App installs successfully
- [ ] Desktop/mobile icon appears
- [ ] App launches from icon

### ✅ Offline Functionality

- [ ] Disconnect from internet
- [ ] App still loads from installed version
- [ ] All content displays offline
- [ ] Charts and visualizations work offline

### ✅ PDF Export

- [ ] Click "Download PDF Summary"
- [ ] PDF generates successfully
- [ ] PDF contains all sections
- [ ] PDF is readable and professional

### ✅ Mobile/Tablet Testing

- [ ] Open site on mobile device
- [ ] All sections display correctly
- [ ] Touch navigation works
- [ ] Charts are readable on small screen
- [ ] Install prompt works on mobile

### ✅ Performance

- [ ] Initial load is fast (< 3 seconds)
- [ ] Tab switching is instant
- [ ] Charts render smoothly
- [ ] No lag or freezing

---

## Known Issues to Check

### ✅ Service Worker Caching

- [ ] If changes don't appear, clear browser cache
- [ ] Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- [ ] Check "Application" tab in DevTools → Clear storage

### ✅ Chart Rendering

- [ ] All charts display correctly
- [ ] No "undefined" or "NaN" values
- [ ] Colors match design (teal, blue, orange)

### ✅ Map Loading

- [ ] Leaflet map loads in Pilot Communities
- [ ] Map tiles display correctly
- [ ] Markers appear for 3 communities

---

## Browser Console Checks

Open browser DevTools (F12) and check:

### ✅ Console Tab
- [ ] "Application initialised successfully" message appears
- [ ] "Service Worker registered successfully" message appears
- [ ] No red error messages
- [ ] No "undefined" or "null" errors

### ✅ Network Tab
- [ ] All files load successfully (green status)
- [ ] No 404 errors
- [ ] strategic-data-inline.js loads correctly

### ✅ Application Tab
- [ ] Service Worker status: "activated and running"
- [ ] Cache storage shows cached files

---

## Final Sign-Off

### ✅ Ready for Board Review

- [ ] All content displays correctly
- [ ] No errors or broken features
- [ ] Professional appearance
- [ ] Offline capability confirmed
- [ ] PDF export works
- [ ] Mobile-friendly

### ✅ Workshop Preparation

- [ ] Test on workshop devices (laptop, tablet)
- [ ] Test on projector/large screen
- [ ] Verify WiFi connectivity (though app works offline)
- [ ] Have backup PDF printed

---

## Troubleshooting

### If sections are empty:
1. Check browser console for errors
2. Verify strategic-data-inline.js loaded correctly
3. Hard refresh the page (Ctrl+Shift+R)
4. Clear browser cache and reload

### If charts don't display:
1. Check if Chart.js loaded (Network tab)
2. Verify no JavaScript errors in console
3. Try a different browser

### If service worker fails:
1. Check if site is served over HTTPS
2. Verify service-worker.js is accessible
3. Try unregistering and re-registering

### If deployment fails:
1. Check Cloudflare Pages build log
2. Verify all files are in GitHub repository
3. Ensure build settings are correct (see DEPLOYMENT_GUIDE.md)

---

## Support Contacts

**Technical Issues:** Check DEPLOYMENT_GUIDE.md and FIXES_APPLIED.md  
**Cloudflare Support:** https://developers.cloudflare.com/pages/  
**GitHub Repository:** https://github.com/carlorbiz/carlorbiz-strategic-tool

---

**Last Updated:** 7 November 2025  
**Version:** 1.0  
**Status:** Ready for Production
