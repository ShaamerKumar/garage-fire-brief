# garage-fire-brief

Paste a Google Place ID for a fire department, get a one-page pre-call brief.
Researched live; every fact links to its source and carries a quote verified
against that page.

**Live:** https://garage-fire-brief.vercel.app

## Run it

```sh
npm install
cp .env.example .env.local   # then fill in the three keys
npm run dev
```

Keys: [Google Places (New)](https://console.cloud.google.com/) ·
[Tavily](https://app.tavily.com) ·
[Vercel AI Gateway](https://vercel.com/docs/ai-gateway)

Try `ChIJpcN7ecgAyIkRrOcWzZx3Yyc` or `ChIJr-yREGP9tEwRr7M-F00PpM8`.

## Other commands

```sh
npm run test:quotes          # quote verification, both directions
npm run probe -- <placeId>   # run the pipeline in the terminal
```
