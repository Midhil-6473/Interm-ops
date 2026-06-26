# Repository Guide

## Project Summary

`Interm-ops` is a local job-search automation workspace built on top of the `interm-ops` engine and customized for internship and early-career opportunity management.

It turns an AI coding CLI into a structured command center for:

- evaluating job or internship descriptions
- tailoring resumes and cover letters
- scanning company career pages and ATS portals
- tracking applications and follow-ups
- generating reports and PDFs
- analyzing patterns across your pipeline

The repository is designed to run locally. Your data stays in local markdown, YAML, TSV, and generated output files. The AI agent reads those files, reasons about fit, and helps you operate your search in a disciplined way.

## What The Project Does

At a high level, the project helps a user move from random job searching to a repeatable pipeline:

1. Add personal context such as a resume, profile, preferences, and proof points.
2. Scan job boards and ATS providers for matching roles.
3. Evaluate roles against the user's background.
4. Generate tailored application materials.
5. Store reports and tracker entries.
6. Review patterns, follow-ups, and progress over time.

This is not a mass-application spam tool. The system is built to improve targeting quality, reduce wasted applications, and keep the user in control of final decisions.

## Core Capabilities

### 1. Offer Evaluation

The system can evaluate a pasted URL or raw job description and produce a structured markdown report. Reports typically cover:

- role summary
- resume fit and gap analysis
- seniority or level strategy
- compensation or internship-quality signals
- resume personalization guidance
- interview preparation ideas
- job legitimacy or liveness signals

Reports are stored in `reports/`.

### 2. Resume And Cover Letter Generation

The project can generate ATS-oriented application materials using:

- `templates/resume-template.html`
- `templates/resume-template.tex`
- `templates/cover-letter-template.html`
- Playwright-driven PDF generation

Generated files are written into `output/`.

### 3. Portal Scanning

The scanner can pull listings from:

- Greenhouse
- Lever
- Ashby
- Workday
- Recruitee
- SmartRecruiters
- Workable
- local parsers for custom company career sites

The main scanner entry points are:

- `scan.mjs`
- `scan-ats-full.mjs`

Configuration lives in `portals.yml`.

### 4. Application Tracking

The project maintains a markdown-based tracker for the full pipeline:

- evaluated
- applied
- responded
- interview
- offer
- rejected
- discarded
- skip

The main tracker file is `data/applications.md`.

To protect data integrity, the repo also includes scripts for:

- merging tracker additions
- deduplicating entries
- normalizing statuses
- verifying pipeline consistency

### 5. Pattern Analysis And Follow-Up Support

The project can review historical outcomes and help answer questions like:

- which role types perform best
- where the user tends to be rejected
- which reports are highest scoring
- when the user should follow up

Scripts involved include:

- `analyze-patterns.mjs`
- `followup-cadence.mjs`

### 6. Dashboard

The `dashboard/` directory contains a Go-based terminal UI that provides a visual way to browse and filter the pipeline.

## Who This Project Is For

This repository is useful for:

- students looking for internships
- early-career candidates applying to technical roles
- experienced candidates who want a disciplined AI-assisted job search workflow
- users of Claude Code, OpenCode, Gemini CLI, Codex, Qwen, or similar AI coding CLIs

## Tech Stack

The repository combines a few simple technologies rather than a heavy web app framework:

- Node.js for automation scripts
- `.mjs` modules for core workflows
- Playwright for PDF rendering and liveness checks
- YAML for configuration
- Markdown for source-of-truth documents and reports
- TSV for batch tracker additions
- Go for the optional dashboard TUI

## Main Folders

### Root-Level Purpose

Important root files:

- `AGENTS.md` - canonical operating instructions for the AI agent
- `README.md` - main public project readme
- `HOW-TO-USE.md` - user-oriented workflow notes
- `DATA_CONTRACT.md` - defines which files are user-owned vs system-owned
- `package.json` - scripts and dependencies
- `doctor.mjs` - environment and setup validation

### Key Directories

- `config/` - profile configuration templates and user profile data
- `modes/` - prompt/mode definitions used by supported AI coding CLIs
- `providers/` - ATS and portal provider integrations
- `templates/` - HTML, LaTeX, and status templates
- `data/` - application tracker and pipeline data
- `reports/` - generated evaluation reports
- `output/` - generated PDFs and other outputs
- `dashboard/` - Go terminal UI
- `docs/` - deeper technical and setup documentation
- `examples/` - example data files and reference formats
- `interview-prep/` - interview preparation artifacts
- `jds/` - saved job descriptions

## Important Data Model

This repository follows a strict separation between user data and system logic.

### User Layer

These files hold personal data and should not be overwritten by system updates:

- `resume.md`
- `config/profile.yml`
- `modes/_profile.md`
- `article-digest.md`
- `portals.yml`
- `data/*`
- `reports/*`
- `output/*`
- `interview-prep/*`

### System Layer

These files are safe to update from upstream:

- `modes/_shared.md`
- other files in `modes/`
- `*.mjs` scripts
- `templates/*`
- `dashboard/*`
- repository-level documentation files

For the full rule set, see `DATA_CONTRACT.md`.

## Setup Instructions

### Prerequisites

Install these before using the project:

- Node.js 18+ minimum
- Git
- an AI coding CLI such as Claude Code, OpenCode, Gemini CLI, Codex, or Qwen
- optionally Go 1.21+ for the dashboard

If you want PDF rendering, install Playwright Chromium:

```bash
npx playwright install chromium
```

### Install Dependencies

From the project root:

```bash
npm install
```

### Validate The Environment

Run:

```bash
npm run doctor
```

This checks whether the workspace is ready and whether required files are present.

## First-Time Configuration

The project usually expects these files to exist:

- `resume.md`
- `config/profile.yml`
- `modes/_profile.md`
- `portals.yml`

### 1. Add Your Resume

Create `resume.md` in the project root and write your resume in markdown.

Recommended sections:

- Summary
- Experience
- Projects
- Education
- Skills

### 2. Create Your Profile

Use `config/profile.example.yml` as the starting point for `config/profile.yml`.

Include:

- full name
- email
- location
- timezone
- target roles
- salary or stipend expectations
- work preferences and constraints

### 3. Personalize The AI Framing

Use `modes/_profile.md` for user-specific framing, including:

- archetypes
- strengths
- positioning narrative
- negotiation preferences
- deal-breakers

### 4. Configure Portals

Create `portals.yml` from `templates/portals.example.yml` and adjust the title filters and company list to match your target roles.

## How To Use The Project

There are two main ways to use this repository:

- through an AI coding CLI using the `interm-ops` command namespace
- by running Node scripts directly

### Typical AI-Driven Usage

Inside your AI coding CLI, common commands are:

```text
/interm-ops
/interm-ops scan
/interm-ops pipeline
/interm-ops pdf
/interm-ops cover
/interm-ops tracker
/interm-ops apply
/interm-ops batch
/interm-ops deep
/interm-ops training
/interm-ops project
```

In many cases, simply pasting a job URL or raw job description is enough for the system to infer the intended workflow.

### Typical Script Usage

Useful script commands from `package.json`:

```bash
npm run doctor
npm run scan
npm run pdf
npm run tracker
npm run verify
npm run merge
npm run dedup
npm run normalize
npm run patterns
npm run update:check
```

## Recommended Workflow

### Daily Workflow

1. Run a scan for new roles.
2. Review `data/pipeline.md`.
3. Evaluate the strongest matches first.
4. Generate tailored resumes only for good-fit roles.
5. Apply manually after review.
6. Keep `data/applications.md` updated.
7. Review follow-ups and recurring patterns weekly.

### Best-Practice Workflow

- use the scanner to discover opportunities
- use evaluation before applying
- avoid low-fit roles
- keep tracker statuses canonical
- review reports before sending any application materials
- keep personal data in user-layer files only

## Important Scripts

### Setup And Health

- `doctor.mjs` - checks prerequisites and missing required files
- `verify-pipeline.mjs` - validates tracker integrity
- `resume-sync-check.mjs` - checks consistency across resume-related files

### Tracker Integrity

- `merge-tracker.mjs` - merges batch additions into the tracker
- `dedup-tracker.mjs` - removes duplicate tracker rows
- `normalize-statuses.mjs` - maps statuses to canonical values
- `tracker.mjs` - tracker sync, query, and related operations

### Discovery And Evaluation

- `scan.mjs` - scans configured portals
- `scan-ats-full.mjs` - broader ATS discovery mode
- `check-liveness.mjs` - checks whether postings are still live
- `role-matcher.mjs` - role matching support logic

### Output Generation

- `generate-pdf.mjs` - renders HTML to PDF
- `generate-cover-letter.mjs` - cover letter generation support
- `generate-latex.mjs` - LaTeX generation workflow
- `build-resume-latex.mjs` - LaTeX build support

### Analysis

- `analyze-patterns.mjs` - analyzes historical application performance
- `followup-cadence.mjs` - follow-up timing support

### Updating

- `update-system.mjs` - checks, applies, dismisses, or rolls back system updates

## Batch Processing

The repository supports batch evaluation with worker prompts and batch orchestration.

Relevant paths:

- `modes/batch.md`
- `batch/batch-prompt.md`
- `batch/batch-runner.sh`

After batch evaluations, the tracker additions should be merged into the main tracker using:

```bash
npm run merge
```

## Multi-Language Support

The repo includes language-specific mode directories such as:

- `modes/de/`
- `modes/fr/`
- `modes/ar/`
- `modes/ja/`
- `modes/tr/`
- `modes/pt/`
- `modes/ru/`
- `modes/ua/`

These allow the project to operate with localized prompts and market-specific language where needed.

## Documentation Map

Use these files for deeper reference:

- `README.md` - main public project presentation
- `HOW-TO-USE.md` - practical usage notes
- `docs/SETUP.md` - setup guide
- `docs/SCRIPTS.md` - script reference
- `docs/ARCHITECTURE.md` - architecture overview
- `docs/CUSTOMIZATION.md` - customization guidance
- `DATA_CONTRACT.md` - user vs system file ownership
- `LEGAL_DISCLAIMER.md` - legal and responsibility notes

## Safety And Usage Rules

Important operating principles:

- never auto-submit an application without final human review
- prefer quality over quantity
- do not invent experience in generated resumes
- do not store user-specific customizations in shared system files
- do not add tracker entries manually when batch tracker additions are expected
- use canonical statuses from `templates/states.yml`

## Why This Repository Is Useful On Git

If you are pushing this project to Git, this repository already contains:

- a clear separation of source files and user data
- reproducible Node-based scripts
- examples and templates for onboarding
- automation around scanning, evaluation, PDF generation, and tracking
- supporting docs for setup, architecture, customization, and governance

That makes it suitable for:

- personal portfolio-style project publishing
- open-source sharing
- team collaboration on the system layer
- local private use with personal data kept under control

## Suggested Files To Review Before Publishing

Before pushing publicly, review these files carefully:

- `README.md`
- `package.json`
- `resume.md`
- `config/profile.yml`
- `portals.yml`
- `data/*`
- `reports/*`
- `output/*`
- `.env`

Make sure no personal or sensitive information is committed accidentally.

## Final Notes

This project is best understood as a local AI-assisted career operations system rather than a traditional web application. Its value comes from combining:

- structured prompts
- local source-of-truth files
- reproducible scripts
- automation for discovery and document generation
- a disciplined application workflow

If you want this repository to look even stronger on GitHub, the next useful step would be a second pass to clean and standardize the public `README.md`, package metadata, and visible naming so the branding is fully consistent before you push.
