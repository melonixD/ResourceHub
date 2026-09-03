# HelpDesk

HelpDesk is a clean, branch-first resource library for HBTU juniors. It uses a lightweight Node.js backend and dependency-free JavaScript frontend, and is ready to deploy on Render.

## What is included

- 14 branches—including Biotechnology—in a focused three-pane browser
- Branch → Semester → Subject → Unit resource navigation
- 6 shared Semester 1 Technology subjects plus one branch-specific Core subject
- Empty Semester 2 and Engineering resource states, ready for later material
- Lectures, Notes, PYQs and Books inside every unit
- 20 separated unit-wise PYQ PDFs that open in the browser
- Two large syllabus groups—Engineering and Technology—with Semester 1 and Semester 2 inside each
- Semester 1 Technology syllabi linked both at the top and inside relevant subjects
- Mobile-friendly vertical branch and subject lists with no sideways scrolling
- Static resource fallback and cache-safe application updates
- Android Chrome and WebView-compatible rendering and touch controls
- Lightweight branch, semester, subject, unit and resource reveal animations
- Local study list and 25-minute focus timer inside the hamburger panel
- Help and contact section with profile photos and revealable WhatsApp details
- Responsive light and dark themes
- Render Blueprint configuration and health endpoint

## Run locally

1. Install [Node.js 20 or newer](https://nodejs.org/).
2. Open a terminal in this project folder.
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000`.

## Deploy on Render

### Blueprint

1. Upload the **contents of this folder** to the root of your GitHub repository.
2. Confirm `render.yaml`, `package.json`, `server.js`, `public`, and `data` are visible on the `main` branch—not inside another folder.
3. In Render, choose **New + → Blueprint** and connect the repository.
4. Render will detect `render.yaml`; approve the `helpdesk-hbtu` service and deploy.

### Web Service

Use these settings if you prefer to create a Web Service manually:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/health` |

No database or environment variables are required.

## Update resources

The navigation and resource links live in `data/resources.json`:

- `branches` controls the branch list and each branch's `semesterSubjectIds`.
- `unitCollections` controls each subject's five units and its lecture, notes, PYQ, and book links.
- `syllabusGroups` controls the two branch groups and the Semester 1 and Semester 2 folders nested inside each.
- `syllabi` controls the individual syllabus links available inside those folders and subjects.

Add a resource URL to an individual unit when it is unit-specific, or to the subject collection when one link should appear in every unit. Use `null` for material that is not available yet.

## Project structure

```text
first-year-resource-hub/
├── data/resources.json
├── public/
│   ├── app.js
│   ├── index.html
│   ├── premium.css
│   ├── resources.json      # Static fallback for the library
│   └── resources/pyqs/   # 20 browser-viewable PDFs
├── test/server.test.js
├── package.json
├── render.yaml
└── server.js
```

## API

- `GET /api/health` — deployment health check
- `GET /api/resources` — complete HelpDesk content
- `GET /api/resources?q=spectroscopy&type=lecture&subject=chemistry` — optional filtered legacy resource response

Made for HBTU juniors by **Akshat Shukla** and **Priyanshu Dixit**. Licensed under MIT.
