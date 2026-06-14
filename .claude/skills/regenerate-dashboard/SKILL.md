---
name: regenerate-dashboard
description: Regenerate the .sensible-harness/assessment-summary.html dashboard from the current assessment.json data. Run after any dimension skill updates a score, or any time the HTML needs refreshing without re-running assessments.
model: haiku
---

# Regenerate assessment dashboard

Read `.sensible-harness/assessment.json` and regenerate `.sensible-harness/assessment-summary.html` from the latest snapshot entry. This skill does not run any assessments — it only rebuilds the HTML from existing data.

## Steps

1. Read `.sensible-harness/assessment.json`. If it does not exist or is empty, stop and tell the user to run `/assess-repo` first.
2. Parse the JSON array and take the **most recent entry** (last in the array).
3. Generate `.sensible-harness/assessment-summary.html` using the full brand design system (Wave `#003049` hero, Sapphire/Jade/Turmeric/Flamingo for score bars, Mist `#EEF2F5` background). The dashboard must include all sections: hero score, dimension score bars with trend indicators, gap summary pills, run history table, score history sparklines, and report links. Follow the design system specified in `.claude/skills/assess-repo/SKILL.md` Phase 14 exactly.
4. Tell the user the output path and the current overall score.
