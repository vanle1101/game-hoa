"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Gift, Home, MapPin, ShieldCheck, Sparkles, X } from "lucide-react";
import CharacterStudio from "@/components/character/CharacterStudio";
import type { Action, GameState } from "@/domain/types";
import { HOUSING_BUILDINGS, HOUSING_FLOORS, HOUSING_LAYOUTS, STARTER_FURNITURE_IDS } from "@/housing/catalog";
import { canReceiveStarterHome } from "@/housing/engine";
import { FURNITURE_CATALOG } from "@/furniture/catalog";
import { COSMETICS, STARTER_OUTFITS } from "@/character/catalog";
import "./housing-onboarding.css";

const ResidencePreview = dynamic(() => import("./ResidencePreview"), { ssr: false, loading: () => <div className="housing-preview housing-preview-loading" role="status">Đang dựng không gian 3D…</div> });
export type HousingOnboardingProps = { state: GameState; act: (action: Action) => void; busy: boolean; onClose: () => void };
type Floor = 8 | 16 | 24;
type LayoutId = "studio" | "one-bedroom" | "open-plan";
const STEPS = ["Chào mừng", "Nhân vật", "Khu phố", "Tầng nhà", "Bố cục", "Hành trang", "Dọn vào"];
const FLOOR_COPY: Record<Floor, { title: string; description: string }> = {
  8: { title: "Nhịp sống phố thị", description: "Gần đường tàu trên cao và ánh sáng ấm của những con phố bên dưới." },
  16: { title: "Giữa đường chân trời", description: "Góc nhìn cân bằng giữa nhịp phố và những tòa tháp Neon Haven." },
  24: { title: "Chạm đến bầu trời", description: "Tầm nhìn cao thoáng rộng phía trên đường chân trời thành phố." },
};
const LAYOUT_COPY: Record<LayoutId, { size: string; description: string }> = {
  studio: { size: "Không gian mở · ~120m²", description: "Không gian mở khởi đầu thoáng rộng, ngập ánh đèn ấm với cửa kính toàn chiều cao." },
  "one-bedroom": { size: "1 phòng tách biệt · ~120m²", description: "Khu nghỉ ngơi có vách ngăn riêng tư, tách biệt tinh tế với khu sinh hoạt và làm việc." },
  "open-plan": { size: "Loft liên thông · ~120m²", description: "Mặt bằng liên thông thoáng đãng để tự do phân vùng nội thất và lối đi trong nhà." },
};
const FURNITURE_NAMES: Record<string, string> = {
  ...Object.fromEntries(FURNITURE_CATALOG.map(item => [item.id, item.name])),
  "cloud-bed": "Giường Cloud",
  workstation: "Bàn làm việc",
  "haven-sofa": "Sofa Haven",
  "dining-chair": "Ghế làm việc & bàn ăn",
  "v7-desktop-tower": "Tháp máy tính công nghệ",
  wardrobe: "Tủ quần áo hai cánh",
  "neon-floor-lamp": "Đèn sàn Neon",
  "biolume-plant": "Cây Biolume",
};

export default function HousingOnboarding({ state, act, busy, onClose }: HousingOnboardingProps) {
  const [step, setStep] = useState(0);
  const [buildingId, setBuildingId] = useState<string>(state.residence?.buildingId ?? "neon-haven");
  const [floor, setFloor] = useState<Floor>(state.residence?.floor ?? 8);
  const [layoutId, setLayoutId] = useState<LayoutId>(state.residence?.layoutId ?? "studio");
  const [submitted, setSubmitted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const closed = useRef(false);
  const starterEligible = canReceiveStarterHome(state);
  const selectedBuilding = HOUSING_BUILDINGS.find(building => building.id === buildingId);
  const selectedLayout = HOUSING_LAYOUTS.find(layout => layout.id === layoutId);
  const starterCosmetics = COSMETICS.filter(item => item.price === 0);
  const alreadySettled = Boolean(state.residence);

  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    if (submitted && state.residence && !closed.current) { closed.current = true; onClose(); }
  }, [onClose, state.residence, submitted]);

  const settle = () => {
    if (busy || alreadySettled) return;
    setSubmitted(true);
    act({ type: "housing.settle", districtId: "district07", buildingId, floor, layoutId });
  };
  const next = () => setStep(value => Math.min(value + 1, STEPS.length - 1));
  const preview = (mode: "city" | "floor" | "room") => <section className="housing-preview-stage" data-preview-mode={mode} aria-label="Xem trước không gian sống">
    <div className="housing-preview-topbar"><span className="housing-preview-live"><i aria-hidden="true" />{mode === "room" ? "CĂN HỘ CỦA BẠN" : "NEON HAVEN"}</span><span className="housing-preview-Chip">{mode === "room" ? selectedLayout?.name : selectedBuilding?.name}</span></div>
    <ResidencePreview mode={mode} floor={floor} layoutId={layoutId} buildingId={buildingId} performance={state.settings.graphics === "performance"} onFloorChange={mode === "floor" ? setFloor : undefined} />
    <div className="housing-preview-details"><span><MapPin size={14} aria-hidden="true" />District 07 · Tầng {floor}</span><span>{mode === "floor" ? "Chọn dải sáng hoặc nút tầng" : "Kéo để xoay · Cuộn để thu phóng"}</span></div>
  </section>;

  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="housing-overlay" />
    <Dialog.Content className="housing-onboarding" data-step={step} data-reduced-motion={state.settings.reducedMotion} aria-describedby="housing-description" onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <header className="housing-header"><div className="housing-brand"><span>LIFE<span>{"//"}</span>LEVEL</span><small>NEON HAVEN · HỒ SƠ CƯ DÂN</small></div><div className="housing-header-meta"><span className="housing-header-badge"><ShieldCheck size={14} aria-hidden="true" />KHÔNG MẤT VÀNG</span><Dialog.Close className="housing-close" disabled={busy} aria-label="Đóng hướng dẫn, giữ nguyên tiến trình"><X size={21} /></Dialog.Close></div></header>
      <nav className="housing-step-nav" aria-label="Tiến trình nhận nhà"><div className="housing-step-summary"><span>KHỞI ĐẦU CỦA BẠN</span><strong>Bước {step + 1} / {STEPS.length} · {STEPS[step]}</strong></div><progress className="housing-step-progress" value={step + 1} max={STEPS.length} aria-label={`Bước ${step + 1} trên ${STEPS.length}: ${STEPS[step]}`} /><ol>{STEPS.map((label, index) => <li key={label} className={index < step ? "is-done" : undefined} aria-current={step === index ? "step" : undefined}><button type="button" aria-label={`Bước ${index + 1}: ${label}`} disabled={busy || index > step} onClick={() => setStep(index)}><span>{index < step ? <Check size={13} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><small>{label}</small></button></li>)}</ol></nav>
      <div className="housing-body">
        <div className="housing-step-heading"><div className="housing-step-heading-top"><span className="housing-kicker">KHỞI ĐẦU CỦA BẠN / {String(step + 1).padStart(2, "0")}</span><span className="housing-step-pill">{STEPS[step]}</span></div><Dialog.Title ref={heading} tabIndex={-1}>{["Một chương mới. Một nơi thuộc về bạn.", "Bắt đầu từ chính bạn", "Chọn nơi gọi là nhà", "Thành phố qua góc nhìn của bạn", "Không gian cho nhịp sống riêng", "Hành trang cho ngày đầu tiên", "Chào mừng về nhà"][step]}</Dialog.Title><Dialog.Description id="housing-description">{[
          "Tạo nhân vật, chọn căn hộ khởi đầu không gian mở ~120m² với cửa kính toàn chiều cao, ánh đèn ấm áp và nội thất cơ bản tại Neon Haven. Không đặt lại tiến trình hay tiêu vàng khi nhận nhà.",
          "Tùy chỉnh trong xưởng nhân vật bên dưới. Nhấn Lưu ngoại hình trước khi tiếp tục để giữ lại thay đổi.",
          "District 07 là khu dân cư khởi đầu. Chọn tòa nhà yêu thích giữa đường chân trời Neon Haven; các lựa chọn không mất vàng.",
          "Chọn tầng 8, 16 hoặc 24 để thay đổi độ cao camera thực và quan sát đường chân trời. Bạn cũng có thể nhấn vào các dải sáng trên tòa nhà.",
          starterEligible ? "Chọn bố cục khởi đầu cho căn hộ không gian mở ~120m² với vách kính toàn chiều cao. Sau khi nhận nhà, bạn có thể tự do phân chia phòng bằng tường trong và cửa nội thất." : "Bố cục dưới đây là tham khảo cho căn hộ mới (~120m²). Công trình và nội thất hiện có của bạn sẽ được giữ nguyên theo hồ sơ gốc, không bị thay đổi diện tích.",
          starterEligible ? "Nội thất cơ bản và hệ thống đèn ấm áp được trao một lần khi nhận nhà. Trang phục khởi đầu có thể phối tự do." : "Không cấp lại nội thất hay thay thế công trình. Mọi tài sản và diện tích hiện có vẫn thuộc về bạn.",
          "Kiểm tra địa chỉ trước khi xác nhận. Bạn chỉ rời hướng dẫn khi máy chủ đã lưu nơi ở thành công.",
        ][step]}</Dialog.Description></div>

        {step === 0 && <div className="housing-split housing-welcome">{preview("city")}<div className="housing-welcome-copy"><span className="housing-tag"><MapPin size={14} /> DISTRICT 07 · NEON HAVEN</span><h3>Cuộc sống tiếp theo<br /><em>bắt đầu ở đây.</em></h3><p>Căn hộ không gian mở cố định ~120m² với cửa kính toàn chiều cao nhìn ra đường chân trời, ánh đèn ấm áp và nội thất cơ bản sẵn sàng cho ngày đầu tiên.</p><div className="housing-telemetry-strip"><div><small>KHÔNG GIAN</small><strong>{starterEligible ? "Mở ~120m²" : "Giữ nguyên"}</strong></div><div><small>CHI PHÍ NHẬN</small><strong>0 G</strong></div><div><small>HÀNH TRÌNH</small><strong>7 bước</strong></div></div><div className="housing-benefits"><span><Home size={19} />Không gian mở ấm áp &amp; cửa kính toàn chiều cao</span><span><Sparkles size={19} />Nhân vật &amp; nội thất cơ bản đồng bộ</span><span><ShieldCheck size={19} />Giữ nguyên tiến trình và công trình đang có</span></div></div></div>}
        {step === 1 && <div className="housing-character"><CharacterStudio state={state} act={act} busy={busy} /></div>}
        {step === 2 && <div className="housing-split">{preview("city")}<div className="housing-options"><div className="housing-district"><MapPin size={22} /><div><strong>District 07</strong><p>Khu dân cư khởi đầu · Neon Haven</p></div><CheckCircle2 size={20} /></div><fieldset><legend>Tòa nhà</legend>{HOUSING_BUILDINGS.map((building, index) => <button type="button" key={building.id} className="housing-choice" aria-pressed={buildingId === building.id} onClick={() => setBuildingId(building.id)}><span className="housing-choice-icon" data-building={building.id} aria-hidden="true"><Building2 size={24} /></span><span><strong>{building.name}</strong><small>{["Sắc cyan · Nhịp sống trung tâm", "Sắc tím · Đường chân trời", "Sắc hổ phách · Thành phố ấm áp"][index]}</small></span>{buildingId === building.id && <Check size={18} />}</button>)}</fieldset><p className="housing-note">Khác biệt về địa chỉ và sắc thái tòa nhà; không tăng chỉ số nhân vật và không thay đổi kết cấu mặt ngoài tòa tháp.</p></div></div>}
        {step === 3 && <div className="housing-split">{preview("floor")}<fieldset className="housing-options"><legend>Chọn tầng ở</legend>{HOUSING_FLOORS.map(value => <button type="button" key={value} className="housing-choice" aria-pressed={floor === value} onClick={() => setFloor(value)}><span className="housing-floor-number">{value}</span><span><strong>{FLOOR_COPY[value].title}</strong><small>{FLOOR_COPY[value].description}</small></span>{floor === value && <Check size={18} />}</button>)}<p className="housing-note">Tầng {floor} · Độ cao minh họa tầm nhìn qua cửa kính toàn chiều cao. Tầng ở không làm thay đổi diện tích trong nhà.</p></fieldset></div>}
        {step === 4 && <div className="housing-split">{preview("room")}<fieldset className="housing-options"><legend>Bố cục căn hộ</legend>{HOUSING_LAYOUTS.map(layout => <button type="button" key={layout.id} className="housing-choice" aria-pressed={layoutId === layout.id} onClick={() => setLayoutId(layout.id)}><span className="housing-choice-icon" aria-hidden="true"><Home size={23} /></span><span><strong>{layout.name}<em>{starterEligible ? LAYOUT_COPY[layout.id].size : "Giữ nguyên công trình"}</em></strong><small>{LAYOUT_COPY[layout.id].description}</small></span>{layoutId === layout.id && <Check size={18} />}</button>)}<p className="housing-note">{starterEligible ? "Khung căn hộ cố định ~120m² với cửa kính toàn chiều cao, ánh đèn ấm và nội thất cơ bản. Bạn tự do ngăn phòng bên trong, không xóa mặt ngoài tòa nhà." : "Nếu bạn đã có công trình hoặc mặt bằng lưu trước đó (như nhà 4×4 cũ), hệ thống giữ nguyên hiện trạng cho đến khi hồ sơ nâng cấp."}</p></fieldset></div>}
        {step === 5 && <div className="housing-kit"><section><div className="housing-section-title"><Gift size={22} /><h3>{starterEligible ? "Bộ nội thất chào mừng" : "Tài sản của bạn được giữ nguyên"}</h3><span>{starterEligible ? "0 G" : "KHÔNG THAY THẾ"}</span></div>{starterEligible ? <ul>{STARTER_FURNITURE_IDS.map(id => <li key={id}><CheckCircle2 size={17} /><span>{FURNITURE_NAMES[id] ?? id}</span><small>× 1</small></li>)}</ul> : <p className="housing-preserve"><ShieldCheck size={36} />Hệ thống không xóa nhà cũ, không đặt lại vật phẩm và không cộng lặp gói quà.</p>}<p className="housing-note">{starterEligible ? "Nội thất cơ bản và ánh đèn ấm sẽ được lưu cùng căn hộ khi bạn xác nhận bước cuối." : "Bạn đang chọn thông tin nơi ở; công trình và diện tích hiện tại không bị thay đổi."}</p></section><section><div className="housing-section-title"><Sparkles size={22} /><h3>Tủ đồ khởi đầu</h3><span>MIỄN PHÍ</span></div><p>{starterCosmetics.length} món trang phục miễn phí trong tủ đồ. Trở lại bước Nhân vật để thử và mặc bộ bạn thích.</p><div className="housing-outfits">{STARTER_OUTFITS.map(outfit => <div key={outfit.id}><div className="housing-outfit-colors">{outfit.items.map(id => <i key={id} style={{ background: COSMETICS.find(item => item.id === id)?.color }} />)}</div><strong>{outfit.name}</strong><small>Phối từng món trong xưởng nhân vật</small></div>)}</div></section></div>}
        {step === 6 && <div className="housing-split">{preview("room")}<div className="housing-confirm"><span className="housing-tag"><Home size={15} /> ĐỊA CHỈ CỦA BẠN</span><h3>{selectedBuilding?.name}</h3><dl><div><dt>Cư dân</dt><dd>{state.character.name}</dd></div><div><dt>Khu phố</dt><dd>District 07</dd></div><div><dt>Tầng</dt><dd>{floor}</dd></div><div><dt>Bố cục đã chọn</dt><dd>{selectedLayout?.name}</dd></div><div><dt>Không gian</dt><dd>{starterEligible ? "Căn hộ mở cố định ~120m²" : "Giữ nguyên công trình hiện có"}</dd></div><div><dt>Chi phí nhận nhà</dt><dd>0 G</dd></div></dl><p className="housing-note"><ShieldCheck size={17} />{starterEligible ? "Căn hộ ~120m², cửa kính toàn chiều cao và gói nội thất cơ bản được cấp một lần. Xác nhận không trừ vàng." : "Công trình, diện tích hiện tại, nội thất và số dư của bạn được giữ nguyên."}</p>{submitted && !state.residence && <p className="housing-save-status" role="status">{busy ? "Đang gửi lựa chọn đến máy chủ…" : "Chưa nhận được xác nhận nơi ở. Nếu có lỗi hoặc mất kết nối, hãy kiểm tra thông báo rồi thử lại; lựa chọn của bạn vẫn được giữ."}</p>}{alreadySettled && <p className="housing-settled-status" role="status">Bạn đã có nơi ở. Không thể nhận lại gói khởi đầu.</p>}</div></div>}
      </div>
      <footer className="housing-footer"><div><span>BƯỚC {step + 1} / {STEPS.length}</span><small>{busy ? "Đang đồng bộ…" : "Không cần thanh toán · Không đặt lại dữ liệu"}</small></div><div className="housing-footer-actions">{step > 0 ? <button type="button" className="housing-secondary" disabled={busy} onClick={() => setStep(value => value - 1)}><ArrowLeft size={16} />Quay lại</button> : <button type="button" className="housing-secondary" disabled={busy} onClick={onClose}>Để sau</button>}{step < STEPS.length - 1 ? <button type="button" className="housing-primary" disabled={busy} onClick={next}>{step === 0 ? "Bắt đầu hành trình" : "Tiếp tục"}<ArrowRight size={17} /></button> : <button type="button" className="housing-primary" disabled={busy || alreadySettled} onClick={settle}>{busy ? "Đang nhận nhà…" : "Nhận nhà & vào thế giới"}<Home size={17} /></button>}</div></footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
