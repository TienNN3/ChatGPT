# PTG TH Player Feedback · Cách hoạt động

Tài liệu này mô tả mục tiêu, nguồn dữ liệu, quy tắc và cách cập nhật dashboard. Người hoặc AI tiếp tục dự án nên đọc hết trước khi sửa dữ liệu hay giao diện.

- Dashboard: https://tiennn3.github.io/PTGTHPlayerSentiment/
- Tài liệu này (bản thô cho AI đọc): https://tiennn3.github.io/PTGTHPlayerSentiment/how-it-works.md
- Repository: https://github.com/TienNN3/PTGTHPlayerSentiment (branch `main`, deploy tự động bằng GitHub Actions → GitHub Pages)

## 1. Mục tiêu

Giúp người vận hành Play Together VNG Thái Lan mỗi ngày nắm nhanh:

- Hôm qua, 7 ngày hoặc 30 ngày qua có bao nhiêu phản hồi, xu hướng chung ra sao.
- Người chơi đang làm gì (hỏi, chia sẻ, tham gia sự kiện, báo lỗi, mua bán…) và nhắc tới từ khoá nào nhiều nhất, theo từng ngày.
- Người chơi thích gì, chưa hài lòng gì, có lỗi / crash / vấn đề tài khoản nào cần xử lý.
- Mỗi group, fanpage, kênh YouTube, store đóng góp bao nhiêu phản hồi.
- Đọc bản dịch tiếng Việt trước, nguyên văn tiếng Thái sau, luôn có link nguồn.

Ngôn ngữ giao diện: tiếng Việt trực tiếp, không hàn lâm, không dùng chỉ số tổng hợp khó hiểu (chỉ nói "chủ yếu tích cực / tiêu cực / trung tính", "điểm cần chú ý").

## 2. Nguồn dữ liệu và phạm vi

Danh sách nguồn và trạng thái thu thập nằm ở `public/data/sources.json`. Tab **Theo nguồn** luôn hiện đủ các nguồn này, kể cả nguồn chưa có dữ liệu, để phân biệt "0 phản hồi" với "chưa thu thập".

| Nguồn | Lấy gì |
|---|---|
| Facebook Group (Thái) | Cả bài đăng và bình luận hiển thị sẵn dưới bài: thảo luận, khoe ảnh, tham gia sự kiện, rao bán, trao đổi. Không mở hết từng chuỗi bình luận. |
| Facebook Fanpage Thái (`playtogetherthailandofficial`) | Chỉ bình luận của người dùng. Không tính bài đăng chính thức. Không dùng fanpage global `PlayTogetherGame`. |
| YouTube | Chỉ video tiếng Thái (tiêu đề hoặc mô tả có chữ Thái). Mỗi video của creator/người chơi tính là 1 phản hồi, cộng bình luận của người xem. Video của kênh chính thức `Play Together VNG TH` chỉ lấy bình luận. Bỏ bình luận của chủ kênh, bình luận chỉ có link/lời chào/quảng bá. |
| TikTok | Video tiếng Thái của creator nói về Play Together (tìm bằng từ khoá tiếng Thái + quét kênh creator và `@playtogetherth.official`), mỗi video là 1 phản hồi, cộng bình luận **tiếng Thái** của người xem. Video kênh chính thức chỉ lấy bình luận. Bỏ bình luận của chủ kênh, bình luận chỉ có emoji/lời chào, và **bình luận của người xem Việt Nam** (TikTok đẩy video kênh Thái cho người Việt; 94/112 bình luận ngày 14/10 là tiếng Việt). Trang tìm kiếm TikTok có CAPTCHA: người dùng tự giải, AI không giải. Ngày đăng lấy từ ID video/bình luận. |
| Google Play, App Store | Review có nội dung (Sensor Tower export). Cột tiếng Việt của review cũ là tóm tắt phân loại, không phải bản dịch. |
| Rating Sensor Tower | Snapshot điểm tích lũy và điểm lượt mới theo tuần, **tách riêng app Play Together VNG và app Global (HAEGIN)**, không gộp. Rating không tính vào số phản hồi. |

Trạng thái nguồn: `full` (đủ 30 ngày), `partial` (một phần), `pending` (group riêng tư chờ duyệt), `not_collected`, `inactive` (không có bài mới), `youtube`, `tiktok`, `store`.

## 3. Quy tắc dữ liệu (bắt buộc)

1. Không ghi đè hoặc xoá phản hồi đã có. Mọi lần import phải đối chiếu số mục trước/sau; id cũ phải còn đủ và bản dịch cũ giữ nguyên.
2. Che tên tác giả/kênh dạng `X***`. Xoá số điện thoại, LINE ID, email, tên người được tag. Không lưu cookie, token, dữ liệu cá nhân vào repo.
3. Nội dung không xác định được ngày đăng (`date_basis=observed_at`) được tách riêng, **không** cộng vào thống kê theo ngày; chỉ xem được trong Danh sách phản hồi khi bật tùy chọn.
4. Mọi số liệu, nhận định tính lại theo đúng khoảng thời gian đang chọn và so với kỳ liền trước cùng số ngày. Khi xem 1 ngày, biểu đồ vẫn hiện 30 ngày trước đó làm bối cảnh.
5. Kỳ trước dưới 10 phản hồi → so sánh bằng số tuyệt đối. Chênh lệch ≥ 5 lần → ghi chú "có thể do phạm vi thu thập khác nhau".
6. `ค้างคาว` là **con dơi**, không phải lỗi treo game (có regression test).
7. Ngày giờ quy về Asia/Bangkok (UTC+7). Bình luận YouTube cũ chỉ có ngày gần đúng (`date_precision=approximate`).

## 4. Phân loại mỗi phản hồi

Mỗi mục có các trường:

- `sentiment`: `Positive` (tích cực), `Negative` (tiêu cực), `Neutral` (trung tính), `Mixed` (đan xen). Rao bán, hỏi thông thường = trung tính.
- `intent` (loại nội dung, người chơi đang làm gì): `question` Hỏi / cần hỗ trợ · `answer` Trả lời / hướng dẫn · `share` Chia sẻ / khoe thành quả · `event_entry` Tham gia sự kiện · `bug` Báo lỗi / bug · `performance` Crash / lag / hiệu năng · `account` Tài khoản / đăng nhập · `complaint` Phàn nàn · `suggestion` Góp ý / đề xuất · `praise` Khen / thích · `trade` Mua bán / trao đổi · `social` Tìm bạn / giao lưu · `chat` Trò chuyện chung.
- `keywords`: 1–4 từ khoá tiếng Việt, viết thường, ưu tiên bộ từ khoá chuẩn (câu cá, cá hiếm, trồng trọt, rau khổng lồ, nhân sâm, thú cưng, trang phục, bộ sưu tập thẻ, sự kiện, halloween, đảo kaia, cập nhật mới, code quà tặng, vvip pass, gacha, kim cương, nạp tiền, giá vật phẩm, chuyển tài khoản vng, đăng nhập, mất dữ liệu, văng game, lag, kẹt nhân vật, mua bán vật phẩm, cày thuê, đổi thời tiết, tìm bạn, quảng cáo…). Các cách viết khác nhau được gộp trong `scripts/apply-labels.mjs`.
- `summary_vn`: 1 câu ngắn mô tả người chơi nói/làm gì.
- `label_method=ai_review`, `needs_review=true`: nhãn do AI gán theo hướng dẫn cố định, cần rà soát. Cảm xúc trước khi rà lại giữ ở `sentiment_rule`.
- Trường cũ vẫn giữ: `theme`, `topic`, `activity_type` (nhãn theo luật từ khoá), `content_kind` (post/comment/review/video).

"Người chơi thích gì / chưa hài lòng" xếp hạng theo từ khoá và không tính `trade` (mua bán). "Cần xử lý" gồm cảnh báo P0/P1 trong dữ liệu và các nhóm `bug`, `performance`, `account`, `complaint`, kèm gợi ý từ `public/data/facebook-insights.json`.

## 4b. Quy tắc dịch Thái → Việt

Bản dịch phải đọc một lần là hiểu, đúng ngữ cảnh game. Không dịch từng chữ kiểu Google Translate. Hướng dẫn đầy đủ và bảng thuật ngữ: `docs/translation-guide.md` trong repository.

- Dịch theo ý, câu tự nhiên như người chơi Việt nói chuyện trong group game; giữ giọng điệu (than, đùa, hỏi gấp), không thêm thông tin.
- Dựa vào ngữ cảnh: nguồn (group mua bán thì đa số là rao bán), loại nội dung, câu tóm tắt để hiểu đúng câu ngắn, câu cụt.
- Bỏ từ đệm lịch sự (ครับ/ค่ะ/นะ/งับ) hoặc đổi thành "ạ/nhé/nha"; `555` = "haha".
- Giữ nguyên `[redacted]`, giá ghi "10 baht", số lượng, tên riêng tiếng Anh (Golden Chain, VVIP Pass, Halloween, Kaia). Danh sách rao bán giữ dạng liệt kê gọn.
- Không chắc nghĩa từ lóng: dịch theo cách hiểu hợp lý nhất trong game; thật sự không rõ thì thêm "(?)".
- Review store dịch đầy đủ (không tóm tắt).
- Thuật ngữ hay gặp: โสม = nhân sâm (น้ำค้าง sương, แสงจันทร์ ánh trăng, ออโรร่า cực quang); ติดสถานะ = có hiệu ứng đặc biệt; รับฟาร์ม / รับขุด = nhận cày thuê; คิวว่าง = còn nhận đơn; ทัก = nhắn tin; บริการกดสภาพอากาศ = dịch vụ đổi thời tiết; เงินฟาร์ม = tiền nông trại; ทอง = vàng; เพชร = kim cương; กาชา / สุ่ม = gacha / quay; ย้ายข้อมูล / ย้ายไอดี = chuyển dữ liệu / tài khoản sang VNG; บัค = lỗi; หลุด / เด้ง = văng game; แลค = lag; ค้าง = đơ (chỉ khi nói về game) — **ค้างคาว = con dơi**; เวล = level; ไอดี = tài khoản.
- Bản dịch theo ngữ cảnh có `translation_method=ai_contextual`; bản dịch máy cũ được giữ ở `text_vn_machine` để đối chiếu. Áp bản dịch mới bằng `node scripts/apply-translations.mjs <file.json>`.

## 5. Giao diện

- **Tổng quan** (chỉ số chính trên cùng, xu hướng ở giữa, chi tiết ở dưới): hàng 5 KPI (Tổng phản hồi, Tích cực %, Tiêu cực %, Cần xử lý = báo lỗi + crash/lag + tài khoản + phàn nàn, Điểm store VNG), mỗi thẻ có mức thay đổi và sparkline, bấm để đi tới chi tiết; 3 dòng nổi bật + tóm tắt đầy đủ thu gọn + nút Sao chép báo cáo; Diễn biến theo ngày (cảm xúc hoặc loại nội dung, ngày/tuần, số/%; bấm cột để mở danh sách ngày đó) và biểu đồ tròn tỷ lệ cảm xúc; Người chơi đang làm gì và Từ khoá được nhắc nhiều (thanh xếp hạng, màu là tỷ lệ cảm xúc); Người chơi thích gì / chưa hài lòng / Cần xử lý (dạng gọn, bấm để đọc); heatmap Từ khoá theo ngày (bấm ô để lọc đúng ngày + từ khoá). Chú thích chi tiết nằm trong biểu tượng ⓘ.
- **Theo nguồn**: hàng KPI (số nguồn có phản hồi, nguồn lớn nhất, tỷ lệ Facebook/YouTube/Store, nguồn tiêu cực cao nhất), biểu đồ tròn thị phần thảo luận, tỷ lệ cảm xúc theo nguồn, thẻ từng nguồn, danh sách nguồn chưa có dữ liệu (thu gọn), bảng theo nguồn và theo ngày.
- **Đánh giá store**: hàng KPI điểm app VNG (Google Play, App Store, lượt đánh giá mới), biểu đồ điểm theo tuần, bảng theo app, KPI review trong kỳ, phân bố sao, review khen / chê / lệch số sao.
- **Danh sách phản hồi**: dạng thẻ, mới nhất trước; mỗi thẻ có cảm xúc, loại nội dung, nguồn, câu tóm tắt, bản dịch, nguyên văn (bấm để mở), từ khoá (bấm để lọc), link; chip lọc nhanh theo cảm xúc; lọc theo ngày, nguồn, cảm xúc, loại nội dung, từ khoá, tìm chữ; tải CSV.
- Mọi chip/thẻ/bảng bấm được đều lọc sang Danh sách phản hồi. Link chia sẻ theo tab: `#overview`, `#sources`, `#store`, `#feedback`.

## 6. Cấu trúc file

- `public/index.html`: toàn bộ giao diện và logic (vanilla JS + Chart.js 4.4.1).
- `public/data/index.json`: danh sách ngày có dữ liệu. `public/data/daily/YYYY-MM-DD.json`: phản hồi, rating, cảnh báo, metrics của từng ngày.
- `public/data/sources.json`: danh sách nguồn, tên hiển thị, trạng thái. `public/data/themes.json`: từ điển theme cũ. `public/data/facebook-insights.json`: gợi ý xử lý.
- `scripts/import-facebook.mjs`: nhập staging Facebook (**thay toàn bộ mục Facebook bằng staging** → luôn gộp staging cũ + mới trước khi chạy; giữ bản dịch và nhãn cũ theo khoá link+nội dung+tác giả).
- `scripts/translate-facebook-vietnamese.mjs`: dịch mục Facebook còn thiếu tiếng Việt (bộ nhớ đệm `.staging/translations-vi.json`).
- `scripts/import-youtube.mjs`, `scripts/import-tiktok.mjs`: thêm/cập nhật mục `source=YouTube` / `source=TikTok` theo id, không đụng nguồn khác.
- `scripts/import-sensortower-ratings.mjs`, `import-sensortower-android.mjs`, `import-sensortower-ios.mjs`: rating và review store.
- `scripts/apply-labels.mjs`: áp nhãn intent/keywords/summary từ file JSON.
- `scripts/apply-translations.mjs`: áp bản dịch theo ngữ cảnh (giữ bản cũ ở `text_vn_machine`). `docs/translation-guide.md`: quy tắc dịch và thuật ngữ.
- `scripts/validate-data.mjs` + `test/*.mjs`: kiểm tra dữ liệu và giao diện. `.staging/` được git ignore.

## 7. Quy trình cập nhật

1. Thu thập (Facebook group qua trình duyệt đã đăng nhập; YouTube qua tìm kiếm vùng TH và RSS kênh; Sensor Tower export).
2. Làm sạch → staging JSON trong `.staging/` (tác giả đã che, không PII).
3. Import bằng script tương ứng; đối chiếu số mục trước/sau (không mất id, không đổi bản dịch cũ).
4. Dịch phần còn thiếu theo `docs/translation-guide.md` (không dùng bản dịch từng chữ); gán nhãn `intent`, `keywords`, `summary_vn`, rà `sentiment` cho mục mới rồi chạy `apply-labels.mjs`.
5. Cập nhật `sources.json` nếu phạm vi thu thập thay đổi.
6. `npm run check` (validator + test) phải pass; mọi mục phải có nhãn.
7. Commit và push `main`; GitHub Actions tự deploy.

## 8. Lưu ý cho AI tiếp tục dự án

- Đọc tài liệu này, README.md và `test/dashboard-default.test.mjs` trước khi sửa.
- Không tự suy đoán ngày đăng; không gộp app VNG với app Global; không tính bài đăng chính thức của fanpage/kênh là phản hồi người chơi.
- Khi thêm nguồn mới: thêm vào `sources.json` (test bắt buộc mọi nguồn trong dữ liệu có trong danh sách), ghi rõ quy tắc vào tài liệu này và README.
- Khi đổi giao diện: giữ tiếng Việt trực tiếp, kiểm tra desktop, mobile (375px), dark mode và không tràn ngang.
