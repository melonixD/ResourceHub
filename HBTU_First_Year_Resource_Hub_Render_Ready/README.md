# HBTU First Year Resource Hub

A calm, Apple-inspired student portal for first-year syllabi, lectures, notes and previous-year questions. Built with a lightweight Node.js backend and a dependency-free JavaScript frontend so it is easy to upload to GitHub and deploy on Render.

## What is included

- Premium subject-and-unit file explorer with one focused workspace at a time
- Minimal system typography, neutral surfaces and responsive light/dark themes
- Seven subject areas, each organised into five unit folders
- Search by subject name or unit
- Lectures, notes, PYQs and recommended-books slots inside every unit
- 20 separated PDFs that open directly in the browser
- Syllabus centre with live Google Drive links
- Clear “coming soon” states instead of broken links
- Personal study-task list stored on the device
- 25-minute focus timer
- Light and dark themes
- Fully responsive mobile navigation
- Security headers, health endpoint and Render configuration

## Run locally

1. Install [Node.js 20 or newer](https://nodejs.org/).
2. Open Terminal inside this project folder.
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000`.

For development with automatic server restarts:

```bash
npm run dev
```

## Deploy on Render

### Option A — Blueprint (easiest)

1. Upload the **contents of this folder** to the root of a GitHub repository. `package.json`, `server.js`, `public`, `data` and `render.yaml` must be visible at the repository root.
2. In Render, choose **New + → Blueprint**.
3. Connect the repository.
4. Render detects `render.yaml`; approve the service and deploy.

### Option B — Web Service

1. In Render, choose **New + → Web Service** and connect the repository.
2. Use these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/health` |

No environment variables or database are required.

## Update resources

All subject, syllabus and link content lives in `data/resources.json`. Keep this structure when adding a resource:

```json
{
  "id": "unique-resource-id",
  "type": "lecture",
  "title": "Resource title",
  "description": "Short student-friendly description",
  "url": "https://example.com/resource",
  "available": true
}
```

Supported types are `lecture`, `notes`, `pyq` and `book`. For an upcoming resource, use `null` for the URL and set `available` to `false`.

## Project structure

```text
first-year-resource-hub/
├── data/
│   └── resources.json
├── public/
│   ├── app.js
│   ├── favicon.svg
│   ├── index.html
│   ├── resources/pyqs/        # Browser-viewable unit PDFs
│   └── styles.css
├── test/
│   └── server.test.js
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── render.yaml
└── server.js
```

## API

- `GET /api/health` — deployment health check
- `GET /api/resources` — all hub content
- `GET /api/resources?q=kinetics&type=lecture&subject=chemistry` — filtered content

## Credits

Made with care for HBTU juniors by **Akshat Shukla** and **Priyanshu Dixit**.

## Licence

MIT
