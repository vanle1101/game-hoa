# Phạm vi công việc và nghiệm thu V7

## Mới nhất — UI-first: 8 nhóm đã release, QA có giới hạn; còn 2 sửa đang làm

Mục tiêu là UI/3D local trước,tích hợp đầy đủ chức năng sau,bảo toàn backend/save/logic. Tám nhóm đã bàn giao theo lead;owner và phạm vi lưu tại [ui-first-current.json](<C:/Users/phamc/.dsh/workai/life-level-v7/ui-first-current.json>). Antigravity thất bại đã thay bằng Codex;không ghi nhận đầu ra từ lượt thất bại.

Checkpoint do lead cung cấp:106+136 global TypeScript/scoped lint PASS;UI r3 8/8 PASS/89,13 giây với24 ảnh desktop +24 mobile,error/mutations0,overflow0;polish137 6/6 PASS/41,8 giây cho character dock,tài chính Việt hóa và preview shop hiện sớm. Lead đã xử lý CSS cache globals thay nhầm chunk bằng lưu trữ `.next/dev`,không xóa dữ liệu người dùng,khởi động lại `pwsh-117` Ready/HTTP200 tại `http://127.0.0.1:3100`. Không kiểm tra lại runtime trong lượt tài liệu.

**Phần còn lại:** sửa thứ tự DOM/bàn phím shop và khung nhìn thành phố đang thực hiện;kiểm tra phạm vi ảnh hưởng rồi tích hợp chức năng theo nhóm. Chưa nghiệm thu UI hoàn tất hoặc PDF parity.1543 và các checkpoint bên dưới là **HISTORICAL trước wave UI**,không đại diện nguồn hiện tại. Backend/save/logic và trạng thái asset không đổi bởi cập nhật tài liệu này.


**Trạng thái sản phẩm: INCOMPLETE — 0 VERIFIED; premium/PDF parity chưa được nghiệm thu.** [TEST_REPORT](<TEST_REPORT.md>) là nguồn chuẩn duy nhất cho checkpoint full đang thay đổi. Mốc đồng bộ lead đã thu: `pwsh-1268` exit0, global TypeScript/full ESLint PASS, Vitest **3.908/3.908 PASS, 82 tệp, 270,12 giây**, Next.js16.4.1 build PASS (compile2,1 giây/TypeScript10,4 giây). Đây không phải lượt tài liệu chạy lại hoặc chứng minh deploy.

Sau1230/1223 đã đổi năm dòng production: ba dòng rotation mặc định tường minh trong CharacterModel và hai dòng optional map→`null` trong ConstructionWorld. Không tiếp tục mô tả hash/checkpoint trước đó là nguồn đóng băng hiện tại.

## Nhánh công việc và giới hạn nghiệm thu

| Nhánh | Bằng chứng có căn cứ | Việc còn mở |
| --- | --- | --- |
| PDF A/B/C | Text+ảnh36 trang đã đọc, A01–12 đã phục hồi | Đối chiếu runtime từng tiêu chí, không parity từ đọc reference |
| Nội thất |120=36legacy+26living+25tech+13craft+20home; powered capture36+84 và supplement;120 review ban đầu đã lưu | Style gaps, chưa120 accepted/PDF parity, chưa đầy đủ tương tác |
| Thời trang |121cosmetics=24free+97paid;110shape keys;1263 targeted split-runner→buckle boots2/2PASS/164.552,629ms, equip/reload/unequip,bốn mutation,Gold delta0 | Full121 mới theo coverage-queue-r2.json bảy batch vừa được cấp phép cho audit-repo bắt đầu; chưa kết quả full mới/121PASS; strict1085FAIL giữ riêng |
| Trang bị |74=36weapons+30armor+8accessories;1214 crown-fix-r5 Chrome2/2PASS/206.597,905ms,74capture | Không mọi rig fit/animation/occlusion/premium; r4/1134 lịch sử |
| Terminal |1211 một mẫu ChromePASS/10,636giây test/13,343giây tổng, góc mới hết stipple cũ | Không mọi góc hoặc PDF parity |
| Cửa/kính cong |8doors;1021 bounded8PASS;1133 curve6PASS;1207 sáu cấu hình1/6/12pane×hai mode,HUD58–60 trên GTX1050Ti | Không toàn control/biến thể, GPU timing,physical mobile hoặc benchmark phổ quát |
| Tường giữ lại |1266 Chrome1/1PASS/8.722,652ms, select/Escape hai lần cùng mesh/material/geometry,map texture→null→texture,không mutation nghiệp vụ | Transparent painting và commit/reload chưa covered; không pixel baseline/premium |
| Registry |0 VERIFIED | Cần source hash+artifact hash+environment+testCase theo asset |

## Điều kiện bàn giao

1. Source integration, capture coverage, manual review, CPU regression và runtime/visual acceptance là các phạm vi khác nhau. Không cộng các lần chạy khác revision thành full current PASS.
2. Powered union120 và review ban đầu120 đã lưu qua sáu handoff18+18+26+25+13+20; legacy-A/home không còn pending recovery. Tất cả còn style gaps. Mouth/shoulders mặc định đã sửa nhưng gate hình ảnh vẫn mở.
3. Bounded browser dùng UI/WebGL và applyAction thật với API fixture/in-memory, không live Neon/process restart. Furniture interactions5PASS có canvas click, nhưng lamp chỉ capture, không pixel/light-state assertion. Gallery không thay tương tác đầy đủ.
4. Strict1085 rasterFAIL không bị thay bởi observation1181 bounded2PASS hoặc targeted1263PASS. Historical1238 đã hoàn tất10 mẫu rồi FAIL mẫu11 do16 matrixWorld scalar khác trên bốn mesh; lỗi rotation đã sửa, không còn ghi “đang sửa”. Lượt1238 vẫn FAIL, không đổi ngược lịch sử.
5. Nguồn1263 không đổi trong lượt targeted, SHA-256 `0dc0717bf174975356a1ac329c858ad83f4b30e0127476e2c6fefd6bb6125973`; không suy hash này thành nghiệm thu mọi asset. Wall readback cùng retained UUID và map-null/restored chỉ chứng minh ca được kiểm tra.
6. Full1215 một FAIL digest crown cũ rồi test-only1228 scoped16PASS/full1230PASS là các mốc riêng. Full958 bốn timeout,1188/1189 fixtureFAIL và các checkpoint cũ được giữ trong lịch sử [TEST_REPORT](<TEST_REPORT.md>), không trình bày như gate hiện tại.
7. BuildPASS không chứng minh deploy. Live Neon/deploy/external AI/physical mobile chưa xác minh; HUD không GPU time hoặc ngưỡng60FPS acceptance. Sửa nguồn sau checkpoint cần kiểm tra lại phần bị ảnh hưởng.

## Nguồn bàn giao

Đã đọc [wearable handoff](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/wearable-transition-fix/handoff.md>) và [wall readback](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/wall-material-transition/evidence/wall-material-transition-r1/readback-summary.json>). Handoff wearable chỉ có scoped CPU/lint/type, chưa browser tại thời điểm handoff;1263 là bằng chứng browser lead thu sau đó. Wall readback ghi một reconcile, errors/consoleErrors/unexpectedApi rỗng, finalGold10000, không live DB/transparent-paint/commit/reload.

Bằng chứng khác ngoài sản phẩm: [equipment r5](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/equipment-gallery-v7/evidence/equipment-crown-fix-r5/results.json>), [terminal](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/expanded-assets-gallery/evidence/terminal-screen-fix-r1/results.json>), [curve performance](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/curve-performance-v7/evidence/curve-performance-r1/summary.json>). Danh sách powered handoff và scope chi tiết tại [housing matrix](<HOUSING_REFERENCE_MATRIX.md>); fashion failure/transition tại [character matrix](<CHARACTER_CUSTOMIZATION_MATRIX.md>).

Phạm vi tài liệu được yêu cầu chỉ [character matrix](<CHARACTER_CUSTOMIZATION_MATRIX.md>), [housing matrix](<HOUSING_REFERENCE_MATRIX.md>), [phạm vi công việc](<AGENT_TASKS.md>) và [quyết định](<DECISIONS.md>). Không sửa source/tests hoặc chạy commands/browser/build/install trong lượt này; không ghi ghi chú vận hành vào product code.

PDF SHA-256 `DD904F65E3C25A89A2513CA9339B5D0C7AC7BE9ABC03458B339DF3B33C945D93`. Snapshot catalog11:00 có furniture100/fashion86/shapes75,11:08 có120/121/110 sau home20/accessory35 tích hợp; phép đọc/hash tuần tự không nguyên tử, không acceptance. Trạng thái queue mới chỉ là được cấp phép bắt đầu, không DONE/121PASS; tiếp tục theo nguồn chuẩn [TEST_REPORT](<TEST_REPORT.md>).
