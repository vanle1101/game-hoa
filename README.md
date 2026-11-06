# LIFE//LEVEL

Trò chơi quản lý cuộc sống với nhiệm vụ, nhân vật, căn hộ 3D, xây dựng nhà và tài chính cá nhân. Chức năng hiện được triển khai một phần; xem [ma trận tính năng](docs/FEATURE_MATRIX.md) và [báo cáo kiểm thử](docs/TEST_REPORT.md) để biết phạm vi đã xác minh.

## Chạy trên máy

1. Cài Node.js theo `.nvmrc` (22.23.4), dùng npm 10.9.9 và chạy `npm ci`.
2. Sao chép `.env.example` thành `.env.local`, đặt `LOCAL_DEV_MODE=true`.
3. Chạy `npm run dev` rồi mở địa chỉ localhost được terminal thông báo.

Chế độ local dùng người chơi `local-player`, lưu vào thư mục `.local-data/` được Git bỏ qua. Không dùng thư mục này làm nơi lưu dữ liệu production.

## Không cần đăng nhập Google

Ứng dụng mở trực tiếp, không yêu cầu tài khoản Google hay cấu hình OAuth. Ngoài chế độ local, mỗi trình duyệt được cấp cookie phiên khách HttpOnly; dữ liệu được lưu theo phiên đó. Trình duyệt hoặc thiết bị khác có dữ liệu riêng. Xóa cookie hoặc dùng cửa sổ riêng tư sẽ tạo phiên mới; hiện chưa có khôi phục tài khoản hay đồng bộ nhiều thiết bị. Cookie production yêu cầu HTTPS và có thời hạn một năm.

Production cần Postgres qua `DATABASE_URL`. Xem [hướng dẫn triển khai](docs/DEPLOYMENT.md) cho migration, biến môi trường và các bước kiểm chứng còn lại. Repository chưa được triển khai lên production; chưa xác minh Neon hoặc AI từ xa. AI mặc định tắt, và không đọc dữ liệu tài chính.

## Kiểm tra

```text
npm run typecheck
npm run lint
npm test
npm run build
node --test desktop/*.test.cjs
npm run test:e2e:smoke
```

`npm` là package manager duy nhất cho ứng dụng và desktop shell; dependency được ghim trong hai `package-lock.json`. Bộ Playwright mặc định chạy toàn bộ `tests/e2e/**/*.spec.ts`; `npm run test:e2e:smoke` là luồng ngắn riêng. Playwright tự chạy Next.js trên loopback, dùng thư mục save tạm riêng, không kế thừa `DATABASE_URL` hay AI credentials. Những kiểm tra này không thay thế nghiệm thu PostgreSQL thật.

Không đưa `.env.local`, cookie phiên hay thông tin kết nối cơ sở dữ liệu vào Git hoặc log chia sẻ. [Các vấn đề đã biết](docs/KNOWN_ISSUES.md) phân biệt chức năng còn thiếu với kết quả đã kiểm thử.
