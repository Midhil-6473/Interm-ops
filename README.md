# interm-ops

`interm-ops` is an internship-focused fork of the original `career-ops` project.
It is designed to help college students find, evaluate, and track **paid tech internships** with a more structured workflow.

## What This Project Does

- Scans job boards and ATS portals for internship opportunities
- Filters for paid, technical, student-relevant roles
- Evaluates internships against a candidate profile and resume
- Generates tailored resume PDFs for strong matches
- Tracks applications, reports, and follow-ups in one place
- Supports interview prep, pattern analysis, and pipeline review

## Core Focus

This fork is tailored for:

- paid internships
- software, backend, full stack, AI/ML, data, and cloud roles
- college students and early-career candidates
- resume-first internship applications

It is meant to improve application quality, not increase spam.

## Main Workflow

1. Add your profile and `resume.md`
2. Configure internship search filters in `portals.yml`
3. Scan for internship openings
4. Evaluate promising roles
5. Generate tailored resumes for strong matches
6. Track progress in the application pipeline

## Key Files

- `resume.md` — canonical candidate resume
- `config/profile.yml` — candidate identity, targeting, preferences
- `modes/_profile.md` — internship-specific framing and personalization
- `portals.yml` — internship scanner configuration
- `reports/` — evaluation reports
- `output/` — generated PDFs
- `data/applications.md` — application tracker

## Commands

- `/interm-ops scan` — scan portals for internship openings
- `/interm-ops pipeline` — process saved internship URLs
- `/interm-ops pdf` — generate a tailored resume PDF
- `/interm-ops tracker` — review application pipeline state
- `/interm-ops apply` — assist with application forms

## Notes

- This repository is a modified fork of the open-source `career-ops` project.
- Upstream attribution and license notice are preserved.
- Personal branding, author promo links, and unrelated creator sections were intentionally removed from this fork’s README so it reflects this project rather than the original author’s profile.

## License

This project remains under the [MIT License](LICENSE).

Because this fork is based on the original upstream code, the upstream copyright notice is preserved in the license file.
If you want to add your own copyright notice for your modifications, the usual approach is to **add your name in addition to the original notice**, not replace the original one.
