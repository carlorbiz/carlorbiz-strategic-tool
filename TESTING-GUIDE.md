# Testing Guide for RWAV Strategic Tool

## VERSION 1 Testing (Static Briefing)

### Content Verification:
- [ ] Executive Summary displays correctly
- [ ] Three Pillars show all initiatives
- [ ] Community Pulse Survey has 6 stat cards
- [ ] Charts render properly
- [ ] All text is readable (no truncation)

### Navigation:
- [ ] Tab switching works
- [ ] Scroll behavior is smooth
- [ ] All links work

### Responsive Design:
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)

## VERSION 2 Testing (Workshop Tool)

### OCR Testing:

**Prepare test materials:**
1. Print sticky notes with UIDs (D1, D2, R1, R2, E1, E2)
2. Arrange in 3 columns (HIGH/MEDIUM/LOW)
3. Photograph with phone

**Test workflow:**
- [ ] Switch to Workshop Mode
- [ ] Generate QR code
- [ ] Scan with phone
- [ ] Upload photo
- [ ] Verify OCR detects UIDs
- [ ] Check column position detection
- [ ] Confirm accuracy (should be 80%+)

**Test different conditions:**
- [ ] Good lighting
- [ ] Low lighting
- [ ] Different angles
- [ ] Different phone cameras

### AI Chatbot Testing:

**Test questions:**
- "What are the three strategic pillars?"
- "Explain the pilot program approach"
- "What are the financial targets?"
- "If we delay ENABLERS, what happens?"
- "Categorise this decision: Prioritize DOERS over DRIVERS"

**Check:**
- [ ] Responses are relevant
- [ ] SWOT categorization works
- [ ] Response time is acceptable (<5 seconds)
- [ ] Offline fallback works (disconnect wifi, try again)

### Decision Engine Testing:

**Test scenarios:**
1. Approve all pillars → Check impact
2. Defer one pillar → Check warnings
3. Select 2-region pilot → Check resource estimates
4. Select aggressive financial strategy → Check timeline impacts

**Verify:**
- [ ] Impact calculations make sense
- [ ] Synergies are detected
- [ ] Conflicts are flagged
- [ ] Resource estimates are reasonable

### Complete Workshop Simulation:

**Run through full workflow:**
1. Start in Briefing Mode (review content)
2. Switch to Workshop Mode
3. Upload 3 photos (one per pillar)
4. Confirm OCR results
5. Ask AI chatbot questions
6. Review impact dashboard
7. Make adjustments
8. Export final strategy document

**Time the workflow:**
- Should complete in <15 minutes
- Identify any bottlenecks
- Note UX improvements needed

## Bug Reporting:

**If you find issues, document:**
- What you were doing
- What you expected
- What actually happened
- Browser and device
- Screenshots if possible

**Report to:** [User's contact]
