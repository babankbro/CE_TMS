# Use Vercel Blob as the single-JSON datastore (no database)

**Status:** accepted

The app must let ~10 scheduling staff add/edit/delete timetable data and have a Save be
instantly visible to everyone online, deployed on Vercel. We deliberately avoid a relational
database to keep the model as one JSON document. We rejected committing the JSON into the git
repo (Vercel's filesystem is read-only/ephemeral, so the app cannot write back or self-commit,
and a rebuild-per-save is too slow), and rejected Postgres/Supabase as heavier than needed for
this dataset. We store the whole dataset as one JSON blob in Vercel Blob, read on load and
written via a server API route on Save.

## Consequences

- A single shared blob means **last-write-wins**. We mitigate clobbering with an optimistic
  **version guard**: on Save, if the server version is newer, re-fetch latest and re-apply the
  user's single change before writing (auto-merge) rather than overwriting silently.
- No per-user auth in phase 1 — anyone can Save (trusted ~10-person staff group).
- If the dataset or query needs outgrow a single JSON document, this decision must be revisited
  (likely toward Supabase/Postgres).
