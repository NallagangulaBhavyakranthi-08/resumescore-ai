# ResumeScore AI

ResumeScore AI is a responsive resume analyzer that compares a resume with a target role and returns structured, evidence-based feedback. The app uses a FastAPI backend and Google's Gemini API; the API key is never sent to the browser.

## Features

- Upload PDF, DOCX, and TXT resumes (up to 5 MB), or paste resume text.
- Compare skills and experience with a job description.
- Review neutral employment timeline observations and location fit.
- See a weighted overall score, matching and missing keywords, and improvement examples.
- Download a PDF analysis report.
- Keep up to ten analysis summaries in browser-local history. Resume text and files are not stored in that history.
- Responsive dashboard with PDF preview.

The overall score is calculated by the backend using available category scores: skills 35%, experience 35%, timeline 15%, and location 15%. If a category is unavailable, the remaining weights are normalized. Timeline scoring is unavailable when no date information is found. Location scoring requires both a candidate-preferred location and a job location. Career breaks are treated neutrally.

## Run locally (Windows PowerShell)

```powershell
cd D:\Jobtogether
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

In `.env`, set `GEMINI_API_KEY` to a newly created key from Google AI Studio. Do not paste API keys into source files, browser code, GitHub, or chat. The previously shared key should be revoked and replaced. `GEMINI_MODEL` can be changed to another model enabled for your Gemini API project.

Start the app:

```powershell
python server.py
```

Open <http://127.0.0.1:8000>. Check the backend at <http://127.0.0.1:8000/health>.

## Deploy to Vercel

1. Push this folder to a GitHub repository (keep `.env` out of Git).
2. Import the repository in Vercel, or run `vercel --prod` from this folder.
3. In the Vercel project settings, add `GEMINI_API_KEY` as an environment variable for Production (and Preview if desired). Set `GEMINI_MODEL` if needed.
4. Redeploy after setting environment variables.
5. Test `/health` and run an analysis with a non-sensitive sample resume.

Do not pass the API key as a command-line argument or commit it. The deployed analysis endpoint is public; configure Google API key restrictions and usage quotas for your project, and rotate the key if it is exposed.

## API

- `GET /` — serves the web app.
- `GET /health` — health check.
- `POST /api/analyze` — accepts multipart form fields `resume_text`, `job_description`, `preferred_location`, `job_location`, `work_arrangement`, `target_job_title`, and optional resume `file`.
- `POST /api/report` — accepts a JSON analysis object and returns a PDF.

Uploaded resume text is sent to Gemini only when the user requests analysis. It is processed in memory and is not retained by this application. Gemini's service terms govern processing by Google. Browser history stores report feedback locally on the device until cleared.

## Checks

```powershell
python -m compileall -q server.py api\index.py
node --check script.js
```
