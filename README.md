# RWAV Strategic Workshop PWA

**Progressive Web Application for RWAV Board Strategic Planning Workshop**

A sophisticated, offline-capable web application designed for the Rural Workforce Agency Victoria (RWAV) Board to review, discuss, and make decisions on the 2026-2030 Strategic Plan.

---

## 📋 Overview

This application provides two distinct modes:

### VERSION 1: Static Intelligence Briefing ✅ **COMPLETE**
A professional, visual presentation of the strategic plan content for pre-workshop review by Board members and executives.

### VERSION 2: Interactive Workshop Tool 🚧 **IN DEVELOPMENT**
Live decision engine with AI photo upload for parsing butcher paper/sticky notes, real-time impact modelling, and collaborative decision-making capabilities.

---

## 🎯 VERSION 1 Features

### Executive Overview
- **Current State Analysis**: Clear articulation of RWAV's current operational model
- **Future Vision**: Transformation positioning as Victoria's trusted systems coordinator
- **Required Board Decisions**: Five critical decisions with priority levels and dependencies
- **Post-Approval Actions**: Immediate next steps following Board approval

### Three-Pillar Transformation Framework
- **DOERS** (Teal): Frontline Impact Through Strategic Partnerships
- **DRIVERS** (Blue): Systems Change and Strategic Influence
- **ENABLERS** (Orange): Organisational Transformation and Sustainability

Each pillar displays:
- Key initiatives with impact ratings and timelines
- Success metrics with 2030 targets
- Interactive cards showing initiative connections
- Stakeholder evidence supporting each pillar

### Community Pulse Survey Results
- **6 Stat Cards**: Key survey findings with colour-coded indicators
  - 91% coordination barrier (warning)
  - 74% trust RWAV (confidence)
  - 66% coordination impact (opportunity)
  - 92% partnerships positive (validation)
  - 72% community input barrier (action)
  - 95% willing to contribute (engagement)

- **Horizontal Bar Chart**: Community willingness to contribute across 8 categories
- **Stakeholder Quotes**: Key insights from consultation process

### Three-Community Pilot Program
- **Interactive Map**: Victoria map showing Bendigo, Gippsland Lakes, and Mallee regions
- **Community Cards**: Expandable cards for each pilot community showing:
  - Classification and population
  - First Nations context
  - Focus areas
  - Strengths and challenges
  - Implementation phases
  - Expected outcomes

### Financial Diversification Strategy
- **Target Gauge**: Circular chart showing 25-30% non-government revenue target
- **Revenue Stream Breakdown**: Stacked bar chart of four revenue streams
  - Data Intelligence Services (10-12%)
  - Coordination Administration (8-10%)
  - Strategic Consultation (5-7%)
  - Innovation Partnerships (2-3%)
- **Launch Timeline**: Line chart showing revenue stream ramp-up 2026-2030
- **Ethical Framework**: Risk mitigation principles and pilot testing approach

### 5-Year Implementation Timeline
- **Year 1 (2026)**: Foundation Building
- **Year 2 (2027)**: Coalition Development
- **Year 3 (2028)**: System Integration
- **Years 4-5 (2029-2030)**: Leadership Consolidation

Each year displays milestone nodes with:
- Quarter timing
- Milestone title and description
- Related pillar
- Clickable for detail view

### Progressive Web App Features
- **Offline Capability**: Works completely without internet after initial load
- **Install Prompt**: Can be installed on desktop/mobile for offline access
- **Online/Offline Indicator**: Real-time connection status
- **PDF Export**: Generate professional PDF summary for distribution
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Print Optimisation**: Clean formatting for printing

---

## 🚀 Getting Started

### Option 1: Open in Browser (Online)
Simply open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).

### Option 2: Install as PWA (Recommended for Workshop)
1. Open the application in Chrome or Edge
2. Click the "Install for Offline Access" button in the header
3. The app will be installed on your device
4. Access it anytime from your desktop/home screen, even offline

### Option 3: Local Server (For Development/Testing)
```bash
# Navigate to project directory
cd rwav-workshop-pwa

# Start simple HTTP server
python3 -m http.server 8080

# Open browser to http://localhost:8080
```

---

## 📱 Browser Compatibility

**Fully Supported:**
- Chrome/Edge (Latest 2 versions) - **Recommended**
- Firefox (Latest 2 versions)
- Safari (Latest 2 versions)

**Mobile:**
- iOS Safari
- Android Chrome

---

## 🎨 Design System

### Colour Palette
- **Deep Blue** (#2563eb): Primary colour, strategic elements
- **Teal** (#0891b2): DOERS pillar, coordination theme
- **Warm Orange** (#ea580c): ENABLERS pillar, action items
- **Success Green** (#059669): Positive indicators, validation
- **Warning Red** (#dc2626): Critical items, barriers
- **Accessible Greys**: (#f9fafb to #111827): Text and backgrounds

### Typography
- **Font Family**: Segoe UI (Microsoft Office aesthetic)
- **Headings**: 600 weight, colour #111827
- **Body Text**: 400 weight, colour #374151
- **Professional, spacious layouts**

---

## 📊 Data Structure

All strategic plan content is stored in `js/data.js` as a structured JavaScript object:

```javascript
STRATEGIC_PLAN_DATA = {
  EXECUTIVE_SUMMARY: { ... },
  EVIDENCE_BASE: { ... },
  THREE_PILLARS: { doers, drivers, enablers },
  PILOT_PROGRAM: { communities: [...] },
  FINANCIAL_STRATEGY: { revenueStreams: [...] },
  IMPLEMENTATION_TIMELINE: { year1, year2, year3, years45 },
  CULTURAL_SAFETY: { ... },
  METADATA: { ... }
}
```

This structure allows for:
- Easy updates to content
- Programmatic querying
- Dynamic UI population
- Export to various formats

---

## 📄 File Structure

```
rwav-workshop-pwa/
├── index.html              # Main application shell
├── manifest.json           # PWA configuration
├── service-worker.js       # Offline capability
├── README.md              # This file
├── css/
│   └── styles.css         # Complete design system
├── js/
│   ├── app.js            # Main application logic
│   └── data.js           # Strategic plan content
├── icons/
│   ├── favicon.png       # Browser favicon
│   ├── icon-72.png       # PWA icon
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
└── assets/
    └── images/           # Community photos (to be added)
```

---

## 🔧 Customisation

### Updating Content
Edit `js/data.js` to update any strategic plan content. The UI will automatically reflect changes.

### Styling
Modify CSS variables in `css/styles.css` under the `:root` selector to change colours, fonts, spacing, etc.

### Adding Features
Add new functionality in `js/app.js`. The modular structure makes it easy to extend.

---

## 💾 Offline Capability

The service worker (`service-worker.js`) implements a cache-first strategy:

1. **On Install**: Core assets (HTML, CSS, JS, data) are cached
2. **On Fetch**: Requests are served from cache if available, otherwise from network
3. **Runtime Caching**: External resources (CDN libraries, map tiles) are cached on first use
4. **Update Strategy**: New versions are detected and updated automatically

**Cache Names:**
- `rwav-strategic-pwa-v1.0`: Core application assets
- `rwav-runtime-v1.0`: Runtime-cached resources

---

## 📤 PDF Export

The PDF export feature generates a professional summary including:
- Cover page with RWAV branding
- Executive summary
- Three-pillar framework overview
- Key survey statistics
- Pilot program summary
- Financial strategy overview
- Implementation timeline

**Usage:** Click "Download PDF Summary" button in header.

---

## 🔮 VERSION 2 Features (Coming Soon)

### AI Photo Upload & OCR
- Camera interface for capturing workshop decisions
- Tesseract.js for browser-based OCR
- Sticky note detection by colour
- Text extraction and spatial positioning analysis

### Decision Mapping
- Map extracted decisions to strategic plan content
- Real-time impact modelling
- Dependency visualisation
- Conflict detection

### Interactive Workshop Mode
- Live board input during workshop
- Real-time updates visible to all participants
- Export workshop decisions
- Integration with strategic plan content

### Collaborative Features
- Multiple user input
- Decision tracking
- Version history
- Export to various formats

---

## 🛠️ Technical Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- CSS3 with CSS Variables
- HTML5

**Libraries:**
- Chart.js 4.4.0 (Data visualisations)
- Leaflet 1.9.4 (Interactive maps)
- jsPDF 2.5.1 (PDF generation)
- html2canvas 1.4.1 (PDF export support)
- Font Awesome 6.4.0 (Icons)

**PWA:**
- Service Worker API
- Cache API
- Web App Manifest
- IndexedDB (for VERSION 2)

**Future (VERSION 2):**
- Tesseract.js (OCR)
- TensorFlow.js (Image analysis)
- OpenCV.js (Computer vision)

---

## 📋 Workshop Usage Guide

### Pre-Workshop (1-2 weeks before)
1. **Distribute Access**: Send application link to all Board members
2. **Install Prompt**: Encourage installation for offline access
3. **Review Content**: Board members review all sections independently
4. **Note Questions**: Prepare questions and discussion points

### During Workshop (2 hours)
1. **Executive Overview** (15 min): Review current state and future vision
2. **Three Pillars** (30 min): Discuss and prioritise initiatives
3. **Pilot Communities** (20 min): Select and approve pilot approach
4. **Financial Strategy** (20 min): Approve revenue diversification targets
5. **Implementation Timeline** (20 min): Authorise Phase 1 commencement
6. **Decision Capture** (15 min): Document Board decisions

### Post-Workshop
1. **Export PDF**: Generate summary of approved plan
2. **Distribute**: Share with stakeholders
3. **Action Items**: Initiate post-approval actions

---

## 🎓 Best Practices

### For Facilitators
- **Test beforehand**: Ensure application works on workshop devices
- **Backup plan**: Have PDF printouts available
- **Screen sharing**: Project application for group viewing
- **Time management**: Use tab navigation to keep on track

### For Board Members
- **Pre-read**: Review all sections before workshop
- **Take notes**: Use device notes or paper for questions
- **Engage**: Click through all interactive elements
- **Focus**: One section at a time during discussion

### For Technical Support
- **Check connectivity**: Ensure WiFi available (though app works offline)
- **Browser compatibility**: Use Chrome or Edge for best experience
- **Screen resolution**: Test on projector/large screen
- **Backup devices**: Have tablet/laptop backup ready

---

## 🔒 Data Privacy & Security

- **Client-side only**: All data processing happens in the browser
- **No server**: No data is transmitted to external servers
- **Offline-first**: Works completely without internet
- **Local storage**: Data stored locally on device only
- **No tracking**: No analytics or tracking scripts

---

## 📞 Support & Contact

**Developed by:** Carla Taylor, Carlorbiz  
**Organisation:** Rural Workforce Agency Victoria  
**Version:** 1.0  
**Last Updated:** 6 November 2025

For technical support or questions about this application, contact the workshop facilitator.

---

## 📜 Licence & Copyright

© 2025 Carla Taylor, Carlorbiz. All Rights Reserved.

This application and its content are proprietary to Rural Workforce Agency Victoria and Carlorbiz Consulting. Unauthorised reproduction, distribution, or commercial use is strictly prohibited.

**Individual Section System™** | **Cultural Engagement Methodology**

---

## 🙏 Acknowledgements

**Country Acknowledgement:**
We acknowledge the Traditional Owners of the lands on which RWAV operates across Victoria, and pay our respects to Elders past, present, and emerging. We recognise the ongoing connection of Aboriginal and Torres Strait Islander peoples to Country, culture, and community.

**Pilot Community Traditional Owners:**
- **Bendigo Region**: Dja Dja Wurrung people
- **Gippsland Lakes Region**: Gunaikurnai people  
- **Mallee Region**: Wergaia people

---

**Built for authentic stakeholder engagement with respect, collaboration, and cultural safety at the foundation.**
