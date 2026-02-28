# Release Checklist

## Pre-release

- [ ] `bun run build` passes locally
- [ ] Conversion smoke tests pass for top routes (PNG->JPEG, PDF->DOCX, MP4->GIF, WAV->MP3)
- [ ] SEO metadata reviewed (title, description, OG image, canonical)
- [ ] README updated for any new env vars/features
- [ ] CHANGELOG updated under `Unreleased`

## Versioning

1. Bump version in `package.json`.
2. Move `Unreleased` notes to new version in `CHANGELOG.md`.
3. Commit changes.

## Tag + GitHub Release

1. Create tag:
   - `git tag vX.Y.Z`
2. Push tag:
   - `git push origin vX.Y.Z`
3. GitHub Action `Release` will:
   - Build production bundle
   - Attach zip artifact to release
   - Auto-generate release notes

## Production Deploy

- [ ] Confirm latest tag is deployed on Vercel
- [ ] Run final live smoke test on production URL

## Post-release

- [ ] Announce on GitHub Discussions / X / Product Hunt / Reddit communities
- [ ] Monitor runtime errors and conversion failures for 48 hours
