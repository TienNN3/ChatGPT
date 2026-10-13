# PTG TH Player Sentiment

Dashboard web tĩnh để tổng hợp tiếng nói người chơi Play Together Thailand. Giao diện dùng vanilla JavaScript, Chart.js 4.4.1 và dữ liệu JSON trong `public/data`.

## Chạy cục bộ

```bash
npm ci
npm run check
npm run serve
```

Mở `http://127.0.0.1:4173`.

## Dashboard đọc như thế nào

Mặc định mở 7 ngày gần nhất. Mọi số liệu được tính lại theo kỳ đang chọn và so với kỳ liền trước có cùng số ngày. Mỗi tab có link riêng qua hash (`#overview`, `#sources`, `#store`, `#feedback`).

- **Tổng quan:** tóm tắt nhanh tự sinh, KPI, *Người chơi thích gì / chưa hài lòng / Cần xử lý* kèm trích dẫn tiêu biểu, biểu đồ cảm xúc (Ngày/Tuần, Số lượng/%), hoạt động cộng đồng, chip chủ đề. Nút **Sao chép báo cáo** chép bản tóm tắt dạng chữ để dán vào chat.
- **Theo nguồn:** thẻ từng group/fanpage/store (số lượng, thay đổi, sparkline 30 ngày), tỷ lệ cảm xúc theo nguồn, bảng chi tiết theo ngày.
- **Đánh giá store:** review trong kỳ, số sao trung bình, tỷ lệ 4–5★ và 1–2★, phân bố sao, review khen/chê, review có số sao lệch với nội dung, điểm tích lũy 90 ngày.
- **Danh sách phản hồi:** mới nhất trước, bản dịch trước nguyên văn, lọc theo nguồn/cảm xúc/hoạt động/chủ đề, tải CSV.

Quy tắc hiển thị:
- Nội dung `date_basis=observed_at` (chưa rõ ngày đăng) không được cộng vào thống kê; chỉ xem được trong danh sách khi bật tùy chọn.
- Bài *Rao bán / trao đổi* vẫn được đếm đầy đủ nhưng không dùng để xếp hạng chủ đề thích / chưa hài lòng.
- Khi kỳ trước có dưới 10 phản hồi, so sánh bằng số tuyệt đối thay vì phần trăm.
- Danh sách nguồn theo dõi, tên hiển thị và trạng thái thu thập (`full`, `partial`, `pending`, `not_collected`, `store`) nằm trong `public/data/sources.json`. Tab Theo nguồn luôn hiện đủ các nguồn này, kể cả nguồn chưa có dữ liệu, để phân biệt "0 phản hồi" với "chưa thu thập". Khi thu thập thêm group, cập nhật trạng thái ở file này. Tên chủ đề trung tính lấy từ `THEME_NAMES` trong `public/index.html`. Dữ liệu gốc không đổi; nguồn chưa có trong danh sách sẽ hiện ID.
- Cột tiếng Việt của review store hiện là tóm tắt phân loại, không phải bản dịch; giao diện hiển thị nguyên văn kèm nhãn "Tóm tắt".

## Cấu trúc dữ liệu

- `public/data/index.json`: danh sách ngày có dữ liệu.
- `public/data/themes.json`: từ điển theme dùng lại qua nhiều ngày.
- `public/data/daily/YYYY-MM-DD.json`: metrics, alert, báo cáo và item của từng ngày.
- `npm run validate`: kiểm tra JSON, trường bắt buộc, che tên tác giả, theme và quy tắc review confidence thấp.

Không ghi đè file ngày cũ trừ khi chủ động chạy lại đúng ngày đó. Không đưa service account, token, file `.p8` hoặc export chứa dữ liệu cá nhân vào Git.

## Nhập dữ liệu Sensor Tower

File export iOS Thailand dạng UTF-16/TSV có thể nhập bằng:

```bash
node scripts/import-sensortower-ios.mjs "/path/to/Review iOS TH.csv"
npm run check
```

Importer hiện xử lý các review năm 2026, che tên tác giả, loại PII/noise, phân loại chủ đề và cập nhật index production. Không commit file CSV gốc vì có thể chứa dữ liệu cá nhân. Facebook group/fanpage dùng importer riêng bên dưới; Google Play và nguồn CS chưa có collector phải được ghi rõ trong `data_health`.

File export Android Thailand năm 2026 có thể nhập bằng:

```bash
node scripts/import-sensortower-android.mjs "/path/to/Android TH 2026.csv"
npm run check
```

Importer Android gộp dữ liệu với iOS theo ngày. Cột tiếng Việt là tóm tắt phân loại có đánh dấu `needs_review`, không được xem là bản dịch nguyên văn.

## Nhập feedback Facebook

Chỉ nhập staging đã làm sạch, đã che tên và không còn PII. Thư mục `.staging/` được ignore và không được dùng để lưu cookie, token, browser profile hoặc export thô:

```bash
node scripts/import-facebook.mjs .staging/facebook-observations.json
node scripts/translate-facebook-vietnamese.mjs
npm run check
```

Importer tạo ID ổn định, chuẩn hóa permalink, chống trùng theo permalink + nội dung + tác giả đã che + loại nội dung, định danh từng group/fanpage trong `community`, gộp với review store theo ngày và cập nhật metrics/report/index. Mọi post/comment truy cập được đều được giữ lại, gồm bài khoe ảnh, rao bán và thảo luận chung; reaction và số comment được lưu trong `engagement`. Mục không có ngày đăng hiển thị được dùng ngày quan sát với `date_basis=observed_at`, không tự suy đoán ngày đăng.

Phạm vi fanpage được giới hạn ở **comment** trên `facebook.com/playtogetherthailandofficial`. Bài đăng fanpage và nội dung từ `PlayTogetherGame` global bị loại; group vẫn giữ cả post và comment.

Script dịch thay các câu trạng thái `cần dịch` bằng tiếng Việt để Feedback Explorer luôn ưu tiên nội dung người vận hành đọc được. Bản dịch máy được đánh dấu bằng `translation_method=machine_translation`; bài chỉ có hình được ghi rõ là không có chữ để dịch.

## Nhập rating Sensor Tower

```bash
node scripts/import-sensortower-ratings.mjs "/path/to/Rating TH Android.csv" "/path/to/Rating TH iOS.csv"
```

Rating được lưu thành snapshot riêng trong `ratings`, gồm cả app Global và VNG. Dashboard tính rating theo trọng số `Total Rating Count`; rating không làm tăng feedback volume và không tham gia phân loại cảm xúc.

Các biểu đồ theo ngày chỉ dùng mục có ngày đăng xác định. Mục Facebook chỉ biết ngày quan sát vẫn được giữ đầy đủ trong tổng lưu trữ và bảng khám phá, nhưng không được dùng để tạo spike volume theo ngày. Dashboard trình bày trực tiếp số feedback tích cực, tiêu cực và bình thường thay vì dùng chỉ số tổng hợp.

## Public bằng GitHub Pages

URL preview công khai qua CDN bên thứ ba, không cần cấu hình hosting:

`https://raw.githack.com/TienNN3/PTGTHPlayerSentiment/main/public/index.html`

URL preview này tiện để xem ngay nhưng không có cam kết vận hành. Nên dùng GitHub Pages bên dưới làm URL chính thức.

Để dùng URL GitHub Pages ổn định, chủ repository cần bật một lần tại **Settings > Pages > Build and deployment > Source: GitHub Actions**. Sau đó, mỗi commit mới trên nhánh `main` sẽ chạy validation và test rồi publish thư mục `public`.

URL công khai: `https://tiennn3.github.io/PTGTHPlayerSentiment/`

Có thể chạy lại workflow thủ công từ tab Actions sau khi bật Pages. GitHub Pages không cần Firebase project hay credential riêng trong repository.
