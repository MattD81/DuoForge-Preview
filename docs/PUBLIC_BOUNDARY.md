# DuoForge: public showcase and private product boundary

## Suitable for a public GitHub showcase

- Our vision, purpose, approved screenshots and publicly playable demos.
- Curated standalone experiments already intentionally made public.
- Public test results, non-sensitive architecture descriptions and release notes.

## Private by default

- Original DuoForge Sites source, database schema, integration secrets, credentials, private APIs.
- Private game repositories, unpublished assets and internal implementation details.
- Creator identities, user content, project metadata and personal data unless intentionally shared.

## Rules for a future Playable Pull Requests feature

1. Build only from allowlisted, approved public demo source.
2. Isolate untrusted contributions; never run PR code using privileged production tokens.
3. Keep project IDs and commit SHAs explicit, without overwriting existing games.
4. Require owner authorization, tests, review and rollback before production changes.
5. Never expose private repository contents or secrets in Pages, JavaScript, logs or artifacts.
6. Show whether a feature is live, a public preview or merely a roadmap target.

Public visibility is not a blanket open-source license. Keep every included third-party asset and dependency subject to its actual licensing terms.
