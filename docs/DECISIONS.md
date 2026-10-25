# Quyết định và ranh giới bằng chứng V7

## Nguồn chuẩn và checkpoint

**V7 vẫn INCOMPLETE — 0 VERIFIED; premium/PDF parity chưa được nghiệm thu.** Chỉ [TEST_REPORT](<TEST_REPORT.md>) làm nguồn chuẩn cho checkpoint full đang thay đổi; các ma trận không tích lũy phụ lục “mới nhất” trái nhau. Mốc đồng bộ lead đã thu: `pwsh-1268` exit0, global TypeScript/full ESLint PASS, Vitest **3.908/3.908 PASS, 82 tệp, 270,12 giây**, Next.js16.4.1 production build PASS (compile2,1 giây/TypeScript10,4 giây). Tài liệu không tự chạy lại hoặc chứng minh deploy.

Full1230/build1223 là lịch sử trước năm dòng production mới: CharacterModel có ba dòng default rotation tường minh tránh retained props; ConstructionWorld có hai dòng optional map xóa bằng `null`. Hash đóng băng cũ không còn được mô tả là nguồn hiện tại. Sửa nguồn tiếp theo cần đối chiếu/rerun phần bị ảnh hưởng.

## Quy tắc ghi nhận

1. **Đếm composition, không đếm candidate/target.** Furniture120=36legacy+26living+25tech+13craft+20home. Fashion121=24free+97paid, accessory35paid đã nối catalog/shapes;110shape keys không geometry accepted. Equipment74=36weapons+30armor+8accessories, không cộng legacy override. Cửa8; model/motion và curve UI đã tích hợp nguồn, không source thay visual proof.
2. **Giữ lỗi cũ, tách bằng chứng sau sửa.** Fullfashion1238 FAIL mẫu11 buckle-combat-boots, chỉ10 mẫu hoàn tất.16 matrixWorld scalar khác trên bốn mesh là inherited rotation, không raster noise. Lỗi đã sửa;1263 actual Chrome split-runner→buckle boots2/2PASS/164.552,629ms, equip/reload/unequip với bốn mutation/Gold delta0, nguồn không đổi SHA-256 `0dc0717bf174975356a1ac329c858ad83f4b30e0127476e2c6fefd6bb6125973`. Đây là targeted proof, không đổi1238 thành PASS.
3. **Strict raster độc lập.**1085FAIL giữ nguyên. Observation1181 bounded2PASS/four equip-unequip/Gold không đổi/semantic reload khớp không strict pixel acceptance; split-flare vẫn lệch ba kênh/ba pixel delta1. Full121 mới theo `coverage-queue-r2.json` gồm bảy batch vừa được cấp phép cho audit-repo bắt đầu. Chưa có kết quả full mới ở đây; không RUNNING/DONE/121PASS suy từ queue. Trạng thái tiếp theo tra nguồn chuẩn.
4. **Retained wall proof có giới hạn.**1266 actual Chrome1/1PASS/8.722,652ms: cùng mesh/material/geometry UUID, chọn/Escape hai lần làm texture→null→texture. Không mutation nghiệp vụ, chỉ reconcile; Gold10000 không đổi và lỗi rỗng. Transparent-material painting và commit/reload chưa covered; không pixel baseline/premium. API fixture/in-memory, không live DB/process restart.
5. **Registry giữ0 VERIFIED.** Không promote từ catalog, worker report hoặc screenshot. Cần source hash,artifact hash,environment/testCase và runtime kết quả theo asset; hash tài liệu không tự nối artifact cũ với source mới. Live Neon/deploy/external AI/physical mobile chưa xác minh.
6. **Capture/review không là acceptance.** Powered union36+84 và supplement giới hạn đã có;120 review ban đầu đã lưu đủ sáu handoff18+18+26+25+13+20, legacy-A/home không pending recovery. Tất cả còn style gaps so với PDF. Terminal stipple thuộc ảnh cũ;1211 sau sửa một mẫu ChromePASS/13,343giây tổng, góc ảnh mới hết đốm, không mọi góc. Equipment1214/r5 Chrome2/2PASS/206.597,905ms/74capture sau crown fix là scene+pixel preview, không mọi rig fit/animation/occlusion; r4/1134 chỉ lịch sử.
7. **Browser hẹp không full product PASS.** Strict-locks8PASS,visual-preinteraction6PASS,mobile-jump1PASS,FPS4PASS,construction6PASS/43,054s,furniture-interactions5PASS/43,691s mỗi suite có scope riêng. UI/WebGL/applyAction thật nhưng API fixture/in-memory. Lamp chỉ capture, không light-state assertion. Tương tác extension đầy đủ còn mở.
8. **HUD không GPU timing/thiết bị thật.** Curve1207 actual Chrome6/6PASS/165.505,021ms, balanced/performance×1/6/12pane, sáu HUD samples58–60FPS mỗi ca trên GTX1050Ti hardwareANGLE/D3D11/WebGL2/canvas1440×932/DPR1. Sàn8×8,clear,reduced-motion,fixture; gl.info.autoReset=true có thể thiếu multipass. Không GPU time,memory bytes,physical mobile,ngưỡng60FPS acceptance hoặc benchmark phổ quát. Không kết luận mode nhanh hơn có ý nghĩa thống kê.
9. **Đọc reference không là parity.** Text+ảnh36PDFpages đã đọc A/B/C. CreatorPDF06/concept02, khôngPDF11; không nhầm concept/page hoặc diễn giải microtext không đọc được. Mouth/shoulders mặc định đã sửa; furniture/newfashion vẫn chưa premium accepted. PDF SHA-256 `DD904F65E3C25A89A2513CA9339B5D0C7AC7BE9ABC03458B339DF3B33C945D93`.

## Lịch sử giữ gọn

- 1215 full3.867/3.868PASS,một FAIL digest crown lịch sử.1228 test-only clone/khôi phục ba vị trí spire, giữ digest gốc74 recipe và assert hiện tại, scoped16PASS/lintPASS.1230 full3.868/3.868PASS/80tệp/250,60giây và1223 buildPASS compile5,3/TS9,3giây trước năm dòng production mới, không gate hiện tại.
- 958 full3.433/3.437PASS,bốn timeout5.000ms/377,57giây;982 partition giữ assertions/timeout,581PASS; tăng376 ca không thêm coverage.1076/1141 fullPASS sau đó chỉ revision lịch sử.1188/1189 fixtureFAIL, các mốc871/876/879 và scoped755/furniture173/doors83/polo32 giữ lịch sử trong nguồn chuẩn, không cộng vào currentPASS.
- Fashion strict gallery cũ FAIL mẫu5 với4/121 hoàn tất; first-five khác outer timeout375giây trước cleanup mẫu4 không chứng minh app bug.1048 test-only tối ưu đạt5mẫu/10mutation/77,775giây, không full121 hoặc thay1085FAIL.

## Nguồn và ranh giới tài liệu

Đã đọc [wearable handoff](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/wearable-transition-fix/handoff.md>): R3F bỏ qua undefined; explicit zero rotation reset retained mesh không remount. Nguồn cũ33FAIL/35, nguồn sửa và scoped suites57PASS, scoped lint/typePASS; handoff chưa có post-fix browser.1263 là bằng chứng riêng lead thu sau đó, không gán ngược cho handoff.

Đã đọc đầy đủ [wall readback](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/wall-material-transition/evidence/wall-material-transition-r1/readback-summary.json>): chuỗi retained UUID/map-null/restored và giới hạn transparent-paint/commit/reload như trên. [Character matrix](<CHARACTER_CUSTOMIZATION_MATRIX.md>) và [housing matrix](<HOUSING_REFERENCE_MATRIX.md>) giữ scope chuyên đề; [TEST_REPORT](<TEST_REPORT.md>) giữ checkpoint động và chi tiết lịch sử.

Snapshot catalog11:00 có furniture100/fashion86/shapes75,11:08 có120/121/110 sau home20/accessory35 import/spread; snapshot tuần tự không nguyên tử hoặc acceptance. SnapshotHash expanded manifest `80e441e0fae9c267ff47e1176e157908a4744b1b064e1d9523d771cb18642742` là trường dữ liệu, không hash bytes của manifest. PNG terminal mới SHA-256 `b6352226a8073a13664337718138ffad2ec94a58057cf6adf0bf548f971d2f8d` không nghiệm thu mọi góc.

Lượt tài liệu được yêu cầu chỉ sửa bốn tài liệu đã cấp phạm vi; không commands/test/build/install/browser/GPU/server hoặc source/tests, không ghi chú vận hành vào product code. Tài liệu không thay quyết định nghiệm thu sản phẩm.
