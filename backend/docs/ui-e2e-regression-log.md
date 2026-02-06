# UI E2E Regression Log

Run status: IN_PROGRESS (automation expanded)
Frontend: http://localhost:3010
Backend: http://localhost:3002
Test data: scripts/.test-upload-data.json

## Automation (Playwright)
- Last run: 2026-01-21
- Scenario: login -> notebooks list view toggle -> notebook detail -> upload (paste) request -> notes create
- Scenario: quick note create -> summary generation
- Scenario: share create (chat/full) -> share page permissions
- Result: PASS (upload API returned 404)

## Checklist
- Login (existing test account)
- Home: view toggle (card/list), no search box
- Notebooks list: open existing notebook, create new notebook
- Notebook detail: nav auto-collapse, back button present
- Layout: three columns full height, resizable drag, min width enforced
- Sources: upload (file/website/paste/quick note), checkbox select all + toggle, scroll
- Chat: send message, citations, copy/like/dislike buttons, scroll
- Notes: new note empty, content-only editor, convert to source (locked after)
- Quick note: list + editor, save/clear, summary displayed
- Share: create link (chat/full), warning on full, login required
- Share page: sources visibility per permission, no notes column
- Settings entry
- i18n: CN/EN switch

## Issues
- Upload request returned 404: `/api/sources` not found (likely backend gap).
- Manual coverage still pending for remaining checklist items.
