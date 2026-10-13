# Hướng dẫn dịch phản hồi người chơi Play Together (Thái → Việt)

Người đọc là đội vận hành game người Việt. Mục tiêu: đọc một lần là hiểu người chơi Thái muốn nói gì, đúng ngữ cảnh game. KHÔNG dịch word-by-word kiểu Google Translate.

## Nguyên tắc
1. Dịch theo ý, câu tiếng Việt tự nhiên như người chơi Việt nói chuyện trong group game. Giữ giọng điệu (than phiền, đùa, hỏi gấp…) nhưng không thêm thông tin.
2. Dùng ngữ cảnh: `where` (group nào/kênh nào — group mua bán thì đa số là rao bán), `kind` (post/comment/review/video), `intent`, `summary` để hiểu đúng câu ngắn, câu cụt.
3. Bỏ từ đệm lịch sự không cần thiết (ครับ/ค่ะ/คะ/นะ/จ้า/งับ) hoặc chuyển thành "ạ/nhé/nha" khi hợp lý. `555…` = "haha".
4. Giữ nguyên `[redacted]`, giá tiền ghi "10 baht", số lượng, tên riêng tiếng Anh (Golden Chain, VVIP Pass, Halloween, Kaia…). Danh sách rao bán giữ dạng liệt kê ngắn gọn.
5. Từ lóng/viết tắt không chắc: dịch theo cách hiểu hợp lý nhất trong game; nếu thực sự không rõ thì dịch sát và thêm "(?)" ở cuối.
6. Tiếng Anh / lẫn Anh-Thái: vẫn dịch sang tiếng Việt. Chỉ có emoji/ký tự: ghi "(chỉ có biểu tượng cảm xúc)".
7. Review store: dịch đầy đủ nội dung review (không tóm tắt).

## Thuật ngữ Play Together
- โสม = nhân sâm; โสมน้ำค้าง = nhân sâm sương; โสมแสงจันทร์ = nhân sâm ánh trăng; โสมออโรร่า = nhân sâm cực quang; โสมทราย/แห้งแล้ง/ลม/ไฟ = nhân sâm cát/khô hạn/gió/lửa
- ติดสถานะ (nói về nông sản) = có hiệu ứng đặc biệt (sương, ánh trăng…); ผลไม้ = trái cây; แตงโม = dưa hấu; มะพร้าว = dừa; เกาลัด = hạt dẻ; น้อยหน่า = mãng cầu; มะเดื่อ = sung (vả)
- เมล็ด = hạt giống; ผักยักษ์ = rau khổng lồ; ฟาร์ม = nông trại; เงินฟาร์ม / เหรียญฟาร์ม = tiền nông trại / xu nông trại; ทอง = vàng (tiền vàng trong game); เพชร = kim cương; เติมเงิน = nạp tiền
- รับฟาร์ม / รับขุด / รับจ้าง… = nhận cày thuê (nông trại / đào…); คิวว่าง = còn nhận đơn (còn slot); เหมาเวล = cày trọn gói lên level; เวล = level; ทัก / ทักมา = nhắn tin / inbox; ส่งของขวัญ / กิฟ = tặng quà; บริการกดสภาพอากาศ = dịch vụ đổi thời tiết
- ตกปลา = câu cá; ปลาหายาก = cá hiếm; เบ็ด = cần câu; เหยื่อ = mồi; จับแมลง = bắt côn trùng; ขุดสมบัติ / กล่องสมบัติ = đào kho báu / rương kho báu; ทุบแร่ = đập quặng
- กาชา / สุ่ม / กล่องสุ่ม = gacha / quay / hộp quay; การ์ด = thẻ; สะสมการ์ด / คอลเลคชั่น = sưu tầm thẻ / bộ sưu tập; ดาว (của thẻ) = sao
- ชุด = bộ đồ / trang phục; คอสตูม = trang phục hoá trang; เฟอร์นิเจอร์ / เฟอ = nội thất; แต่งบ้าน = trang trí nhà; พาหนะ / รถ = phương tiện / xe; สัตว์เลี้ยง = thú cưng
- กิจกรรม / อีเว้นท์ = sự kiện; มินิเกม = minigame; เควส = nhiệm vụ; โค้ด = code quà tặng; แจก = phát quà / tặng
- ย้ายข้อมูล / ย้ายตัว / ย้ายไอดี = chuyển dữ liệu / chuyển tài khoản (sang VNG); เซิร์ฟ / เชิฟ VNG = máy chủ VNG; ไอดี = tài khoản (ID); ขายไอดี = bán tài khoản; ล็อกอิน / เข้าเกมไม่ได้ = đăng nhập / không vào được game
- บัค = lỗi (bug); หลุด / เด้ง = văng game; แลค = lag; ค้าง = đơ/treo (CHỈ khi nói về game) — ค้างคาว = CON DƠI
- เจ้ / พี่ / น้อง = chị / anh(chị) / em; แอด = admin

## Định dạng đầu ra
JSON object `{ "<id>": "<bản dịch tiếng Việt>", ... }` gồm TẤT CẢ id trong file đầu vào.
