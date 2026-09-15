# GrayDates — CS quiz

Ten topics, twenty questions per round, timed and graded, with an explanation for
every answer. Static site: no build step, no framework, no server.

    index.html          page shell + script tags
    assets/styles.css   wolf / terminal theme
    assets/app.js       quiz engine (routing, storage, timer, grading)
    assets/boot.js      starts the app after the data files register
    data/*.js           one file per topic, 20 questions each
    CNAME               custom domain for GitHub Pages

## Running it locally

    python3 -m http.server 8777

Then open <http://localhost:8777>. Opening `index.html` by double-clicking works
too, but some browsers restrict `localStorage` on `file://`, so the server is safer.

## Publishing to graydates.com

A domain is not hosting. GoDaddy sold you the *name*; you still need somewhere to
serve the files. GitHub Pages is free and works well for a static site like this.

**1. Put the code on GitHub**

    git init
    git add .
    git commit -m "GrayDates quiz"
    git branch -M main
    git remote add origin https://github.com/<you>/graydates.git
    git push -u origin main

**2. Turn on Pages** — repo → Settings → Pages → Source: `main`, folder `/ (root)`.
Wait a minute, then confirm `https://<you>.github.io/graydates/` loads.

**3. Add the custom domain** — same Pages screen, "Custom domain", enter
`graydates.com` and save. The `CNAME` file in this repo already holds that name.

**4. Point the DNS at GitHub** — GoDaddy → My Products → Domains → graydates.com →
DNS → Manage Zones. Delete the parked A record GoDaddy put on `@`, then add:

| Type  | Name | Value                  |
|-------|------|------------------------|
| A     | @    | 185.199.108.153        |
| A     | @    | 185.199.109.153        |
| A     | @    | 185.199.110.153        |
| A     | @    | 185.199.111.153        |
| CNAME | www  | `<you>.github.io`      |

**5. Wait, then tick "Enforce HTTPS"** on the Pages screen once the certificate is
issued. DNS usually takes 10–30 minutes; GoDaddy says up to 48.

Verify with `dig graydates.com +short` — you should see the four GitHub addresses.

### Other hosts

Netlify and Cloudflare Pages both accept a drag-and-drop of this folder and then
give you their own DNS instructions. If you separately bought GoDaddy cPanel
hosting, upload the folder's contents into `public_html` instead and skip the DNS
step entirely.

## Editing questions

Each file in `data/` registers one topic:

    GD.addTopic({
      id: "python",          // used in the URL: #/t/python
      name: "Python",
      sigil: ".py",          // the small mono badge on the card
      blurb: "…",
      questions: [
        { tag: "Lists",                        // subject shown top-right
          q: "How do you add <code>5</code>…", // HTML is allowed
          choices: ["…", "…", "…", "…"],
          answer: 3,                           // 0-based index into choices
          why: "why the correct answer is correct",
          wrong: { 0: "why A is wrong", 1: "…", 2: "…" } }
      ]
    });

Rules the engine assumes: exactly four choices, `answer` is 0–3, and `wrong` has a
note for every index *except* `answer`.

Choice order is shuffled at load time from a hash of the question's own text, so the
correct answer is not always in the same slot — but the shuffle is identical on every
load, which is what keeps a half-finished round valid across a refresh. Editing a
question's text re-shuffles that one question.

Adding a topic: create `data/<name>.js`, then add a `<script defer src>` tag for it
in `index.html` above `assets/boot.js`.

After changing anything, bump the `?v=1` on the script and stylesheet tags in
`index.html` so browsers pick up the new version instead of a cached copy.

## How progress is stored

Everything lives in `localStorage` under `graydates.quiz.v1` — the question order for
the current round, which answers were locked in, the cursor, elapsed time, and your
best score per topic. That is why a refresh lands you back on the question you were
on, and why progress is per-browser rather than per-account.
