# Media Hosting Requirements for Clients

## Overview

The Nera platform processes audio and video content into structured knowledge that powers the AI assistant. To do this, media files must be accessible via URL. **Clients are responsible for hosting their own media files** — the platform does not store original audio or video.

## What We Need From You

For each piece of media content (podcast episode, training video, recorded presentation, etc.), we need:

1. **A stable, accessible URL** that our processing system can reach
2. **Permission to process the content** through our AI transcription pipeline

## Supported Sources

| Source | What to Provide | Notes |
|--------|----------------|-------|
| **YouTube** | The video URL (e.g. `https://www.youtube.com/watch?v=...`) | Public or unlisted videos. Private videos are not supported. |
| **Google Drive** | A sharing link with "Anyone with the link can view" | Right-click > Share > Change to "Anyone with the link" |
| **Podcast hosting** (Spotify for Podcasters, Buzzsprout, etc.) | The direct MP3 episode URL | Usually found in the RSS feed or episode settings |
| **Vimeo** | The direct video file URL | Requires Vimeo Pro/Business for direct links |
| **Self-hosted** | The direct URL to the file | Must be publicly accessible (no login required) |

## Supported Formats

| Type | Formats |
|------|---------|
| **Audio** | MP3, M4A, WAV, OGG |
| **Video** | MP4, WebM, MOV |

## Google Drive Setup (Recommended for Most Clients)

Google Drive is the simplest option for clients who don't already have media hosted elsewhere.

### Steps:

1. Create a shared folder in Google Drive (e.g. "Training Media")
2. Upload your audio/video files to this folder
3. Right-click the folder > **Share** > **General access** > Change to **"Anyone with the link"** > **Viewer**
4. For each file, right-click > **Share** > **Copy link**
5. Provide these links to your Nera administrator

### Important:
- Files must remain at the same URL — do not move, rename, or delete them after providing the link
- If you need to update a file, upload the new version and provide the new link
- Google Drive has a download limit for large files accessed frequently — for high-traffic content, consider a dedicated hosting service

## YouTube (Recommended for Video)

YouTube is the easiest option for video content:

- Upload videos as **Public** or **Unlisted**
- Unlisted videos are not discoverable by search but are accessible via direct link
- Private videos cannot be processed
- No storage limits, no bandwidth concerns

## What Happens to Your Content

1. Our system accesses the media URL
2. The audio/video is transcribed and structured by AI into readable text
3. The text is broken into knowledge chunks stored in your database
4. The AI assistant uses these chunks to answer user questions
5. **We do not store the original media file** — only the processed transcript

## File Size Guidelines

| Type | Recommended Max | Notes |
|------|----------------|-------|
| Audio | 200 MB | ~2 hours of MP3 at 256kbps |
| Video | 2 GB | ~1 hour of 1080p MP4 |

Larger files may take longer to process but are generally supported. For very long recordings (2+ hours), consider splitting into logical segments.

## Questions?

Contact your Nera platform administrator if you need help setting up media hosting.
