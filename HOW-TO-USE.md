# How To Use internship-ops

`internship-ops` is a customized setup of `career-ops` for finding and managing **paid tech internships**.

## 1. Add Your Resume

Create `cv.md` in the project root and paste your current resume in markdown.

Suggested sections:
- Summary
- Education
- Experience
- Projects
- Skills
- Achievements

## 2. Fill Your Profile

Open `config/profile.yml` and update:
- your name
- email
- phone
- LinkedIn
- GitHub
- location
- target internship roles

## 3. Review Internship Targeting

Open `modes/_profile.md` and adjust the internship archetypes if needed.

Examples:
- Software Engineering Intern
- Backend Intern
- Full Stack Intern
- AI/ML Intern
- Data Science Intern
- DevOps/Cloud Intern

## 4. Scan For Internships

You can scan from the terminal:

```bash
node scan.mjs
```

Or through the AI workflow:

```text
/career-ops scan
```

This adds matching roles to:
- `data/pipeline.md`
- `data/scan-history.tsv`

## 5. Evaluate Roles

Paste an internship URL or description directly, or process the pipeline:

```text
/career-ops pipeline
```

The system can:
- evaluate the role
- generate a tailored resume PDF
- create a report
- update the tracker

## 6. Generate A Tailored Resume

Use:

```text
/career-ops pdf
```

This uses your `cv.md` and the selected internship context.

## 7. Track Applications

Use:

```text
/career-ops tracker
```

Or use scripts directly:

```bash
node tracker.mjs sync
node tracker.mjs query --json
```

## 8. Review Progress

Use:

```bash
node analyze-patterns.mjs --summary
node followup-cadence.mjs --summary
```

This helps you see:
- which internship types perform best
- where you get rejected
- when to follow up

## Daily Workflow

1. Run the scan
2. Review `data/pipeline.md`
3. Evaluate the best roles
4. Generate tailored resumes for strong matches
5. Apply manually
6. Update the tracker
7. Review follow-ups regularly

## Important Notes

- The system is configured for **paid tech internships**
- The command namespace still uses `/career-ops` so existing tooling keeps working
- The resume is tailored from what exists in `cv.md`; it should not invent experience

## Related File

For a more detailed explanation, also read `INTERNSHIP-OPS.md`.
