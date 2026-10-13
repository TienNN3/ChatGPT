# PTG TH Player Sentiment

Dashboard web tĩnh để tổng hợp tiếng nói người chơi Play Together Thailand. Giao diện dùng vanilla JavaScript, Chart.js 4.4.1 và dữ liệu JSON trong `public/data`.

## Chạy cục bộ

```bash
npm ci
npm run check
npm run serve
```

Mở `http://127.0.0.1:4173`.

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
npm run check
```

Importer tạo ID ổn định, chuẩn hóa permalink, chống trùng theo permalink + nội dung + tác giả đã che + loại nội dung, gộp với review store theo ngày và cập nhật metrics/report/index. Mọi post/comment truy cập được đều được giữ lại, gồm bài khoe ảnh, rao bán và thảo luận chung; reaction và số comment được lưu trong `engagement`. Mục không có ngày đăng hiển thị được dùng ngày quan sát với `date_basis=observed_at`, không tự suy đoán ngày đăng.

## Public bằng GitHub Pages

URL preview công khai qua CDN bên thứ ba, không cần cấu hình hosting:

`https://raw.githack.com/TienNN3/PTGTHPlayerSentiment/main/public/index.html`

URL preview này tiện để xem ngay nhưng không có cam kết vận hành. Nên dùng GitHub Pages bên dưới làm URL chính thức.

Để dùng URL GitHub Pages ổn định, chủ repository cần bật một lần tại **Settings > Pages > Build and deployment > Source: GitHub Actions**. Sau đó, mỗi commit mới trên nhánh `main` sẽ chạy validation và test rồi publish thư mục `public`.

URL công khai: `https://tiennn3.github.io/PTGTHPlayerSentiment/`

Có thể chạy lại workflow thủ công từ tab Actions sau khi bật Pages. GitHub Pages không cần Firebase project hay credential riêng trong repository.
