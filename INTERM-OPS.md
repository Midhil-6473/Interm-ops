# interm-ops

`interm-ops` is your customized internship-focused fork of the original `career-ops` engine.

It keeps the same workflow and automation, but it is now configured for:
- paid tech internships
- global internship search
- BTech student positioning
- internship-focused resume tailoring
- internship pipeline tracking and follow-ups

## What This Project Does

This project helps you run a disciplined internship search instead of manually checking company career pages every day.

Main capabilities:
- scans job boards and selected company career pages for internship openings
- filters titles toward paid tech internships such as software, backend, full stack, AI/ML, data, and cloud internships
- evaluates each internship against your profile and current resume
- generates a role-tailored resume PDF for strong matches
- keeps reports and application tracking in one place
- helps with follow-ups, pattern analysis, and interview preparation

## What Changed For interm-ops

The underlying engine comes from `career-ops`, but this local workspace is now aimed at internships:
- `config/profile.yml` is set up for a BTech student internship search
- `modes/_profile.md` now frames you as a student builder targeting paid tech internships
- `portals.yml` now looks for internship-style titles and excludes obvious non-tech and unpaid roles

Important:
- commands and scripts still use the existing `interm-ops` naming so nothing breaks
- this is the safest way to turn the repo into `interm-ops` without rewriting the whole system

## Key Files

- `config/profile.yml`
  - your personal targeting, story, location, and internship preferences
- `modes/_profile.md`
  - how the AI should frame you for internship roles
- `portals.yml`
  - scanner configuration for internship discovery
- `resume.md`
  - your current resume in markdown; this is the source used to generate tailored resumes
- `reports/`
  - internship evaluation reports
- `output/`
  - generated resume PDFs
- `data/applications.md`
  - your internship tracker

## How To Use It

### 1. Add your current resume

Paste your current resume into `resume.md`.

Recommended structure:
- Summary
- Education
- Experience
- Projects
- Skills
- Achievements

Once `resume.md` exists, the system can tailor your resume for each internship.

### 2. Fill your personal details

Open `config/profile.yml` and replace the placeholders with your real details:
- name
- email
- phone
- LinkedIn
- GitHub
- location
- target internship roles

### 3. Review internship targeting

Open `modes/_profile.md` and adjust the archetypes if needed.

Examples:
- software engineering intern
- backend intern
- AI/ML intern
- data science intern
- devops/cloud intern

### 4. Scan for internships

Run:

```bash
node scan.mjs
```

Or from the AI command flow:

```text
/interm-ops scan
```

This adds matching opportunities to `data/pipeline.md` and `data/scan-history.tsv`.

### 5. Evaluate internships

Paste a job URL or internship description directly into the AI assistant, or process your inbox:

```text
/interm-ops pipeline
```

For each good match, the system can:
- create a report
- generate a tailored resume PDF
- add/update the tracker

### 6. Generate a tailored resume only

Use:

```text
/interm-ops pdf
```

This uses your `resume.md` plus the internship context to generate a customized resume.

### 7. Track your applications

Use:

```text
/interm-ops tracker
```

You can also use the scripts directly:

```bash
node tracker.mjs sync
node tracker.mjs query --json
```

### 8. Analyze what is working

Use:

```bash
node analyze-patterns.mjs --summary
node followup-cadence.mjs --summary
```

These help you learn:
- which internship types convert best
- where you get blocked
- when to follow up

## Recommended Daily Workflow

1. Run the internship scan
2. Review `data/pipeline.md`
3. Evaluate the best roles first
4. Generate tailored resumes only for strong matches
5. Apply manually
6. Update statuses in the tracker
7. Review follow-ups every few days

## Paid Internship Rule

Your setup is optimized for paid internships, but many postings still hide compensation.

So use this rule:
- if a posting is clearly unpaid, skip it
- if compensation is unclear, flag it before applying
- if the role is paid, technical, and matches your profile, prioritize it

## Resume Tailoring Rule

The system can tailor resumes only from what exists in `resume.md` and related proof sources.

That means:
- do not invent experience
- turn projects into stronger, role-matched bullets
- emphasize coursework, hackathons, open source, internships, and shipped work
- keep the framing honest but sharper

## If You Want A True Full Rename

Right now this repo is functionally customized into `interm-ops` without changing command names.

If you want, a second pass can rename:
- docs
- command text
- package metadata
- visible branding strings

That is optional and separate from the targeting customization already done here.
