import json

# Read source data
with open('js/data/rwav-strategic-data.json', 'r') as f:
    data = json.load(f)

# Transform to app.js format
transformed = {
    "EXECUTIVE_SUMMARY": {
        "currentState": data["executiveSummary"]["currentState"]["description"],
        "futureVision": data["executiveSummary"]["futureVision"]["description"],
        "requiredDecisions": [
            {
                "title": dec["title"],
                "description": dec["description"],
                "priority": dec["urgency"],
                "dependencies": dec.get("dependencies", [])
            }
            for dec in data["executiveSummary"]["requiredDecisions"]
        ]
    },
    "EVIDENCE_BASE": {
        "surveyStats": {
            stat["metric"]: stat["value"]
            for stat in data["evidenceBase"]["keyStatistics"]
        },
        "keyFindings": [
            finding["text"]
            for finding in data["evidenceBase"].get("keyFindings", [])
        ],
        "stakeholderQuotes": [
            {
                "quote": quote["quote"],
                "attribution": quote["attribution"],
                "category": quote.get("category", "general")
            }
            for quote in data["evidenceBase"].get("stakeholderQuotes", [])
        ]
    },
    "THREE_PILLARS": {
        "doers": data["threePillars"]["doers"],
        "drivers": data["threePillars"]["drivers"],
        "enablers": data["threePillars"]["enablers"]
    },
    "PILOT_PROGRAM": {
        "communities": data["pilotProgram"]["communities"]
    },
    "FINANCIAL_STRATEGY": data["financialStrategy"],
    "IMPLEMENTATION_TIMELINE": data["implementationTimeline"]
}

# Write as JavaScript
with open('js/strategic-data-inline.js', 'w') as f:
    f.write('/**\n')
    f.write(' * RWAV Strategic Plan Data - Inline Version\n')
    f.write(' * Auto-generated from rwav-strategic-data.json\n')
    f.write(' * Australian English spelling throughout\n')
    f.write(' */\n\n')
    f.write('window.STRATEGIC_PLAN_DATA = ')
    f.write(json.dumps(transformed, indent=2))
    f.write(';\n')

print("✅ Inline data created: js/strategic-data-inline.js")
