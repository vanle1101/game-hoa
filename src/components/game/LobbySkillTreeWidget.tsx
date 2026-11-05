"use client";

import { Activity, Brain, Check, Cpu, Network, Sparkles, Users } from "lucide-react";
import { SKILL_NODES } from "@/domain/catalog";
import type { GameState, Skill } from "@/domain/types";
import MechVectorFrame from "./MechVectorFrame";
import CyberTechButton from "./CyberTechButton";

const branches = [
  { skill: "health", label: "Thể chất", icon: Activity, tone: "pink" },
  { skill: "knowledge", label: "Trí tuệ", icon: Brain, tone: "cyan" },
  { skill: "relationships", label: "Giao tiếp", icon: Users, tone: "violet" },
  { skill: "career", label: "Kỹ thuật", icon: Cpu, tone: "amber" },
] as const satisfies readonly { skill: Skill; label: string; icon: typeof Activity; tone: string }[];

// The reference dashboard shows all six real skill families in its compact map.
// Keep the four learning-progress rows below it unchanged.
const mapBranches = [
  { skill: "health", label: "Thể chất", icon: Activity, tone: "pink" },
  { skill: "knowledge", label: "Trí tuệ", icon: Brain, tone: "cyan" },
  { skill: "career", label: "Kỹ thuật", icon: Cpu, tone: "amber" },
  { skill: "finance", label: "Tài chính", icon: Sparkles, tone: "amber" },
  { skill: "relationships", label: "Xã hội", icon: Users, tone: "violet" },
  { skill: "creativity", label: "Sáng tạo", icon: Sparkles, tone: "cyan" },
] as const satisfies readonly { skill: Skill; label: string; icon: typeof Activity; tone: string }[];

export function skillTreePreview(state: GameState) {
  const owned = new Set(state.character.skillNodes);
  const ready = SKILL_NODES.filter(node => !owned.has(node.id)
    && state.character.skillXp[node.skill] >= node.requiredXp
    && (!node.prerequisite || owned.has(node.prerequisite)));
  const branchProgress = branches.map(branch => {
    const nodes = SKILL_NODES.filter(node => node.skill === branch.skill);
    const next = nodes.find(node => !owned.has(node.id));
    const xp = state.character.skillXp[branch.skill];
    return {
      ...branch,
      xp,
      target: next?.requiredXp ?? nodes.at(-1)?.requiredXp ?? 1,
      percent: next ? Math.min(100, Math.round(xp / next.requiredXp * 100)) : 100,
      unlocked: nodes.filter(node => owned.has(node.id)).length,
      total: nodes.length,
    };
  });
  const recent = state.character.skillNodes.slice(-2).reverse()
    .flatMap(id => { const node = SKILL_NODES.find(item => item.id === id); return node ? [node] : []; });
  return { ready: ready.length, unlocked: owned.size, total: SKILL_NODES.length, branches: branchProgress, recent };
}

export default function LobbySkillTreeWidget({ state, level, onNavigate }: {
  state: GameState;
  level: number;
  onNavigate: (screen: string) => void;
}) {
  const preview = skillTreePreview(state);
  const unlockedNodes = new Set(state.character.skillNodes);
  return <MechVectorFrame className="vref-skill-preview" code="04-D" aria-labelledby="lobby-skill-title">
    <header className="vref-skill-header">
      <div className="vref-heading"><h2 id="lobby-skill-title"><CyberTechButton preserveChildren className="vref-heading-link cursor-pointer origin-left transition-all hover:scale-105 hover:text-cyan-400" onClick={() => onNavigate("skills")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/><path d="M12 6v8M4 18v-4h16v4"/></svg>Cây kỹ năng</CyberTechButton></h2></div>
      <CyberTechButton preserveChildren className="vref-skill-level" onClick={() => onNavigate("skills")}>Cấp {level}</CyberTechButton>
    </header>
    <CyberTechButton preserveChildren className="vref-skill-intro" onClick={() => onNavigate("skills")}>Tăng XP qua nhiệm vụ để mở từng nhánh tiềm năng.</CyberTechButton>
    <div className="vref-skill-totals">
      <CyberTechButton preserveChildren onClick={() => onNavigate("skills")}><strong>{preview.unlocked}<small>/{preview.total}</small></strong>Kỹ năng đã mở</CyberTechButton>
      <CyberTechButton preserveChildren variant="magenta" onClick={() => onNavigate("skills")}><strong>{preview.ready}</strong>Nâng cấp sẵn sàng</CyberTechButton>
    </div>
    <div className="vref-skill-content">
      <div className="vref-skill-map" aria-label="Bốn nhánh kỹ năng">
        <span className="vref-skill-line horizontal"/><span className="vref-skill-line vertical"/>
        <button className="vref-skill-core" type="button" onClick={() => onNavigate("skills")} aria-label="Mở Cây kỹ năng"><Network size={28} aria-hidden="true"/><small>{preview.unlocked}/{preview.total}</small></button>
        {mapBranches.map((branch, index) => {
          const Icon = branch.icon;
          const next = SKILL_NODES.find(node => node.skill === branch.skill && !unlockedNodes.has(node.id));
          const percent = next ? Math.min(100, Math.round(state.character.skillXp[branch.skill] / next.requiredXp * 100)) : 100;
          return <button key={branch.skill} className={`vref-skill-node node-${index} ${branch.tone}`} type="button" onClick={() => onNavigate("skills")} aria-label={`${branch.label}: ${percent}% tiến độ, ${state.character.skillXp[branch.skill]} XP`}>
            <Icon size={17} aria-hidden="true"/><span>{branch.label}</span>
          </button>;
        })}
      </div>
      <div className="vref-skill-branches">
        <h3>Nhánh đang học</h3>
        {preview.branches.map(branch => { const Icon = branch.icon; return <CyberTechButton preserveChildren className={`vref-skill-branch ${branch.tone}`} onClick={() => onNavigate("skills")} key={branch.skill}>
          <span className="vref-skill-branch-row">
            <span className="vref-skill-branch-label"><Icon size={12} aria-hidden="true"/><strong>{branch.label}</strong></span>
            <span className="vref-skill-branch-meter h-2.5 rounded-full" role="progressbar" aria-label={`Tiến độ ${branch.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={branch.percent}><span className="block h-full rounded-full" style={{ width: `${branch.percent}%` }}/></span>
            <span className="vref-skill-branch-percent">{branch.percent}%</span>
          </span>
          <small>{branch.unlocked}/{branch.total} đã mở · {branch.xp}/{branch.target} XP</small>
        </CyberTechButton>; })}
      </div>
    </div>
    <CyberTechButton preserveChildren className="vref-skill-recent" onClick={() => onNavigate("skills")}>
      <span><Sparkles size={14} aria-hidden="true"/> Mở khóa gần nhất</span>
      <span className="vref-skill-recent-items">{preview.recent.length ? preview.recent.map(node => <span key={node.id}><Check size={14} aria-hidden="true"/>{node.name}</span>) : <small>Chưa mở kỹ năng nào. Hoàn thành nhiệm vụ để tích lũy XP.</small>}</span>
    </CyberTechButton>
  </MechVectorFrame>;
}
