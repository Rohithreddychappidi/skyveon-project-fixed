# Demo files for local testing

Small placeholder files to upload while testing the course/lesson builder
locally — nothing fancy, just enough to exercise every lesson type's upload
+ conversion + watermarking path without needing your own files handy.

| File | Use it for a lesson of type | What it tests |
|---|---|---|
| `sample-handbook.pdf` | PDF | Direct upload, signed URL streaming, live watermarking |
| `sample-image.jpg` | Image | Direct upload, live watermarking |
| `sample-video.mp4` | Video | Upload, playback, the 90%-watched rule, video watermark burn-in (needs ffmpeg installed on the backend) |
| `sample-presentation.pptx` | PPT | Office → PDF conversion (needs LibreOffice installed on the backend) |
| `sample-document.docx` | Doc | Office → PDF conversion (needs LibreOffice installed on the backend) |

`sample-video.mp4` is 20 seconds of a test pattern + a tone — plenty to
watch past the 90% completion threshold without sitting through a real
training video.
