# VocabDaily

Công cụ luyện tập từ vựng tiếng Anh hằng ngày kết hợp **Discord Bot** và **Giao diện Web** (hỗ trợ deploy miễn phí trên Vercel). Hệ thống dùng Google Gemini API để phân tích họ từ, chấm lỗi ngữ pháp khi viết câu và sinh bài tập ôn tập theo thuật toán Spaced Repetition (SM-2).

## Tính năng chính

1. **Thêm từ mới và mở rộng Họ từ (Word Family):** Nhập một từ hoặc cụm từ mới bắt gặp trong ngày, hệ thống tự động phân tích phiên âm IPA, nghĩa tiếng Việt, danh từ, động từ, tính từ, trạng từ liên quan, từ đồng nghĩa, trái nghĩa và 4 collocations phổ biến.
2. **Luyện viết câu và sửa lỗi ngữ pháp:** Đặt câu với từ mục tiêu (hoặc gõ thẳng câu tiếng Anh vào Discord), AI chấm điểm trên thang 100, chỉ ra lỗi cấu trúc, kiểm tra cách chia dạng từ và đề xuất 3 phiên bản diễn đạt nâng cấp (tự nhiên, học thuật, giàu collocation).
3. **Đa dạng bài tập ôn tập (SM-2):** Gồm 4 dạng bài tập trộn lẫn hoặc luyện riêng: Biến đổi họ từ (Word Form), Tìm lỗi sai ngữ pháp/collocation (Error Spotter), Trắc nghiệm ngữ cảnh (Multiple Choice), và Viết lại câu (Active Recall).
4. **Cơ chế nhắc nhở giữ thói quen mỗi ngày:** Discord Bot tự động gửi thẻ thử thách 3 phút vào buổi sáng (08:00) và nhắc giữ chuỗi Streak vào buổi tối (21:00) nếu bạn chưa luyện tập trong ngày.
5. **Lưu trữ gọn nhẹ, không cần database ngoài:** Web UI lưu trực tiếp vào LocalStorage kèm xuất/nhập file `.json`. Discord Bot lưu vào `data/vocab.json`.

## Cài đặt và Chạy Local (Discord Bot + Web UI)

### 1. Cài đặt thư viện
```bash
cd vocab-daily
npm install
```

### 2. Tạo file cấu hình `.env`
Sao chép `.env.example` thành `.env` và điền các khóa cần thiết:
- `GEMINI_API_KEY`: Lấy miễn phí tại Google AI Studio (`https://aistudio.google.com/apikey`).
- `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CHANNEL_ID`: Lấy từ Discord Developer Portal khi muốn bật Discord Bot.
  - Lưu ý trong mục **Bot** trên Discord Developer Portal, cần bật **Message Content Intent** để Bot đọc được tin nhắn nhanh `+ <từ>` và câu luyện viết của bạn.

### 3. Khởi chạy
- Chạy cả Web UI (`http://localhost:3000`) và Discord Bot:
  ```bash
  npm start
  ```
- Hoặc chỉ chạy Discord Bot thuần túy:
  ```bash
  npm run bot
  ```
- Chạy kiểm thử tự động:
  ```bash
  npm test
  ```

## Cách dùng nhanh trong khung chat Discord

- `+ resilient` hoặc `+ resilient | Teams stay resilient under pressure.`: Thêm từ mới và xem ngay sơ đồ họ từ kèm nút bấm viết câu, làm quiz.
- Gõ trực tiếp một câu tiếng Anh có chứa từ trong kho: Bot tự động nhận diện từ mục tiêu, chấm điểm và sửa lỗi ngữ pháp.
- `/add`, `/write`, `/quiz`, `/family`, `/stats`, `/export` (hoặc `!add`, `!write`, `!quiz`, `!family`, `!stats`, `!export`): Các lệnh tương tác và sao lưu dữ liệu.

## Deploy lên Vercel (Web UI + Discord Webhook)

1. Đưa thư mục `vocab-daily` lên GitHub hoặc chạy `npx vercel` ngay trong thư mục dự án.
2. Trong phần **Environment Variables** của Vercel Project, thêm `GEMINI_API_KEY` (và `DISCORD_WEBHOOK_URL` nếu muốn gửi thẻ nhắc học sang kênh Discord từ Web UI).
3. Truy cập đường dẫn Vercel trên điện thoại hoặc máy tính. Mọi dữ liệu học tập được lưu tại trình duyệt và có thể xuất ra file `.json` bất cứ lúc nào ở tab **Kết nối Discord & Sao lưu**.
