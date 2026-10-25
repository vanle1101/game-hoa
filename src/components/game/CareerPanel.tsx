import { ArrowRight, ArrowUpRight, BookOpen, Calculator, Check, Code2, Palette, UsersRound, type LucideIcon } from "lucide-react";
import { CAREERS } from "@/domain/catalog";
import type { Action, Character } from "@/domain/types";
import "./career-panel.css";

type CareerSkill = (typeof CAREERS)[number]["skill"];
type CareerPanelProps = {
  character: Character;
  act: (action: Action) => void;
  busy?: boolean;
};

const skillPresentation: Record<CareerSkill, { name: string; Icon: LucideIcon }> = {
  career: { name: "Sự nghiệp", Icon: Code2 },
  finance: { name: "Tài chính", Icon: Calculator },
  knowledge: { name: "Tri thức", Icon: BookOpen },
  relationships: { name: "Kết nối", Icon: UsersRound },
  creativity: { name: "Sáng tạo", Icon: Palette },
};

export default function CareerPanel({ character, act, busy = false }: CareerPanelProps) {
  const current = CAREERS.find(career => career.id === character.career);
  const currentSkill = current ? skillPresentation[current.skill] : undefined;
  const CurrentIcon = currentSkill?.Icon ?? ArrowUpRight;

  return (
    <div className="career-panel">
      <section className="career-current" aria-labelledby="career-current-title">
        <div className="career-current-main">
          <span className="career-kicker">CON ĐƯỜNG CỦA BẠN</span>
          <div className="career-current-identity">
            <span className="career-emblem"><CurrentIcon size={32} aria-hidden="true" /></span>
            <div>
              <span className="career-current-label">{current ? "Nghề nghiệp hiện tại" : "Khởi đầu hành trình"}</span>
              <h2 id="career-current-title">{current?.name ?? "Chọn con đường của bạn"}</h2>
            </div>
          </div>
          <p>Phát triển nghề nghiệp từ kỹ năng và công việc thực tế.</p>
          {current && currentSkill && (
            <div className="career-current-skill">
              <span>Nhánh kỹ năng: <strong>{currentSkill.name}</strong></span>
              <span><strong>{character.skillXp[current.skill].toLocaleString("vi-VN")}</strong> XP kỹ năng</span>
            </div>
          )}
        </div>
        <div className="career-rank" aria-label={`Hạng nghề nghiệp ${character.careerRank}`}>
          <span>HẠNG HIỆN TẠI</span>
          <strong>{character.careerRank}</strong>
          <span>NGHỀ NGHIỆP</span>
        </div>
        <div className="career-current-footer">
          <p>Mỗi nhiệm vụ hoàn thành là một bước tiến trên con đường bạn chọn.</p>
          <button type="button" className="career-button career-promote" disabled={busy} onClick={() => act({ type: "career.promote" })}>
            Xét thăng hạng <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="career-paths" aria-labelledby="career-paths-title">
        <header className="career-paths-heading">
          <div>
            <span className="career-kicker">ĐỊNH HƯỚNG PHÁT TRIỂN</span>
            <h2 id="career-paths-title">Chọn con đường của bạn</h2>
          </div>
          <p>Mỗi nghề nghiệp gắn với một nhánh kỹ năng.</p>
        </header>
        <div className="career-grid">
          {CAREERS.map(career => {
            const selected = character.career === career.id;
            const { name, Icon } = skillPresentation[career.skill];
            return (
              <article className="career-card" data-skill={career.skill} data-selected={selected} aria-labelledby={`career-${career.id}-title`} key={career.id}>
                <div className="career-card-top">
                  <span className="career-card-icon"><Icon size={26} aria-hidden="true" /></span>
                  {selected && <span className="career-selected"><Check size={13} aria-hidden="true" />Hiện tại</span>}
                </div>
                <h3 id={`career-${career.id}-title`}>{career.name}</h3>
                <p id={`career-${career.id}-skill`}>Nhánh kỹ năng: <span>{name}</span></p>
                <button type="button" className="career-button career-select" disabled={busy || selected} aria-describedby={`career-${career.id}-title career-${career.id}-skill`} onClick={() => act({ type: "career.select", careerId: career.id })}>
                  {selected ? "Đang theo đuổi" : "Chọn nghề nghiệp"}
                  {selected ? <Check size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
