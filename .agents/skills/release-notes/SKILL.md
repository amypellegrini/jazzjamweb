---
name: release-notes
description: "Route Play Store release-note requests to musicpracticepro's release-notes skill and tooling. Website-only release announcements require a specified destination and format."
---

# Release notes from the website task

Play Store notes belong to musicpracticepro. This entry point routes to the app's
existing procedure instead of duplicating its tooling in the website.

1. For an explicitly website-only announcement, ask for its destination and format if
   missing. Do not reinterpret it as Play Store notes or write to the app. No website
   release publisher is configured by this skill.
2. For Play Store notes, locate the musicpracticepro sibling in the workbench. Resolve
   its absolute path and check `.agents/skills/release-notes/SKILL.md`, `package.json`,
   `scripts/validate-release-notes.js` and both `whatsnew` locale files exist. If this is
   a standalone website clone without the app, ask for the app checkout location;
   do not create app tooling inside the website.
3. Tell the user the output belongs to the app's `whatsnew/en-US.txt` and
   `whatsnew/en-GB.txt`. Read the app's AGENTS.md and release-notes skill, then follow
   that skill preserving the user's project number and requested scope. Run commands
   with the app as the explicit working directory. If the app is outside the writable
   workspace, prepare the text and obtain required permission before writing it.
4. Report absolute output paths and validation results. Generating notes does not
   authorize committing, pushing, publishing a release or promoting a Play Store build.

Clarify ambiguous output requests before choosing a repository. Do not describe
website-only project issues as app release features.
