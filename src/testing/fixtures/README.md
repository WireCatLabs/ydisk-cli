# Test fixtures

Copied byte for byte from cli-core's `src/testing/fixtures/` (WireCatLabs/cli-core, release 0.722.0), where their
README says how each was made. Invented data only.

- `budget.xlsx`: one sheet "Synthetic Budget", a header row, a date, a percentage format and a formula (`B4`).
- `letter.docx`: a heading, a paragraph with one bold word, a plain paragraph, a two-cell table and a closing
  paragraph.

`src/edit.test.ts` edits them through the fake Disk, and `scripts/live.sh` uploads them to the live test folder.
