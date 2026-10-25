# Ma trận nhà ở, nội thất và construction V7

**V7 INCOMPLETE — 0 VERIFIED; premium/PDF parity chưa được nghiệm thu.** [TEST_REPORT](<TEST_REPORT.md>) là nguồn chuẩn cho checkpoint full và trạng thái đang thay đổi. Mốc đồng bộ lead đã thu: `pwsh-1268` exit0, global TypeScript/full ESLint PASS, Vitest **3.908/3.908 PASS, 82 tệp, 270,12 giây**, Next.js16.4.1 build PASS (compile2,1 giây/TypeScript10,4 giây). Không phải lượt tài liệu tự chạy lại; chưa deploy.

Sau full1230/build1223 đã đổi năm dòng production: CharacterModel reset rotation mặc định tường minh (ba dòng), ConstructionWorld xóa optional map bằng `null` (hai dòng). Checkpoint và hash đóng băng cũ chỉ còn là lịch sử, không nguồn hiện tại.

## Composition và gate

| Phạm vi | Composition | Giới hạn |
| --- | --- | --- |
| Nội thất | 120 = 36 legacy + 26 living + 25 tech + 13 craft + 20 home | Chưa120 accepted |
| Extension | 84/84 tích hợp nguồn, gồm home20 | Không suy visual acceptance từ số lượng |
| Cửa | 8 catalog entries / 8 model IDs; DoorLeafModel và motion trượt/bản lề đã tích hợp | Browser bounded không mọi tình huống |
| Curve UI | Radius, angle, height, thickness, material, frame, X/Z, xoay | Chưa mọi biến thể/control đạt visual acceptance |
| Registry | 0 VERIFIED | Chưa promote hash-bound runtime acceptance |

## Tường giữ lại — map-null sau sửa

`pwsh-1266` actual Chrome **1/1 PASS, 8.722,652 ms**. Đọc [readback-summary](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/wall-material-transition/evidence/wall-material-transition-r1/readback-summary.json>) xác nhận cùng mesh/material/geometry UUID xuyên suốt: chọn tường có texture làm map thành `null`, Escape khôi phục texture; lặp hai lần. Observer không sửa scene/mesh/material/camera. Không mutation nghiệp vụ (chỉ reconcile); finalGold10000, errors/consoleErrors/unexpectedApi rỗng, skipped/unexpected/flaky0.

Phạm vi là một tường có texture trong Chrome/WebGL thật tại ứng dụng development hiện có. API intercept dùng domain applyAction thật và state tuần tự hóa in-memory, không live DB/process restart. **Transparent-material painting và commit/reload chưa được kiểm tra trong ca này**; không pixel baseline hoặc premium acceptance. Không biến sửa `null` thành tuyên bố toàn bộ vật liệu đã nghiệm thu.

## Kính cong và cửa — bằng chứng giới hạn

Curve limits: radius0,5–4m, angle15–180° bước15°, height0,5–2,8m, thickness0,06–0,3m; material clear/blue/violet/frosted/smoke, frame aluminium/graphite/brass. Đây là contract nguồn, không toàn bộ UI đã thao tác.

- Construction-controls-r2: desktop6PASS/43,054 giây; real UI radius/angle/height/repricing, commit/reload/cancel, bounds/arc, hostile profiles và residence/floor. API mock/in-memory, không rendered geometry/premium proof hoặc toàn bộ thickness/material/frame UI.
- Door1021:8/8PASS/99.997,194ms; placement/quote/debit/reload và click Live kiểm transform mở/đóng. PNG/geometry là artifact review, không baseline premium hoặc mọi pathfinding.
- Curve1026:6/6PASS/109.121,469ms cho optical contract năm finish normal/selected/ghost/reload; trước sửa geometry. Sau sửa,1131 global type+74/74CPU/4tệp,196profiles PASS;1133 actual Chrome6/6PASS/67,489 giây optical props/selected/ghost/reload, không toàn ma trận.

Các lượt trên dùng UI/WebGL thật nhưng API fixture/in-memory; không live DB/process restart và không tự nâng VERIFIED. Artifact chính: [construction r2](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/construction-browser/evidence/construction-controls-r2/results.json>), [door results](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/door-gallery-v7/evidence/results.json>), [curve r1](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/curve-material-v7/evidence/curve-material-v7-r1/results.json>).

## Powered furniture, tương tác và terminal

Powered capture union đủ120 = legacy36 (`pwsh-1177`) + expanded84 (`pwsh-1180`), cộng supplement giới hạn không tính thành asset mới. Review ban đầu120 đã lưu qua sáu handoff18+18+26+25+13+20, không còn legacy-A/home pending recovery. Đây là coverage review, không120 accepted hoặc xem lại độc lập mọi ảnh. Vẫn style gaps vật liệu/ánh sáng/chi tiết so với PDF.

Sáu handoff: [legacy A](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/powered-legacy-review-a/handoff.json>), [legacy B](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/powered-legacy-review-b/handoff.json>), [living](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/powered-living-review/handoff.json>), [tech](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/powered-tech-review/handoff.json>), [craft](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/powered-craft-review/handoff.json>), [home recovery](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/powered-home-recovery/handoff.json>).

Stipple terminal trong review tech thuộc ảnh cũ. Sau sửa hai vị trí nguồn,1211 actual Chrome một mẫu PASS10,636 giây test/13,343 giây tổng; ảnh mới không còn đốm cũ tại góc đó, không mọi góc hoặc PDF parity. [Kết quả terminal](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/expanded-assets-gallery/evidence/terminal-screen-fix-r1/results.json>); PNG mới SHA-256 `b6352226a8073a13664337718138ffad2ec94a58057cf6adf0bf548f971d2f8d`.

Furniture-interactions5PASS/43,691 giây có projected canvas click wardrobe/workstation/tool-bench và blocked wardrobe; lamp chỉ capture, không pixel/light-state assertion. Toàn API mock; powered gallery không đóng gate tương tác mọi item. Preview active401/401CPU/2tệp (`pwsh-899`) và84 ảnh cũ ở trạng thái tắt không thay render sau sửa.

## Hiệu năng và tham chiếu

Curve1207 actual Chrome6/6PASS/165.505,021ms: balanced/performance ×1/6/12 pane, sáu HUD samples58–60FPS mỗi cấu hình trên GTX1050Ti hardware ANGLE/D3D11, WebGL2, canvas1440×932/DPR1. Sàn8×8, clear material, reduced-motion, API fixture. Không GPU time hoặc physical mobile; `gl.info.autoReset=true` có thể thiếu multipass. Không benchmark phổ quát, ngưỡng60FPS acceptance hoặc kết luận mode nhanh hơn có ý nghĩa thống kê. [Summary](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/curve-performance-v7/evidence/curve-performance-r1/summary.json>).

Text+ảnh36 trang PDF đã đọc qua A/B/C: PDF10 starter home,11 penthouse,12 build,13 modular,14 doors,15 buy,16 furniture,28 home. Grid1m/tường3m là tiêu chí tham chiếu, không đo runtime đã đạt. PDF SHA-256 `DD904F65E3C25A89A2513CA9339B5D0C7AC7BE9ABC03458B339DF3B33C945D93`.

## Lịch sử rút gọn và gate còn mở

- Sửa tiếp xúc CPU chỉ xác nhận8 living/12 home, không mọi21/13 nhận xét; catalog/giá/kích thước/quyền sở hữu không đổi, chưa post-fix render approval.955 type+66/66PASS; living22.844/home20.664/tổng103.904 triangles, cap48part và6.000triangles/model, legacy45.000.958 fullFAIL bốn timeout5.000ms (3.433/3.437PASS/377,57giây);982 partition giữ assertions/timeout,581/581PASS.1076/1141 fullPASS sau đó chỉ revision lịch sử.
- Full1215 có3.867/3.868PASS, một FAIL digest crown cũ;1228 test-only giữ digest lịch sử74 recipe, scoped16/16PASS;1230 full3.868/3.868PASS và1223 buildPASS đều trước năm dòng production mới. Full1188/1189 FAIL và871/876/879 được giữ lịch sử; không dùng làm gate hiện tại.
- Fashion1238 FAIL ở mẫu11 sau10 mẫu hoàn tất; rotation đã sửa và1263 targeted2/2PASS, không121PASS. Strict1085 rasterFAIL độc lập giữ nguyên. Full121 mới theo `coverage-queue-r2.json` bảy batch vừa được cấp phép cho audit-repo bắt đầu; chưa có kết quả full mới ở đây. Các kết quả fashion không nghiệm thu housing.
- Snapshot tuần tự11:00 có furniture100/fashion86/shapes75;11:08 có120/121/110 sau import/spread home20/accessory35. Không snapshot nguyên tử hoặc acceptance. Live Neon, deploy, external AI, physical mobile và premium/PDF parity vẫn chưa xác minh. Checkpoint tiếp theo chỉ tra [TEST_REPORT](<TEST_REPORT.md>).

Lượt cập nhật này chỉ tài liệu theo yêu cầu, không sửa source, chạy lệnh/test/build/browser/install hoặc tự tính hash sản phẩm.
