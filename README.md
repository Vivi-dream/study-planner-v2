STUDY PLANNER — Real Supabase V1

This version is designed around a real Supabase account/database instead of browser-only localStorage.

Included

email/password account + email confirmation

profile: first name, last name, display name, age, date of birth, class, avatar

subjects with preset/custom color

chapters + lessons/materials

notes, PDF, Word, PowerPoint, image/OCR and YouTube link storage

Supabase Storage for uploaded files

spaced repetition 2/3/5/7 days

flashcards, quizzes, XP, levels, streaks, rewards

calendar with tests/exams/deadlines

to-do list for today/week

Focus mode with optional browser permissions

Lili AI + Study AI tools: summary, flashcards, quiz, mind map, podcast script, test plan

browser speech synthesis for podcast playback

friends without exposing age/birth date in search results

JSON export

Setup

Create a Supabase project.

Supabase > SQL Editor: paste supabase/schema.sql and run it.

Authentication > Providers: keep Email enabled; hosted Supabase normally requires email confirmation by default.

Authentication > URL Configuration: add your Vercel site URL and redirect URL.

In app.js, replace the two placeholders with the Supabase project URL and publishable key.

Push the files to GitHub and deploy to Vercel.

Deploy supabase/functions/lili/index.ts as the lili Edge Function.

Add Edge Function secrets OPENAI_API_KEY and optionally OPENAI_MODEL.

Never put an OpenAI key or Supabase secret/service-role key in browser JavaScript.

Focus limitation

A normal website cannot block other apps or system notifications across an entire device. STUDY PLANNER can request notification permission, fullscreen and Screen Wake Lock where the browser supports them. True OS-wide blocking requires native/OS integration.
