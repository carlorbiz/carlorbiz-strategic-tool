#!/usr/bin/env python3
"""
Complete data transformation script for RWAV Strategic Plan
Transforms Jan's comprehensive JSON into the format expected by app.js
"""

import json
import os

# Get script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Load Jan's comprehensive JSON
with open(os.path.join(script_dir, 'js/data/rwav-strategic-data.json'), 'r', encoding='utf-8') as f:
    source_data = json.load(f)

# Transform to app.js expected format
transformed_data = {
    "EXECUTIVE_SUMMARY": {
        "currentState": source_data["executiveSummary"]["currentState"]["description"],
        "futureVision": source_data["executiveSummary"]["futureVision"]["description"],
        "evidence": "Survey data from 120 stakeholders reveals overwhelming support for coordination leadership.",
        "requiredDecisions": []
    },
    
    "THREE_PILLARS": {},
    
    "EVIDENCE_BASE": {
        "surveyStats": {},
        "communityWillingness": [],
        "stakeholderQuotes": []
    },
    
    "PILOT_PROGRAM": {
        "communities": []
    },
    
    "FINANCIAL_STRATEGY": {
        "targetRange": "25-30%",
        "revenueStreams": []
    },
    
    "IMPLEMENTATION_TIMELINE": {
        "phases": []
    }
}

# Transform Required Decisions
for decision in source_data["executiveSummary"]["requiredDecisions"]:
    transformed_data["EXECUTIVE_SUMMARY"]["requiredDecisions"].append({
        "id": decision["id"],
        "title": decision["title"],
        "description": decision["description"],
        "priority": decision["urgency"].upper(),
        "dependencies": decision.get("dependencies", [])
    })

# Transform Three Pillars
for pillar_key in ["doers", "drivers", "enablers"]:
    pillar = source_data["threePillars"][pillar_key]
    
    # Transform initiatives
    initiatives = []
    for init in pillar["initiatives"]:
        initiatives.append({
            "name": init["name"],
            "description": init["description"],
            "timeline": init["timeline"],
            "impact": init.get("resourceIntensity", "medium"),
            "connections": []  # Can be populated later if needed
        })
    
    # Transform success metrics
    metrics = []
    for metric in pillar["successMetrics"]:
        # Format target based on unit
        if metric["unit"] == "percent":
            target_str = f"{metric['target']}%"
        elif metric["unit"] == "reforms":
            target_str = f"{metric['target']} reforms"
        elif metric["unit"] == "partnerships":
            target_str = f"{metric['target']} partnerships"
        else:
            target_str = str(metric["target"])
        
        metrics.append({
            "metric": metric["metric"],
            "target": target_str
        })
    
    transformed_data["THREE_PILLARS"][pillar_key] = {
        "id": pillar["id"],
        "title": pillar["title"],
        "subtitle": pillar["subtitle"],
        "icon": f"fa-{pillar['icon']}",
        "objective": pillar["objective"],
        "initiatives": initiatives,
        "successMetrics": metrics
    }

# Transform Evidence Base - Survey Stats
for stat in source_data["evidenceBase"]["keyStatistics"]:
    transformed_data["EVIDENCE_BASE"]["surveyStats"][stat["metric"]] = {
        "value": stat["value"],
        "label": stat["label"],
        "indicator": stat["icon"]  # warning, check-circle, etc.
    }

# Transform Evidence Base - Community Willingness
if "communityWillingness" in source_data["evidenceBase"]:
    for item in source_data["evidenceBase"]["communityWillingness"]:
        transformed_data["EVIDENCE_BASE"]["communityWillingness"].append({
            "activity": item["action"],
            "percentage": item["percentage"]
        })

# Transform Evidence Base - Stakeholder Quotes
if "stakeholderQuotes" in source_data["evidenceBase"]:
    for quote in source_data["evidenceBase"]["stakeholderQuotes"]:
        transformed_data["EVIDENCE_BASE"]["stakeholderQuotes"].append({
            "quote": quote["quote"],
            "attribution": quote.get("attribution", "Survey Respondent"),
            "theme": quote.get("theme", "General")
        })

# Transform Pilot Communities
if "pilotProgram" in source_data:
    # Add overview if it exists
    if "overview" in source_data["pilotProgram"]:
        transformed_data["PILOT_PROGRAM"]["overview"] = source_data["pilotProgram"]["overview"]
    
    for community in source_data["pilotProgram"]["communities"]:
        transformed_data["PILOT_PROGRAM"]["communities"].append({
            "id": community.get("id", community["name"].lower().replace(" ", "_")),
            "name": community["name"],
            "classification": community["classification"],
            "population": community.get("population", "N/A"),
            "focusAreas": community.get("focusAreas", []),
            "strengths": community.get("strengths", []),
            "challenges": community.get("challenges", []),
            "firstNationsContext": community.get("firstNationsContext", "")
        })

# Transform Financial Strategy
if "financialStrategy" in source_data:
    # Add overview data
    if "overview" in source_data["financialStrategy"]:
        overview = source_data["financialStrategy"]["overview"]
        transformed_data["FINANCIAL_STRATEGY"]["ethicalFramework"] = overview.get("subtitle", "")
        transformed_data["FINANCIAL_STRATEGY"]["riskMitigation"] = {
            "principles": overview.get("principles", [])
        }
    
    for stream in source_data["financialStrategy"]["revenueStreams"]:
        # Calculate launchYear based on timeToRevenue
        time_to_revenue = stream.get("timeToRevenue", "12-18 months")
        if "6-12" in time_to_revenue:
            launch_year = 2026
        elif "12-18" in time_to_revenue:
            launch_year = 2027
        else:
            launch_year = 2027
        
        transformed_data["FINANCIAL_STRATEGY"]["revenueStreams"].append({
            "name": stream["name"],
            "target": stream.get("target", stream.get("targetPercentage", "TBD")),
            "description": stream["description"],
            "timeline": stream.get("timeToRevenue", stream.get("timeline", "TBD")),
            "colour": stream.get("color", "#3498DB"),
            "launchYear": launch_year,
            "rampUpYears": [launch_year, launch_year + 1, launch_year + 2, launch_year + 3]
        })

# Transform Implementation Timeline
if "implementationTimeline" in source_data:
    # Remove the default phases array
    transformed_data["IMPLEMENTATION_TIMELINE"].pop("phases", None)
    
    for phase_key in ["year1", "year2", "year3", "year4", "year5"]:
        if phase_key in source_data["implementationTimeline"]:
            phase = source_data["implementationTimeline"][phase_key]
            # Use the phase key directly as the property name
            transformed_data["IMPLEMENTATION_TIMELINE"][phase_key] = {
                "year": phase.get("year", phase.get("years", "TBD")),
                "years": phase.get("years", phase.get("year", "TBD")),
                "title": phase["title"],
                "milestones": phase.get("milestones", []),
                "keyDeliverables": phase.get("keyDeliverables", [])
            }

# Generate JavaScript file
output_js = f"""// Auto-generated from rwav-strategic-data.json
// Generated: {source_data['meta']['lastUpdated']}
// DO NOT EDIT MANUALLY - Run transform-data-complete.py to regenerate

const STRATEGIC_PLAN_DATA = {json.dumps(transformed_data, indent=2, ensure_ascii=False)};

// Make available globally
if (typeof window !== 'undefined') {{
  window.STRATEGIC_PLAN_DATA = STRATEGIC_PLAN_DATA;
}}
"""

# Write output
output_path = os.path.join(script_dir, 'js/strategic-data-inline.js')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(output_js)

print(f"✅ Successfully transformed data!")
print(f"📁 Output: {output_path}")
print(f"📊 Sections transformed:")
print(f"   - Executive Summary: {len(transformed_data['EXECUTIVE_SUMMARY']['requiredDecisions'])} decisions")
print(f"   - Three Pillars: {len(transformed_data['THREE_PILLARS'])} pillars")
print(f"   - Evidence Base: {len(transformed_data['EVIDENCE_BASE']['surveyStats'])} stats")
print(f"   - Pilot Communities: {len(transformed_data['PILOT_PROGRAM']['communities'])} communities")
print(f"   - Financial Streams: {len(transformed_data['FINANCIAL_STRATEGY']['revenueStreams'])} streams")
timeline_count = len([k for k in transformed_data['IMPLEMENTATION_TIMELINE'].keys() if k.startswith('year')])
print(f"   - Timeline Phases: {timeline_count} phases")
