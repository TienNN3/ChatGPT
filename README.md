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

Importer hiện xử lý các review năm 2026, che tên tác giả, loại PII/noise, phân loại chủ đề và cập nhật index production. Không commit file CSV gốc vì có thể chứa dữ liệu cá nhân. Google Play, Facebook group, fanpage và nguồn CS cần collector hoặc export riêng; nguồn chưa có phải được ghi rõ trong `data_health`.

## Public bằng GitHub Pages

URL preview công khai qua CDN bên thứ ba, không cần cấu hình hosting:

`https://raw.githack.com/TienNN3/ChatGPT/main/public/index.html`

URL preview này tiện để xem ngay nhưng không có cam kết vận hành. Nên dùng GitHub Pages bên dưới làm URL chính thức.

Để dùng URL GitHub Pages ổn định, chủ repository cần bật một lần tại **Settings > Pages > Build and deployment > Source: GitHub Actions**. Sau đó, mỗi commit mới trên nhánh `main` sẽ chạy validation và test rồi publish thư mục `public`.

URL công khai: `https://tiennn3.github.io/ChatGPT/`

Có thể chạy lại workflow thủ công từ tab Actions sau khi bật Pages. GitHub Pages không cần Firebase project hay credential riêng trong repository.
