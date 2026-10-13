# PTG TH Player Sentiment

Dashboard web tĩnh để tổng hợp tiếng nói người chơi Play Together Thailand. Giao diện dùng vanilla JavaScript, Chart.js 4.4.1 và dữ liệu JSON trong `public/data`.

## Chạy cục bộ

```bash
npm ci
npm run generate:mock
npm test
npm run validate
npm run serve
```

Mở `http://127.0.0.1:4173`. Dữ liệu đi kèm được gắn nhãn mock rõ ràng, chỉ dùng để kiểm thử giao diện.

## Cấu trúc dữ liệu

- `public/data/index.json`: danh sách ngày có dữ liệu.
- `public/data/themes.json`: từ điển theme dùng lại qua nhiều ngày.
- `public/data/daily/YYYY-MM-DD.json`: metrics, alert, báo cáo và item của từng ngày.
- `npm run validate`: kiểm tra JSON, trường bắt buộc, che tên tác giả, theme và quy tắc review confidence thấp.

Không ghi đè file ngày cũ trừ khi chủ động chạy lại đúng ngày đó. Không đưa service account, token, file `.p8` hoặc export chứa dữ liệu cá nhân vào Git.

## Dữ liệu thật

Phiên bản hiện tại là chế độ mock. Trước khi chạy production cần bổ sung collector đã được cấp quyền cho Google Play Developer API, App Store Connect, Meta Graph API và nguồn CS/export. Các collector phải chỉ đọc, tiếp tục khi một nguồn lỗi, ghi lỗi vào `data_health`, khử trùng lặp, lọc noise và loại bỏ PII trước khi ghi file public.

## Public bằng GitHub Pages

Xem ngay qua CDN HTML công khai, không cần cấu hình hosting:

`https://raw.githack.com/TienNN3/ChatGPT/main/public/index.html`

Để dùng URL GitHub Pages ổn định, chủ repository cần bật một lần tại **Settings > Pages > Build and deployment > Source: GitHub Actions**. Sau đó, mỗi commit mới trên nhánh `main` sẽ chạy validation và test rồi publish thư mục `public`.

URL công khai: `https://tiennn3.github.io/ChatGPT/`

Có thể chạy lại workflow thủ công từ tab Actions sau khi bật Pages. GitHub Pages không cần Firebase project hay credential riêng trong repository.
