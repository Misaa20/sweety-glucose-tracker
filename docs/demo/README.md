# Sweety app recording

[Watch or download the captioned MP4](sweety-demo.mp4) · [WebVTT captions](sweety-demo.vtt)

The **2 minute 46 second**, 1440 × 900 recording is silent, with captions embedded in the video. The MP4 is approximately 2.6 MB. It demonstrates:

- Patient login and four daily reading slots.
- Missing/out-of-range value feedback and duplicate/full-day validation.
- Creating, editing and deleting a reading, with report updates.
- Daily, month-to-date and previous-month summaries and date selection.
- The monthly chart, its data table and paginated reading history.
- A newly registered patient's empty journal.
- Doctor login and read-only reports for an assigned patient.
- Live Redis cache headers and real BullMQ jobs, including duplicate-log prevention.

The recording uses demo accounts. The extra reading is deleted, the original readings are verified unchanged, and the temporary signup account is removed after recording. The closing bonus-check panel displays results captured during the walkthrough; it is a recording annotation, not an application screen.

## Reproduce

Follow the main README to install, migrate, seed and run the app. Start `npm run worker` in another terminal (or use the full Docker Compose setup). Install Playwright Chromium and have FFmpeg available on your PATH.

```bash
npx playwright install chromium
npm run demo:record
```

To record a different local app URL or use a particular FFmpeg executable:

```bash
npm run demo:record -- http://localhost:3001 --ffmpeg /absolute/path/to/ffmpeg
```

A flow-only rehearsal without video encoding is available:

```bash
npm run demo:record -- --check
```

The script outputs the MP4 and WebVTT files in this directory. Raw takes and subtitle-rendering intermediates stay in ignored `.local/recording-takes/`. Recording does not commit or push files.
