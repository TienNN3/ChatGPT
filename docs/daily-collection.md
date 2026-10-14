# Thu thập phản hồi hằng ngày (chạy tự động 6:00 sáng)

Mục tiêu: mỗi sáng thu thập phản hồi của người chơi Play Together Thái Lan **của ngày hôm trước** (theo giờ Asia/Bangkok, UTC+7), cập nhật dữ liệu dashboard, kiểm tra, commit và push lên `main` (GitHub Pages tự deploy).

Repo: `/Users/nhattien/Documents/ChatGPT/PTGTHPlayer` · Production: https://tiennn3.github.io/PTGTHPlayerSentiment/

Đọc trước: `public/how-it-works.md` (quy tắc bắt buộc), `docs/translation-guide.md` (dịch Thái → Việt).

## 0. Phạm vi

- **Ngày mục tiêu** `D` = hôm qua theo giờ Bangkok (chạy lúc 06:00 ngày 15/10 thì `D` = 14/10).
- **Có thu thập**: Facebook group (bài đăng + bình luận), fanpage Thái (chỉ bình luận người dùng), YouTube (video tiếng Thái của creator + bình luận tiếng Thái), TikTok (video tiếng Thái của creator + bình luận tiếng Thái).
- **Bỏ qua**: Sensor Tower (rating và review store). Người dùng tự nhập tay bằng `scripts/import-sensortower-vng.mjs`. Không mở Sensor Tower, không sửa `ratings`.
- Danh sách nguồn và URL: `public/data/sources.json`. Nguồn `pending` / `not_collected` / `inactive`: chỉ mở kiểm tra nhanh trạng thái (đã được duyệt chưa, có bài mới không) rồi ghi vào `last_check`.

## 1. Trình duyệt

- Người dùng để sẵn trình duyệt **Chrome đã đăng nhập Facebook** → dùng Claude in Chrome (`mcp__claude-in-chrome__*`). Không có thì dùng trình duyệt tích hợp (`mcp__Claude_Browser__*`) nếu đã đăng nhập.
- **Không** đăng nhập, nhập mật khẩu, nhập mã 2FA, giải CAPTCHA, tham gia group, bấm like/comment hay gửi gì. Gặp màn đăng nhập / 2FA / checkpoint / CAPTCHA: ghi nguồn đó `status: "blocked"` kèm lý do, bỏ qua và làm tiếp các nguồn khác.
- Facebook chặn fetch/clipboard bằng CSP. Chuyển dữ liệu ra bằng form POST tới máy nhận cục bộ: chạy nền `node scripts/receive-staging.mjs .staging/daily-D/facebook-raw.json` (cổng 4176), trong trang tạo `<form method="post" action="http://127.0.0.1:4176/">` + `<textarea name="payload">` chứa JSON rồi submit.
- Công cụ `javascript_tool` giới hạn ~45 giây: chạy bộ quét nền trong trang (gán vào `window.__job`) rồi hỏi kết quả nhiều lần.

## 2. Thu thập từng nguồn

### Facebook group (các group `full` / `partial` trong `sources.json`)
- Mở `https://www.facebook.com/groups/<id>/?sorting_setting=CHRONOLOGICAL` (New posts), cuộn đến khi gặp bài cũ hơn ngày `D`.
- Ngày giờ bài: đọc **nhãn thời gian hiển thị** (Facebook làm rối DOM, tooltip có thể sai): lấy chữ hiển thị thật của link thời gian, quy đổi "x giờ trước"/"Yesterday at…"/"October 14 at…" về ngày Bangkok. Lấy permalink bằng focus vào link thời gian (href chỉ xuất hiện sau focus/focusin). Kiểm tra chéo: post ID tăng theo thời gian.
- Lấy bài đăng ngày `D` và bình luận đang hiển thị dưới bài (cả bài cũ có bình luận ngày `D` trong Recent activity). Không cần mở hết mọi chuỗi trả lời; ghi rõ điều này trong `detail`.
- Link hợp lệ: `https://www.facebook.com/groups/<id>/posts/<postId>/` và bình luận `...?comment_id=<id>`.
- Bỏ: bài của admin/quảng cáo không phải người chơi, nội dung chỉ có link, spam.

### Fanpage `@playtogetherthailandofficial`
- Chỉ bình luận của người dùng có ngày `D` dưới các bài gần đây. Không lấy bài đăng chính thức, không lấy fanpage Global.

### YouTube
- Tìm `https://www.youtube.com/results?search_query=<từ khoá>&sp=EgIIAg%3D%3D` (lọc hôm nay/tuần) với các từ khoá: `play together`, `playtogether vng`, `เพลย์ทูเก็ตเตอร์`, `play together ไทย`, `#playtogethervng`, tên sự kiện đang chạy.
- Quét RSS kênh creator Thái đã biết: `https://www.youtube.com/feeds/videos.xml?channel_id=<id>` với `UCuRaLOKpnBFgK2K5gbRlcrA, UCiLpWSUJsQGizA1nglqJGog, UCGoL2q1h7J30hnmoWK3AdjQ, UC6PsLX8cJ5s81ZcqjcBhhZQ, UCr15fC3CNa4yrk18385tNDg, UCJ6kqLPI4aALUa0p3kJJUKQ, UCS3hyl-eq4vLKYNXEWTivyg` (DOMParser bị Trusted Types chặn → tách RSS bằng regex).
- Chỉ giữ video có tiêu đề/mô tả chữ Thái, đăng ngày `D`. Mỗi video creator = 1 phản hồi (`content_kind: "video"`); bình luận tiếng Thái ngày `D` dưới video (bình luận cũ chỉ có ngày gần đúng → `date_precision: "approximate"`). Kênh chính thức Play Together VNG TH: chỉ lấy bình luận. Bỏ bình luận của chủ kênh, lời chào, link.

### TikTok
- Quét kênh `@playtogetherth.official` (chỉ bình luận) và creator `@lemondoggopt`, `@rukkung2000`, cùng tìm kiếm `play together`, `เพลย์ทูเก็ตเตอร์`, `#playtogethervng`.
- Ngày video lấy từ ID (giây = `BigInt(id) >> 32n`). Chỉ giữ video tiếng Thái ngày `D`; bình luận tiếng Thái (bỏ bình luận tiếng Việt, chủ kênh, chỉ emoji). Gặp CAPTCHA: ghi `blocked`, không giải.

## 3. Làm sạch, dịch, gắn nhãn

Ghi staging `.staging/daily-D/items.json` theo dạng:

```json
{ "collection": { "collected_at": "<ISO>", "target_date": "D" },
  "items": [ { "source": "Facebook Group", "community": "playtogetherth", "link": "…", "author_masked": "X***",
    "text_th": "…", "text_vn": "…", "text_en": "…", "summary_vn": "…", "summary_en": "…",
    "content_kind": "post|comment|video", "activity_type": "Bài đăng|Bình luận|Video của người chơi",
    "date": "D", "date_basis": "published_at", "published_label": "<nhãn gốc>",
    "sentiment": "Positive|Negative|Neutral|Mixed", "intent": "…", "keywords": ["…"], "theme": "…",
    "engagement": { "reactions": ["Like: 3 people"], "comment_count": 2 } } ] }
```

- Che tên tác giả dạng `X***` (ký tự đầu + `***`). Xoá số điện thoại, LINE ID, email, tên người được tag (thay bằng `[redacted]`).
- `community`: id group (vd `playtogetherth`, `815754622673816`), `@playtogetherthailandofficial` cho fanpage, `YouTube` / `TikTok`.
- Nội dung không xác định được ngày đăng: `date_basis: "observed_at"` (được tách riêng, không tính thống kê).
- `text_vn`: dịch Thái → Việt theo ngữ cảnh game (`docs/translation-guide.md`); **`ค้างคาว` = con dơi**. `text_en` / `summary_en`: tiếng Anh dễ hiểu, không hàn lâm.
- `intent` (1 loại): question, answer, share, event_entry, bug, performance, account, complaint, suggestion, praise, trade, social, chat. `keywords`: 1–4 từ khoá tiếng Việt chữ thường, dùng lại từ vựng có sẵn (xem `terms` trong `public/i18n/en.json`); từ khoá mới thì thêm bản tiếng Anh vào `terms`. `summary_vn`: 1 câu ngắn. `theme`: đúng một nhãn trong `public/data/themes.json`.

## 4. Nhập và kiểm tra

1. Trước khi nhập: `node scripts/import-daily.mjs .staging/daily-D/items.json --dry-run`.
2. Nhập: `node scripts/import-daily.mjs .staging/daily-D/items.json` (chỉ thêm; trùng thì bỏ qua; mục sai định dạng làm cả lượt bị từ chối → sửa staging rồi chạy lại). **Không** dùng `import-facebook.mjs` cho lượt hằng ngày (script đó thay toàn bộ dữ liệu Facebook).
3. Đối chiếu: số mục sau = số mục trước + số mục thêm; không id cũ nào mất; bản dịch cũ không đổi.
4. Cập nhật `public/data/sources.json`: với từng nguồn, ghi `last_check = { target_date: "D", checked_at, status, added_feedback }` và cập nhật `detail` (giữ khoảng ngày đã thu thập, vd "Bài đăng và bình luận hiển thị, 14/09 – D").
5. Ghi `public/data/collection-runs/D.json`: `target_date`, `time_zone`, `checked_at`, `status` (complete/partial/blocked), `added_feedback`, `added_ratings: 0`, `summary_vn` (1–3 câu: thêm bao nhiêu phản hồi từ đâu, nguồn nào bị chặn, Sensor Tower bỏ qua), `sources[]` (key, status, added_feedback, detail), `new_feedback` (theo nguồn, loại, cảm xúc).
6. `npm run check` (= `node scripts/validate-data.mjs && node --test`) phải pass.
7. Mở `http://127.0.0.1:4173/` (`node scripts/serve.mjs`) hoặc kiểm tra bằng trình duyệt: chọn "Hôm qua" → số phản hồi ngày `D` khớp, không lỗi console, cả VI và EN.

## 5. Commit và push

- `git pull --rebase origin main` trước (người dùng có thể đã push từ máy khác).
- Chỉ add file dữ liệu/tài liệu liên quan (`public/data`, `public/i18n/en.json` nếu có từ khoá mới). Không add `.staging/`, `public/reports/`, file ảnh lạ.
- Commit: `Update PTG TH feedback for D` (thân commit: số phản hồi thêm theo nguồn, nguồn bị chặn).
- `git push origin main` (nếu sandbox chặn mạng thì chạy lại lệnh push ngoài sandbox), rồi `gh run watch` để chờ GitHub Pages deploy.
- Không có phản hồi mới: vẫn cập nhật `collection-runs/D.json` + `sources.json` (trạng thái kiểm tra) rồi commit.

## 6. Báo cáo cuối lượt

Tóm tắt ngắn bằng tiếng Việt: ngày `D`, số phản hồi thêm theo nguồn và cảm xúc, nguồn bị chặn và lý do (đăng nhập, 2FA, CAPTCHA, chờ duyệt), commit + trạng thái deploy, việc cần người dùng làm (vd đăng nhập lại Facebook).
