# Rear JackMan
A web app to help me keep track of the F1 season. There are many out there, but Rear JackMan is made for busy folks like me, who can't remember what happened in which race (the season is so long now!).

For each race, the app shows:
- basic race details (date and time in local timezone, circuit map, last season's results and race page if any)
- complete championship standings before and after the race
- any relevant news items leading up to the race (only a few—most news is really just fishing)
- "Interesting Facts": Key things which happened in the race. With so many races now, I often forget what happened in a certain race, beyond the final positions. I don’t just want to know that Max won by 5 seconds, or Charles DNF’ed, I’d like to know why.

## Stack
- CloudFlare Workers
- CloudFlare D1
- Tailwind

## Architecture
The app is primarily text-based. The core of this app is data fetching and rendering. Thus there are two main flows:
- Sync: Background task to fetch data from various data sources.
- Serve: UI to render this data

## Todo
- Race page: Show Circuit map
- Sync: Only sync latest rounds since the last complete sync
- Sync: Make sync resumable
- RSS news feeds, piped through a tiny LLM to determine what's actually newsworthy or not
- "Interesting Facts": probably manually curated + LLM-written
