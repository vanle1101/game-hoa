# LIFE//LEVEL — bảng nghiệm thu chức năng (21/10/2026)

Phạm vi: bản online `https://life-level-theta.vercel.app/` và source local `E:\Game hoa cuoc song`. Đây là kiểm kê **không ghi/sửa save người chơi**. “Mở được” chỉ xác nhận màn hình hiện ra trong trình duyệt, không chứng minh mọi nút trong màn hình đã chạy đúng.

## Bằng chứng kiểm tra

- Online: `/`, `/showcase`, `/api/game`, `/api/finance`, `/api/ai`, `/api/backup` đều trả HTTP 200. Trong lượt điều hướng tuần tự, 25/26 mục mở được, không có uncaught page error hay HTTP >=400. Mục **Xây dựng** mở được khi thử riêng; sau khi lần lượt mở hai scene WebGL, thao tác bấm Xây dựng hết thời gian chờ 10 giây.
- Source local: `npm run typecheck` đạt. `npm test -- --reporter=dot`: **4.534 đạt, 14 lỗi, 114 file**. Lỗi nằm ở bề mặt môi nhân vật (`avatar-surface`), giá trị ánh sáng (`lamp-illumination`, `v12-architecture`) và độ phủ skyline (`v16-building-envelope`). Không gọi toàn bộ source là đạt kiểm thử.
- AI online: `/api/ai` hoạt động nhưng `providerConfigured=false`, `demo=false`; tạo đề xuất AI hiện **không sử dụng được**.
- Bản online và local khác nhau: các sửa nhân vật, thảm, thành phố cuối 20/10 mới nằm trong source local, chưa triển khai lên Vercel. Ảnh local gần nhất `evidence/v21.1/reference-home-local-integrated-restart-20261020.png` còn thiếu nội thất 3D tại thời điểm chụp; cần điều tra tải GLB/đợi frame trước khi nghiệm thu.

## Các màn hình

| Mục | Có gì | Trạng thái hiện tại | Bạn nên thử |
|---|---|---|---|
| Sảnh chờ | Tổng quan tiến độ, lối tắt, một sidebar chung | Mở được online; lối tắt thay đổi dữ liệu chưa E2E | Vào Sảnh chờ, thử từng lối tắt và quay lại |
| Cuộc sống | Home 3D, nhân vật, camera, HUD, hành động ngữ cảnh | Mở được online; **đồ họa/chất lượng WebGL đang hoàn thiện** | Xoay camera, WASD, nhảy, ngồi/nằm; quan sát lỗi tải GLB |
| Căn hộ | Cảnh căn hộ của người chơi | Mở được online; bản hiển thị tham chiếu không đồng nghĩa đã sở hữu nội thất | So với danh sách sở hữu và vị trí đồ đã lưu |
| Xây dựng | Editor nhà, tường, sàn, vật liệu, mua/bố trí | Mở được khi thử riêng; chuyển từ WebGL sang editor đôi lúc timeout | Vào trực tiếp từ Sảnh chờ, thử bản nháp trước khi bấm lưu |
| Nội thất | Catalog, mua và chuyển sang đặt đồ | Mở được; mua/đặt/lưu chưa thử trên tài khoản thật | Kiểm tra giá, Gold, đặt một món đang sở hữu |
| Bạn đồng hành | Chọn, nhận nuôi, chăm sóc, phụ kiện | Mở được; thao tác server có trong code, chưa E2E online | Thử chọn/chăm sóc nếu đã sở hữu |
| Nhiệm vụ | Tạo/sửa, checklist, hoàn thành, XP/Gold | Mở được; engine và API có luồng xử lý, chưa mutation E2E online | Tạo nhiệm vụ thử, hoàn thành và tải lại trang |
| Lịch trình | Xem nhiệm vụ theo ngày | Mở được; chưa đối chiếu múi giờ/dữ liệu thực | Tạo nhiệm vụ có hạn và xem đúng ngày |
| Chiến dịch | Tạo chuỗi nhiệm vụ/mốc | Mở được; chưa E2E online | Tạo chiến dịch thử rồi kiểm tra Nhiệm vụ |
| Đấu trường | Trận đấu và thao tác chiến đấu | Mở được; trận thực tế chưa E2E online | Vào trận đang đủ điều kiện, kiểm tra HP và lưu |
| Thử thách trùm | Danh sách boss và điều kiện cấp | Mở được; boss cấp cao bị khóa đúng chủ ý | Chọn boss cấp phù hợp rồi vào Đấu trường |
| Chiến lợi phẩm | Phần thưởng và loot | Mở được; chưa xác nhận luồng nhận vật phẩm online | Đối chiếu phần thưởng sau trận hợp lệ |
| Nhân vật | Tạo hình, trang phục, nghỉ ngơi | Mở được; model 3D đang hoàn thiện, chưa giống ảnh ref | Đổi diện mạo, tải lại, xem Home và mặt nhân vật |
| Trang bị | 8 ô trang bị, chỉ số chiến đấu | Mở được; chưa E2E thao tác lắp/tháo | Trang bị món sở hữu, xem chỉ số và model |
| Túi đồ | Vật phẩm, chọn trang bị, consumable | Mở được; chưa E2E online | Đối chiếu vật phẩm trước/sau mua hoặc loot |
| Cây kỹ năng | Nút kỹ năng và điều kiện mở | Mở được; chưa E2E online | Mở nút đủ XP, tải lại để kiểm tra lưu |
| Sự nghiệp | Chọn nghề, thăng hạng | Mở được; chưa E2E online | Chọn nghề, kiểm tra title và điều kiện thăng hạng |
| Cửa hàng trang bị | Mua vật phẩm và consumable | Mở được; chưa E2E online | Mua món rẻ bằng hồ sơ thử, kiểm tra Gold/túi đồ |
| Chế tạo | Công thức, nguyên liệu, tạo vật phẩm | Mở được; chưa E2E online | Thử công thức đủ nguyên liệu, kiểm tra tồn kho |
| Tích lũy | Nhiệm vụ tích lũy, kho nguyên liệu | Mở được; chưa E2E online | Hoàn thành nhiệm vụ tích lũy và đối chiếu nguyên liệu |
| Thành tựu | Danh sách và mốc đã đạt | Mở được; chưa E2E trigger online | Hoàn thành mốc nhỏ và xem trạng thái |
| Tài chính | Tài khoản, giao dịch, ngân sách, mục tiêu, hóa đơn, CSV | UI và API GET hoạt động online; ghi dữ liệu chưa E2E | Tạo tài khoản thử, ghi giao dịch, tải lại và xuất JSON |
| Phần thưởng | Phần thưởng cá nhân bằng Gold trong game | Mở được; chưa E2E online | Tạo phần thưởng thử, đổi và kiểm tra Gold |
| NOVA AI | Đề xuất kế hoạch, duyệt trước khi tạo nhiệm vụ | UI/API GET hoạt động; **tạo đề xuất không hoạt động vì chưa cấu hình AI** | Mở trang để xem thông báo cấu hình; chưa test nút tạo |
| Nhật ký | Lịch sử thao tác, lọc, hoàn tác gần nhất | Mở được; hoàn tác chưa E2E online | Hoàn thành hành động thử, lọc và thử hoàn tác nếu còn quyền |
| Cài đặt | Đồ họa, chuyển động, lựa chọn hệ thống | Mở được; thay đổi/cố định thiết lập chưa E2E online | Đổi một thiết lập, tải lại và kiểm tra |

## Hạ tầng và các luồng ngoài sidebar

| Hạng mục | Trạng thái | Cách kiểm tra / giới hạn |
|---|---|---|
| Save game online | API GET 200; POST có kiểm tra origin, owner và idempotency trong code; chưa thử ghi mới trên Vercel trong lượt kiểm kê này | Tạo một nhiệm vụ thử, tải lại cùng trình duyệt |
| Cùng hồ sơ trên thiết bị khác | **Chưa hoạt động** | Identity dùng cookie khách riêng mỗi trình duyệt, chưa có đăng nhập/liên kết tài khoản |
| Showcase `/showcase` | HTTP 200, fixture độc lập; trước đây đã có bằng chứng Home/Showcase dùng chung renderer/asset | Không dùng Showcase để đánh giá dữ liệu sở hữu thật |
| Sao lưu | `/api/backup` GET 200; có xuất JSON | Chưa tìm thấy API nhập/khôi phục bản sao lưu |
| Sidebar | Ba trạng thái expanded/compact/hidden có trong code | Mở/thu/ẩn rồi tải lại, kiểm tra trạng thái nhớ trong trình duyệt |
| Camera Home | Free/follow, trước/sau/trái/phải/cận mặt có trong code và từng chụp được | Chưa nghiệm thu mượt/va chạm trên GPU của người dùng |
| FPS/WebGL | Online Home mở được; ảnh QA trước đó cho thấy WebGL không mất context | SwiftShader của môi trường QA từng ~1 FPS; tương tác thực tế trên thiết bị khác chưa được xác nhận |
| Đồng bộ hình ảnh 1:1 | **Chưa đạt** | Căn hộ, thành phố, vật liệu và nhân vật khác reference; source local chưa triển khai |

## Ưu tiên để người dùng test

1. Sảnh chờ → Nhiệm vụ: tạo nhiệm vụ nhỏ, hoàn thành, tải lại và kiểm tra Gold/XP/nhật ký.
2. Cuộc sống: xoay camera 360°, trước/sau/cận mặt, WASD/nhảy/ngồi/nằm; ghi lại nếu kẹt “Đang khởi tạo WebGL”, FPS thấp hoặc mất nội thất.
3. Căn hộ → Xây dựng: thử vào editor từ Sảnh chờ, chỉnh bản nháp; chỉ xác nhận lưu khi giá và thay đổi đúng ý.
4. Tài chính: tạo tài khoản thử, giao dịch thử, tải lại; tài chính VND độc lập với Gold.
5. Cùng link trên máy khác: hiện sẽ là hồ sơ khách khác. Đây là giới hạn xác thực/đồng bộ đã biết.

Không dùng kết quả mở màn hình hoặc số bài unit test đạt để kết luận các giao dịch ghi dữ liệu, combat hay chất lượng 3D đã được nghiệm thu hoàn chỉnh.
