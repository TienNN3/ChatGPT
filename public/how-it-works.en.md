# PTG TH Player Feedback · How it works

This guide explains the goal, data sources, rules and how to update the dashboard. Anyone (person or AI) who picks up this project should read it all before changing data or the UI.

The dashboard has a VI / EN switch. English text of feedback is stored in `text_en` / `summary_en`; Vietnamese (`text_vn`) stays the source of truth. UI strings live in `public/i18n/en.json`.

- Dashboard: https://tiennn3.github.io/PTGTHPlayerSentiment/
- This guide (raw version for AI): https://tiennn3.github.io/PTGTHPlayerSentiment/how-it-works.md
- Repository: https://github.com/TienNN3/PTGTHPlayerSentiment (branch `main`, auto-deployed by GitHub Actions → GitHub Pages)

## 1. Goal

Help the Play Together VNG Thailand ops team quickly see, every day:

- How much feedback came in yesterday, in the last 7 days or 30 days, and the overall trend.
- What players are doing (asking, sharing, joining events, reporting bugs, trading…) and which keywords come up most, day by day.
- What players like, what they are unhappy about, and which bugs / crashes / account issues need action.
- How much feedback each group, fanpage, YouTube channel and store brings in.
- Read the Vietnamese translation first, the original Thai after, always with a source link.

UI language: plain, direct Vietnamese, not academic, no hard-to-read composite scores (just say "mostly positive / negative / neutral", "things to watch").

## 2. Data sources and scope

The source list and collection status live in `public/data/sources.json`. The **By source** tab always shows every source, even ones with no data yet, so "0 feedback" is not confused with "not collected".

| Source | What we collect |
|---|---|
| Facebook Group (Thai) | Both posts and the comments already visible under them: discussion, photo sharing, event entries, sales, trades. We don't open every comment thread. |
| Thai Facebook Fanpage (`playtogetherthailandofficial`) | User comments only. Official posts don't count. Don't use the global fanpage `PlayTogetherGame`. |
| YouTube | Thai videos only (Thai text in title or description). Each creator/player video counts as 1 feedback, plus viewer comments. Videos from the official channel `Play Together VNG TH`: comments only. Skip channel-owner comments and comments that are only links/greetings/promo. |
| TikTok | Thai creator videos about Play Together (found with Thai keywords + scanning creator channels and `@playtogetherth.official`); each video is 1 feedback, plus **Thai** viewer comments. Official channel videos: comments only. Skip channel-owner comments, emoji/greeting-only comments, and **comments from Vietnamese viewers** (TikTok pushes Thai channel videos to Vietnamese users; 94/112 comments on 14/10 were Vietnamese). TikTok search has a CAPTCHA: the user solves it, the AI does not. Post date is taken from the video/comment ID. |
| Google Play, App Store | Reviews with text (Sensor Tower export), **TH** country only. Older reviews (up to 09/2026) are from the Global app (HAEGIN); from 14/10/2026 we also import reviews of the **Play Together VNG** app (Google Play from 06/2026, App Store from 07/2026). Each review names its app (`app_name` or store link) and is fully translated. |
| Sensor Tower ratings | Snapshots of overall rating and new-ratings score, **kept separate for the Play Together VNG app and the Global (HAEGIN) app**, never merged. The VNG app has **daily** snapshots (`granularity: "day"`; Google Play from 13/04/2026, App Store from 04/07/2026); the Global app and older VNG data are **weekly** snapshots (`granularity: "week"`, stored on Monday, summing the whole week). Charts group by week; periods with no data use the last 7 days. Dates follow the calendar dates in the Sensor Tower export. Ratings don't count toward feedback totals. |

Source status: `full` (full 30 days), `partial` (partly), `pending` (private group waiting for approval), `not_collected`, `inactive` (no new posts), `youtube`, `tiktok`, `store`.

## 3. Data rules (required)

1. Never overwrite or delete existing feedback. Every import must compare item counts before/after; all old ids must remain and old translations stay unchanged.
2. Mask author/channel names as `X***`. Remove phone numbers, LINE IDs, emails, names of tagged people. Never store cookies, tokens or personal data in the repo.
3. Content with no known post date (`date_basis=observed_at`) is kept separate and **not** counted in daily stats; it only shows in the Feedback list when the option is turned on.
4. Every number and insight is recalculated for the selected time range and compared with the previous period of the same length. When viewing 1 day, charts still show the 30 days before for context.
5. Previous period under 10 feedback → compare with absolute numbers. Difference ≥ 5x → add the note "may be due to different collection scope".
6. `ค้างคาว` means **bat (the animal)**, not a game freeze (there is a regression test).
7. Dates and times use Asia/Bangkok (UTC+7). Old YouTube comments only have approximate dates (`date_precision=approximate`).

## 4. Labeling each feedback

Each item has these fields:

- `sentiment`: `Positive`, `Negative`, `Neutral`, `Mixed`. Sales posts and normal questions = neutral.
- `intent` (content type, what the player is doing): `question` Question / needs help · `answer` Answer / guide · `share` Sharing / showing off · `event_entry` Event entry · `bug` Bug report · `performance` Crash / lag / performance · `account` Account / login · `complaint` Complaint · `suggestion` Suggestion · `praise` Praise / likes it · `trade` Buying / selling / trading · `social` Finding friends / socializing · `chat` General chat.
- `keywords`: 1–4 Vietnamese keywords, lowercase, preferring the standard keyword set (câu cá, cá hiếm, trồng trọt, rau khổng lồ, nhân sâm, thú cưng, trang phục, bộ sưu tập thẻ, sự kiện, halloween, đảo kaia, cập nhật mới, code quà tặng, vvip pass, gacha, kim cương, nạp tiền, giá vật phẩm, chuyển tài khoản vng, đăng nhập, mất dữ liệu, văng game, lag, kẹt nhân vật, mua bán vật phẩm, cày thuê, đổi thời tiết, tìm bạn, quảng cáo…). Different spellings are merged in `scripts/apply-labels.mjs`.
- `summary_vn`: 1 short sentence on what the player says/does.
- `label_method=ai_review`, `needs_review=true`: labels set by AI following fixed guidelines, need review. The sentiment before review is kept in `sentiment_rule`.
- Old fields are still kept: `theme`, `topic`, `activity_type` (keyword-rule labels), `content_kind` (post/comment/review/video).

"What players like / are unhappy about" is ranked by keyword and excludes `trade`. "Needs action" includes P0/P1 alerts in the data and the `bug`, `performance`, `account`, `complaint` groups, with suggestions from `public/data/facebook-insights.json`.

## 4b. Thai → Vietnamese translation rules

Translations must be clear on first read and fit the game context. No word-by-word Google Translate style. Full guide and glossary: `docs/translation-guide.md` in the repository.

- Translate the meaning, in natural sentences like Vietnamese players chatting in a game group; keep the tone (complaining, joking, urgent questions), don't add information.
- Use context: the source (in a trading group most posts are sales), content type and summary to understand short or cut-off sentences correctly.
- Drop polite particles (ครับ/ค่ะ/นะ/งับ) or turn them into "ạ/nhé/nha"; `555` = "haha".
- Keep `[redacted]`, prices as "10 baht", quantities, English proper names (Golden Chain, VVIP Pass, Halloween, Kaia). Keep sales lists short and listed.
- Unsure about slang: translate with the most reasonable in-game meaning; if truly unclear, add "(?)".
- Store reviews are translated in full (not summarized).
- Common terms: โสม = ginseng (น้ำค้าง dew, แสงจันทร์ moonlight, ออโรร่า aurora); ติดสถานะ = has a special effect; รับฟาร์ม / รับขุด = boosting service; คิวว่าง = taking orders; ทัก = message me; บริการกดสภาพอากาศ = weather change service; เงินฟาร์ม = farm money; ทอง = gold; เพชร = diamonds; กาชา / สุ่ม = gacha / roll; ย้ายข้อมูล / ย้ายไอดี = move data / account to VNG; บัค = bug; หลุด / เด้ง = game crashes; แลค = lag; ค้าง = freeze (only when about the game) — **ค้างคาว = bat**; เวล = level; ไอดี = account.
- Context-based translations have `translation_method=ai_contextual`; old machine translations are kept in `text_vn_machine` for comparison. Apply new translations with `node scripts/apply-translations.mjs <file.json>`.

## 4c. VI / EN switch

- The **EN / VI** button at the top (next to ?) switches the whole dashboard to English and back. The choice is remembered in the browser; `?lang=en` opens English directly.
- Vietnamese is always the source text and is never overwritten. The English version of each feedback item lives in separate fields `text_en` / `summary_en`; if missing, the EN view shows the Vietnamese. The original Thai stays the same in both modes.
- English UI text lives in `public/i18n/en.json`: `ui` holds UI strings (numbers replaced by `{0}`, `{1}`…, data terms by `{t0}`…), `terms` holds keywords, themes and source names. A string with no translation shows in Vietnamese; in EN mode, `window.__i18n.miss` in the console lists what is missing.
- English style: plain and easy to read, not academic.
- When adding new feedback: translate it to English too and apply with `node scripts/apply-english.mjs <file.json>` (format `{ "<id>": { "text": "...", "summary": "..." } }`); add any new keyword to `terms` in `en.json`.

## 5. UI

- **Overview** (key numbers on top, trends in the middle, details below): a row of 5 KPIs (Total feedback, Positive %, Negative %, Needs action = bugs + crash/lag + account + complaints, VNG store rating), each card with change and sparkline, click to go to details; 3 highlight lines + full collapsible summary + Copy report button; Daily trend (sentiment or content type, day/week, count/%; click a bar to open that day's list) and sentiment pie chart; What players are doing and Top keywords (ranked bars, color shows sentiment split); What players like / are unhappy about / Needs action (compact, click to read); Keywords by day heatmap (click a cell to filter by that day + keyword). Detailed notes are in the ⓘ icon.
- **By source**: KPI row (sources with feedback, biggest source, Facebook/YouTube/Store share, most negative source), share-of-discussion pie chart, sentiment by source, per-source cards, list of sources with no data (collapsed), table by source and by day.
- **Store reviews**: KPI row for VNG app rating (Google Play, App Store, new ratings), weekly rating chart, table by app, review KPIs for the period, star distribution, praise / complaint / star-mismatch reviews.
- **Feedback list**: cards, newest first; each card has sentiment, content type, source, summary, translation, original (click to open), keywords (click to filter), link; quick filter chips by sentiment; filters by date, source, sentiment, content type, keyword, text search; CSV download.
- Every clickable chip/card/table filters into the Feedback list. Shareable links per tab: `#overview`, `#sources`, `#store`, `#feedback`.

## 6. File structure

- `public/index.html`: the whole UI and logic (vanilla JS + Chart.js 4.4.1).
- `public/data/index.json`: list of dates with data. `public/data/daily/YYYY-MM-DD.json`: feedback, ratings, alerts, metrics for each day.
- `public/data/sources.json`: source list, display names, status. `public/data/themes.json`: old theme dictionary. `public/data/facebook-insights.json`: action suggestions.
- `scripts/import-facebook.mjs`: imports Facebook staging (**replaces all Facebook items with the staging data** → always merge old + new staging before running; keeps old translations and labels by link+content+author key).
- `scripts/translate-facebook-vietnamese.mjs`: translates Facebook items still missing Vietnamese (cache `.staging/translations-vi.json`).
- `scripts/import-youtube.mjs`, `scripts/import-tiktok.mjs`: add/update `source=YouTube` / `source=TikTok` items by id, without touching other sources.
- `scripts/import-sensortower-vng.mjs`: **use this script** for new Sensor Tower exports (daily ratings + translated/labeled VNG app reviews). Safe merge: only replaces a weekly snapshot when its total new ratings match the daily data; reviews are added/updated by id.
- `scripts/import-sensortower-ratings.mjs`, `import-sensortower-android.mjs`, `import-sensortower-ios.mjs`: old importers, **delete all ratings/reviews of the same type then rewrite**; don't rerun them with a file that covers only part of the date range.
- `scripts/apply-labels.mjs`: applies intent/keywords/summary labels from a JSON file.
- `scripts/apply-translations.mjs`: applies context-based translations (keeps the old one in `text_vn_machine`). `docs/translation-guide.md`: translation rules and glossary.
- `scripts/validate-data.mjs` + `test/*.mjs`: data and UI checks. `.staging/` is git-ignored.

## 7. Update process

1. Collect (Facebook groups via a logged-in browser; YouTube via TH-region search and channel RSS; Sensor Tower export).
2. Clean → staging JSON in `.staging/` (authors masked, no PII).
3. Import with the matching script; compare item counts before/after (no lost ids, no changed old translations).
4. Translate what's missing following `docs/translation-guide.md` (no word-by-word translation); set `intent`, `keywords`, `summary_vn`, review `sentiment` for new items, then run `apply-labels.mjs`.
5. Translate new items to English (`apply-english.mjs`) and add new keywords to `public/i18n/en.json`.
6. Update `sources.json` if the collection scope changes.
7. `npm run check` (validator + tests) must pass; every item must be labeled.
8. Commit and push `main`; GitHub Actions deploys automatically.

## 8. Notes for AI continuing the project

- Read this guide, README.md and `test/dashboard-default.test.mjs` before making changes.
- Don't guess post dates; don't merge the VNG app with the Global app; don't count official fanpage/channel posts as player feedback.
- When adding a new source: add it to `sources.json` (a test requires every source in the data to be on the list), and document its rules in this guide and the README.
- When changing the UI: keep plain, direct Vietnamese; check desktop, mobile (375px), dark mode and no horizontal overflow.

## Desktop and mobile report layout

- The overview starts with insights and **Review first**. P0/P1 alerts are counted separately from feedback about bugs, crashes/lag, accounts, and complaints. Feedback to review is not a count of confirmed product defects.
- **Read feedback to review** opens the list filtered to those four groups. **View alerts** expands the action section. Positive/negative share changes use percentage points; a previous period with fewer than 10 items still uses absolute count changes.
- Mobile keeps all four tabs with short labels, one source card per row, and expandable collection coverage. Search stays visible; advanced filters collapse, while applied filters remain active and visible outside the panel.
- Mobile initially shows the top five activity/keyword rows with **Show all**. The keyword-by-day table expands on demand. Data and filter results remain identical across screen sizes.
- Explanation buttons work by touch and keyboard. KPI cards support Enter/Space; main mobile controls have 44px touch targets.
