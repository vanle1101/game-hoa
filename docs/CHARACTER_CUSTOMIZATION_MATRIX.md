# Ma trận nhân vật và thời trang V7

**INCOMPLETE — 0 VERIFIED; premium/PDF parity chưa được nghiệm thu.** [TEST_REPORT](<TEST_REPORT.md>) là nguồn chuẩn.1543 do lead thu EXIT0:global TypeScript/full ESLint PASS,**4.254/4.254 tests/85 tệp/478,67 giây**;production Next.js16.4.1 build PASS (compile15 giây,TypeScript36,2 giây). +120 ca do partition sleeve154→244/hair24→54,không thêm coverage.1504 FAIL4133/4134 do một timeout5000ms/build không chạy vẫn giữ lịch sử;1268 full/build PASS là lịch sử trước sửa hiện tại. Lamp1525 Chrome8/8 PASS;hair1650 compact56/56 ca,112 originals,448 samples PASS/604.376ms. Targeted15 semantic/business hoàn tất15/15 unique,45 views,30 paired commands (11 từ1594 +1 từ1677 +3 từ1684),Gold delta0/errors[],visual UNKNOWN. Đây không phải full121/current-source hoặc premium acceptance. Đây không phải lần chạy lại kiểm thử hay bằng chứng deploy.

Sau `pwsh-1230`/`pwsh-1223`, năm dòng production đã đổi: ba dòng trong CharacterModel đặt rotation mặc định tường minh để mesh giữ lại không kế thừa rotation cũ; hai dòng trong ConstructionWorld xóa optional map bằng `null`. Vì vậy checkpoint/hash đóng băng trước đó chỉ là lịch sử, không đại diện nguồn hiện tại.

## Catalog thực tế

| Nhóm | Composition | Giới hạn |
| --- | --- | --- |
| Fashion | 121 = 44 base + 18 lower + 23 upper + 1 polo + 35 accessory | Không phải 121 mẫu đã nghiệm thu |
| Free / paid | 24 free = 23 base + polo; 97 paid = 21 base + 18 lower + 23 upper + 35 accessory | Accessory đã tích hợp nguồn |
| Wearable shapes | 110 = 33 base + 18 lower + 23 upper + 1 polo + 35 accessory | Khóa source, không unique geometry accepted |
| Starter outfits | 3 preset mixable; polo miễn phí | Chưa đủ visual acceptance mọi phối đồ |
| Equipment | 74 = 36 weapons + 30 armor + 8 accessories | Không cộng legacy override lần nữa |
| Registry | 0 VERIFIED | Chưa promote hash-bound runtime acceptance |

## Chuyển đổi wearable — lỗi và bằng chứng sau sửa

Lịch sử `pwsh-1238` full121 FAIL ở mẫu thứ 11, `v7-buckle-combat-boots`; chỉ 10 mẫu hoàn tất trang bị/tải lại/tháo. Có 16 giá trị matrixWorld khác trên bốn mesh do rotation từ đôi giày trước còn trong preview nhưng về không sau reload; geometry/material/camera không đổi. Gold delta 0, 21 mutation gồm 10 cặp equip/unequip và lần equip của mẫu lỗi. Đây là lỗi semantic, không phải nhiễu raster.

[Handoff wearable](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/wearable-transition-fix/handoff.md>) giải thích R3F bỏ qua giá trị `undefined`; rotation `[0,0,0]` tường minh reset mesh giữ lại mà không remount. Kiểm chứng CPU trong handoff: nguồn cũ 33 FAIL/35; nguồn sửa cùng scoped suites 57/57 PASS, scoped lint/type PASS. Handoff này chưa có browser sau sửa; không dùng CPU thay Chrome.

Bằng chứng browser sau đó do lead thu riêng: `pwsh-1263` actual Chrome split-runner → buckle boots **2/2 PASS, 164.552,629 ms**, đủ trang bị/tải lại/tháo, bốn mutation, Gold delta 0. Nguồn không đổi trong lượt kiểm tra, SHA-256 `0dc0717bf174975356a1ac329c858ad83f4b30e0127476e2c6fefd6bb6125973`. Kết quả chỉ xác nhận chuyển đổi mục tiêu, không full121 hoặc strict raster PASS.

## Coverage fashion121 đã hoàn tất — không phải visual acceptance

[Tổng hợp coverage r3](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/fashion-observation-v7/coverage-complete-r3-summary.json>) ghi `COMPLETE_OBSERVATION_NOT_VISUAL_ACCEPTANCE`: **121 ID duy nhất,369 views,242 mutation =121 cặp equip/unequip**. Nguồn capture không đổi: `0dc0717bf174975356a1ac329c858ad83f4b30e0127476e2c6fefd6bb6125973`. Coverage gồm20 mẫu batch01 criteria r2 đã giữ nguyên +101 mẫu batch02–07 criteria r3 đã hoàn tất; không cộng10 mẫu lịch sử1238. Trường `pendingItems:101` trong mô tả criteria là metadata kế hoạch cũ, không phải số còn chờ ở tổng hợp đã complete.

Exact semantic sau reload,Gold delta0,lỗi rỗng đạt trong **fixture toàn bộ item đã sở hữu/API intercept**, không mua hàng thật hoặc live persistence. Một `v7-top-anorak` có original PNG608×591 so608×590: **NON_COMPARABLE**, metric null,không pixel PASS; r3 không crop/resize/nới tolerance. Strict1085 FAIL và1276 batch02 dimension-assertion FAIL vẫn giữ trong lịch sử.

Review thủ công toàn bộ121 ID đã hoàn tất theo view thực đọc;manual batch06 không còn chờ. Các [handoff và giới hạn](<VISUAL_QA_REPORT.md>) ghi style gap lớn; quan sát tay áo/khe scarf đã dẫn tới sửa hình học/nối khăn và kiểm thử CPU. Bộ121 observation vẫn gắn nguồn cũ `0dc0717bf174975356a1ac329c858ad83f4b30e0127476e2c6fefd6bb6125973`,không chứng nhận sửa mới. Phối đồ nhiều slot,mọi body/pose,side/back/animation,pixel-perfect và premium acceptance còn chưa biết/chưa đạt.

## Tiếp xúc tay áo và tóc — release CPU có giới hạn

Tay áo/nối khăn đạt154 contact tests.1378 scoped lint/global type PASS nhưng lượt kết hợp605/606 còn một upper aggregate timeout5000ms;1394 suite nguyên trạng chạy riêng7/7 PASS.1419 partition test-only29/29 và lint PASS:7→29,+22 do phân chia recipe,giữ mọi tổ hợp/assertion/default timeout,không coverage mới/không sửa sản phẩm,không xóa failure1378.

[Hair final handoff](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/hair-crown-final/handoff.md>) ghi477/477 PASS/6 tệp/62,09 giây,scoped lint và scoped TypeScript ba entry files cùng dependencies PASS,không global typecheck. Scalp envelope dựa trên actual headMeshData(face); upper rings và apex được đóng,giữ lower hairline/nape policy.162720 front-sided paired triangle ray samples qua6 faces ×6 profiles:zero misses,min+.0020636145069100054,max+.011962252147208918;indexed upper-scalp triangle checks bằng0 intersections trong phạm vi đo. Không tuyên bố bao kín shaved/nape domains,mọi pose hoặc hat-collision/browser acceptance.

Nguồn hair release: `character-shape.ts` SHA-256 `eada89ea5dcb89e04cb103817904345b219dc01385519b07a98f574276cc15c6`; `CharacterModel.tsx` SHA-256 `2de044c4d1c6f8fc2761bdfe153f2ee9c044eaedd55728f2768bc4ceb5ef1afa`; test `hair-cap-contact.test.ts` SHA-256 `be6dbfd3c56f93c41c30a4562c70fa28d4dddb31174bad5f0e645b6f29d3b868`. Đây là hash đọc từ handoff,không tự tính lại trong lượt tài liệu. Hair1535 timeout180s ngay ca đầu/0 hoàn tất/13 skipped giữ lịch sử,không PASS. Hair1650 sau đó compact56/56 ca,112 originals,448 samples PASS;targeted15 semantic/business đã hoàn tất. Source chung `d6fd3d7d773ff466b0ff0b8f9256c2bcde58baebf83a024738ad345484e9ac62`;test hair `c58ad657021ebc893bcc044d65af089f6ce833138fd0ba7079aae8c9c5cfa7bc`,test targeted cuối `d3392fc798e8a2e1bbf980203858f74f7a22055a8d2d5626a1f3ce3ed75c00a9`. Tổng15 gồm11 mẫu criteria cũ1594 +4 compact1677/1684,không một lượt đồng nhất;1594 item12 timeout vẫn FAIL. Bốn reviewer handoffs đã đọc112 originals:không scalp breakthrough/open cap hole rõ ràng,nhưng face3 tiny ear/edge points,dark hat/hair lobes,warm rim còn unknown;style xa PDF. Liên kết handoffs,criteria đầy đủ và mesh-overshirt launch-binding limitation tại [TEST_REPORT](<TEST_REPORT.md>). Visual UNKNOWN,không premium/hat-collision/all-angle acceptance. Registry1627 vẫn349/335/324,0 VERIFIED;26 assert-shim PASS không phải Vitest,chi tiết [Asset coverage](<ASSET_COVERAGE_REPORT.md>).1543 full product gate vẫn hiện hành.

## Strict raster và lịch sử rút gọn

- `pwsh-1085` **strict raster FAIL giữ nguyên**, tách biệt với lỗi retained rotation. Split-flare chưa có ba frame exact liên tiếp; semantic observation không thay pixel-perfect acceptance.
- Full gallery cũ FAIL ở mẫu thứ năm tech-panel-skirt, chỉ 4/121 capture hoàn tất, chưa economy final PASS. Lượt first-five khác hết outer timeout 375 giây trước unequip mẫu thứ tư: bốn capture nhưng ba cleanup, không app bug đã chứng minh. Tối ưu test-only `pwsh-1048` sau đó PASS năm mẫu/10 mutation/77,775 giây, không full121.
- Observation riêng `pwsh-1181` bounded wrap-skirt/split-flare 2/2 PASS, bốn equip/unequip, Gold không đổi, semantic sau reload khớp; split-flare vẫn lệch ba kênh/ba pixel delta1. R4 trước đó ba mẫu PASS/229,258 giây cũng chỉ bounded.
- Full1215 có 3.867/3.868 PASS, một FAIL do digest crown lịch sử. Test-only1228 khôi phục ba vị trí spire trên clone, giữ digest gốc74 recipe và assert hiện tại; scoped16/16 PASS. Full1230 sau đó 3.868/3.868 PASS, build1223 PASS, đều trước năm dòng production mới.
- Full958 có 3.433/3.437 PASS, bốn timeout5.000 ms/377,57 giây. Partition giữ assertions/timeout; scoped982 đạt581/581, tăng376 ca không thêm coverage. Full1076/1141 sau đó PASS ở revision lịch sử. Full1188/1189 FAIL fixture cũ được giữ; các mốc871/876/879 và snapshot catalog cũ không là gate hiện tại.

## Equipment và tham chiếu

`pwsh-1214` actual Chrome crown-fix-r5 **2/2 PASS, 206.597,905 ms**, đủ74 capture; skipped/unexpected/flaky0, errors rỗng theo lead. R4/1134 là lịch sử trước crown fix. Đây là scene+pixel preview proof, không mọi rig fit, animation, occlusion hoặc PDF parity. Nguồn: [kết quả r5](<C:/Users/phamc/.dsh/workai/life-level-v7/agents/equipment-gallery-v7/evidence/equipment-crown-fix-r5/results.json>).

Text và ảnh36 trang PDF đã được đọc qua A/B/C. Creator ở PDF06/concept02, wardrobe PDF33–34; không nhầm số concept với số trang. PDF SHA-256 `DD904F65E3C25A89A2513CA9339B5D0C7AC7BE9ABC03458B339DF3B33C945D93`. Mesh điều khiển thực, preset tóc/khuôn mặt/cơ thể, ba starter outfit, vật liệu và silhouette vẫn là tiêu chí; không diễn giải microtext không đọc được thành dữ kiện. Mouth/shoulders mặc định đã sửa, không còn blocker cũ, nhưng clipping theo dáng người, animation và phối nhiều slot chưa có visual acceptance đầy đủ.

Snapshot composition `2026-10-16T11:00:51.3026786+07:00` có furniture100/fashion86/shapes75; snapshot `2026-10-16T11:08:01.6593072+07:00` có furniture120/fashion121 (24free/97paid)/shapes110 sau home20/accessory35 tích hợp. Snapshot tuần tự, không nguyên tử hoặc nghiệm thu runtime. Live Neon, deploy, external AI và physical mobile chưa xác minh; browser mobile chỉ giả lập. Các mốc full/scoped khác và artifact lịch sử tra [TEST_REPORT](<TEST_REPORT.md>), không cộng thành acceptance hiện tại.
