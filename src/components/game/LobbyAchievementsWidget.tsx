"use client";

import { CheckCircle2, LockKeyhole, Trophy } from "lucide-react";
import type { GameState } from "@/domain/types";
import MechVectorFrame from "./MechVectorFrame";
import CyberTechButton from "./CyberTechButton";

type Achievement = { id: string; name: string; description: string };

export default function LobbyAchievementsWidget({ state, achievements, onNavigate }: {
  state: GameState;
  achievements: readonly Achievement[];
  onNavigate: (screen: string) => void;
}) {
  const earned = new Set(state.achievements);
  const earnedCount = achievements.filter(item => earned.has(item.id)).length;
  const next = achievements.find(item => !earned.has(item.id));
  const recent = [...state.achievements].reverse().map(id => achievements.find(item => item.id === id)).find(item => item !== undefined);
  const visibleAchievements = achievements.slice(0, 3);

  return <MechVectorFrame className="vref-finance vref-achievements" code="06-F" accent="magenta" aria-labelledby="lobby-achievements-title">
    <div className="vref-heading"><h2 id="lobby-achievements-title"><CyberTechButton preserveChildren className="vref-heading-link cursor-pointer origin-left transition-all hover:scale-105 hover:text-cyan-400" onClick={() => onNavigate("achievements")}><Trophy size={20} aria-hidden="true"/>Thành tựu</CyberTechButton></h2><span className="vref-achievement-count">{earnedCount}/{achievements.length}</span></div>
    <div className="vref-achievement-showcase">
      {visibleAchievements.map((item, index) => {
        const complete = earned.has(item.id);
        const Icon = complete ? CheckCircle2 : index === 0 ? Trophy : LockKeyhole;
        return <CyberTechButton preserveChildren className="vref-achievement-showcase-row" key={item.id} onClick={() => onNavigate("achievements")} aria-label={`${item.name}: ${complete ? "đã đạt" : "chưa đạt"}. Mở thành tựu`}>
          <Icon size={17} aria-hidden="true"/><span>{item.name}</span><small>{complete ? "100%" : "0%"} hoàn thành</small>
        </CyberTechButton>;
      })}
    </div>
    <CyberTechButton preserveChildren className="vref-achievement-summary" onClick={() => onNavigate("achievements")}><strong>{earnedCount} huy hiệu đã đạt</strong><span>{Math.round(earnedCount / Math.max(1, achievements.length) * 100)}% hành trình</span></CyberTechButton>
    <CyberTechButton preserveChildren className="vref-achievement-meter" onClick={() => onNavigate("achievements")} aria-label={`Xem tiến độ thành tựu: ${earnedCount} trên ${achievements.length}`}><span className="vref-meter"><i style={{ width: `${earnedCount / Math.max(1, achievements.length) * 100}%` }} /></span></CyberTechButton>
    <div className="vref-achievement-list">
      {recent && <CyberTechButton preserveChildren className="vref-achievement-row" onClick={() => onNavigate("achievements")}><CheckCircle2 size={15} aria-hidden="true"/><span><strong>Mới đạt: {recent.name}</strong><small>{recent.description}</small></span></CyberTechButton>}
      {next ? <CyberTechButton preserveChildren className="vref-achievement-row" onClick={() => onNavigate("achievements")}><LockKeyhole size={15} aria-hidden="true"/><span><strong>Tiếp theo: {next.name}</strong><small>{next.description}</small></span></CyberTechButton> : <CyberTechButton preserveChildren className="vref-achievement-row" onClick={() => onNavigate("achievements")}><Trophy size={15} aria-hidden="true"/><span><strong>Đã mở toàn bộ thành tựu</strong></span></CyberTechButton>}
    </div>
  </MechVectorFrame>;
}
