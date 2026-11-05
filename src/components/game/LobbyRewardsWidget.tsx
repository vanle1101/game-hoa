"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowRight, CircleDollarSign, Gift } from "lucide-react";
import type { GameState, RealLifeReward } from "@/domain/types";
import MechVectorFrame from "./MechVectorFrame";
import CyberTechButton from "./CyberTechButton";

type RewardCategory = "all" | "item" | "anywhere" | "life";
const referenceThumbnailMedia = "(min-width: 1760px) and (max-width: 2100px) and (min-height: 850px) and (max-height: 1000px)";

export type LobbyRewardsWidgetProps = {
  state: GameState;
  onNavigate: (screen: string) => void;
  onRedeem: (rewardId: string) => void;
  actionsDisabled: boolean;
};

const tabs: readonly { id: RewardCategory; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "item", label: "Vật phẩm" },
  { id: "anywhere", label: "Bất cứ đâu" },
  { id: "life", label: "Đời sống" },
];

const starterArt: Record<string, { src: string; thumbnailSrc: string; category: Exclude<RewardCategory, "all"> }> = {
  "starter-reward:headphones": { src: "reward-headphones.jpg", thumbnailSrc: "reward-ref-headphones.png", category: "item" },
  "starter-reward:skin": { src: "reward-outfit.jpg", thumbnailSrc: "reward-ref-outfit.png", category: "item" },
  "starter-reward:skill-setup": { src: "reward-room.jpg", thumbnailSrc: "reward-ref-room.png", category: "anywhere" },
  "starter-reward:resort": { src: "reward-resort.jpg", thumbnailSrc: "reward-ref-resort.png", category: "life" },
  "starter-reward:bedroom": { src: "reward-bed.jpg", thumbnailSrc: "reward-ref-bed.png", category: "life" },
  "starter-reward:cafe": { src: "reward-coffee.jpg", thumbnailSrc: "reward-ref-coffee.png", category: "anywhere" },
};

export function rewardPresentation(reward: RealLifeReward) {
  const known = starterArt[reward.id];
  if (known) return known;
  const name = reward.name.toLocaleLowerCase("vi-VN");
  if (/tai nghe|áo|skin|vật phẩm|thiết bị/.test(name)) return starterArt["starter-reward:headphones"];
  if (/cà phê|cafe|sách|học|kỹ năng/.test(name)) return starterArt["starter-reward:cafe"];
  return starterArt["starter-reward:resort"];
}

export function filterLobbyRewards(rewards: readonly RealLifeReward[], category: RewardCategory) {
  return rewards.filter(reward => !reward.archived && (category === "all" || rewardPresentation(reward).category === category))
    .sort((a, b) => Number(b.id.startsWith("starter-reward:")) - Number(a.id.startsWith("starter-reward:")))
    .slice(0, 6);
}

export default function LobbyRewardsWidget({ state, onNavigate, onRedeem, actionsDisabled }: LobbyRewardsWidgetProps) {
  const [category, setCategory] = useState<RewardCategory>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rewards = (state.realLifeRewards ?? []).filter(reward => !reward.archived);
  const visible = filterLobbyRewards(rewards, category);
  const selected = rewards.find(reward => reward.id === selectedId);
  return <MechVectorFrame className="vref-rewards" code="07-G" accent="magenta" aria-labelledby="lobby-rewards-title">
    <div className="vref-heading"><h2 id="lobby-rewards-title"><CyberTechButton preserveChildren className="vref-heading-link cursor-pointer origin-left transition-all hover:scale-105 hover:text-cyan-400" onClick={() => onNavigate("rewards")}><Gift size={24} strokeWidth={2.1} aria-hidden="true"/>Phần thưởng</CyberTechButton></h2><CyberTechButton preserveChildren variant="amber" className="vref-reward-gold" onClick={() => onNavigate("rewards")} aria-label="Mở phần thưởng và số dư Vàng"><CircleDollarSign size={16} aria-hidden="true"/>{state.gold.toLocaleString("vi-VN")} G</CyberTechButton></div>
    <div className="vref-reward-tabs" role="tablist" aria-label="Lọc phần thưởng">
      {tabs.map(tab => <CyberTechButton preserveChildren key={tab.id} role="tab" aria-selected={category === tab.id} className={category === tab.id ? "active" : ""} onClick={() => setCategory(tab.id)}>{tab.label}</CyberTechButton>)}
    </div>
    <div className={`vref-reward-grid${category === "all" ? " vref-reward-grid--all" : ""}`} role="tabpanel">
      {visible.map(reward => {
        const presentation = rewardPresentation(reward);
        const affordable = state.gold >= reward.cost;
        const useReferenceCrop = category === "all" && reward.id.startsWith("starter-reward:");
        return <button key={reward.id} type="button" onClick={() => setSelectedId(reward.id)}
          aria-label={`Xem ${reward.name}, ${reward.cost.toLocaleString("vi-VN")} Gold. ${affordable ? "Có thể đổi" : "Chưa đủ Gold"}`} title={reward.description || reward.name}>
          <picture>
            {useReferenceCrop && <source media={referenceThumbnailMedia} srcSet={`/assets/lobby-reference/${presentation.thumbnailSrc}`}/>}
            <Image className={useReferenceCrop ? "vref-reward-art-crop" : undefined} src={`/assets/lobby-reference/${presentation.src}`} alt="" fill sizes="(max-width: 1450px) 150px, 190px"/>
          </picture>
          <span><strong>{reward.name}</strong><small><CircleDollarSign size={12} aria-hidden="true"/>{reward.cost.toLocaleString("vi-VN")} G{reward.redemptions ? ` · Đã nhận ${reward.redemptions}` : ""}</small><ArrowRight size={15} aria-hidden="true"/></span>
        </button>;
      })}
      {!visible.length && <div className="vref-reward-empty">
        <Gift size={27} aria-hidden="true"/><p>{rewards.length ? "Danh mục này chưa có phần thưởng." : "Chưa có phần thưởng trong kho của bạn."}</p>
        <CyberTechButton preserveChildren onClick={() => onNavigate("rewards")}>Tạo phần thưởng <ArrowRight size={15} aria-hidden="true"/></CyberTechButton>
      </div>}
    </div>
    {selected && typeof document !== "undefined" && createPortal(<div className="vref-reward-modal-backdrop" onClick={() => setSelectedId(null)}>
      <div className="vref-reward-modal" role="dialog" aria-modal="true" aria-labelledby="lobby-reward-detail-title" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.code === "Escape") setSelectedId(null); }}>
        <button className="vref-reward-modal-close" type="button" autoFocus onClick={() => setSelectedId(null)} aria-label="Đóng chi tiết phần thưởng">×</button>
        <div className="vref-reward-modal-image"><Image src={`/assets/lobby-reference/${rewardPresentation(selected).src}`} alt="" fill sizes="240px"/></div>
        <div className="vref-reward-modal-copy"><small>PHẦN THƯỞNG</small><h3 id="lobby-reward-detail-title">{selected.name}</h3><p>{selected.description || "Phần thưởng cho hành trình của bạn."}</p><strong><CircleDollarSign size={17} aria-hidden="true"/>{selected.cost.toLocaleString("vi-VN")} G</strong><span>Số dư: {state.gold.toLocaleString("vi-VN")} G</span>
          <div className="vref-reward-modal-actions"><button type="button" onClick={() => { setSelectedId(null); onNavigate("rewards"); }}>Mở cửa hàng</button><button type="button" disabled={actionsDisabled || state.gold < selected.cost} onClick={() => { setSelectedId(null); onRedeem(selected.id); }}>Đổi phần thưởng</button></div>
        </div>
      </div>
    </div>, document.body)}
  </MechVectorFrame>;
}
