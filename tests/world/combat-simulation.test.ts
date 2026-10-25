import {describe,it,expect} from "vitest";
import {sampleCombat} from "@/components/combat/simulation";
describe("visual combat has no progression authority",()=>{
 it("simulates ten minutes with only presentation outputs",()=>{const fields=["phase","motion","playerX","playerZ","bossLean","weaponArc","impact","cycle"];const phases=new Set();for(let t=0;t<600;t+=.1){const pose=sampleCombat(t);expect(Object.keys(pose).sort()).toEqual([...fields].sort());expect(Number.isFinite(pose.playerX)).toBe(true);phases.add(pose.phase);}expect(phases.has("BOSS_ATTACK")).toBe(true);expect(phases.has("DODGE")).toBe(true);expect(phases.has("ATTACK_LOOP")).toBe(true);});
 it("pauses and respects reduced motion without moving fighters",()=>{expect(sampleCombat(11,{paused:true}).phase).toBe("PAUSED");expect(sampleCombat(22,{reducedMotion:true})).toMatchObject({playerX:-2.5,playerZ:1.5,weaponArc:0,impact:0});});
 it("uses an externally supplied progress signal without determining damage",()=>{expect(sampleCombat(5,{progressAge:1}).phase).toBe("PROGRESS_EVENT");expect(sampleCombat(5,{defeated:true}).phase).toBe("VICTORY");expect(sampleCombat(5,{phaseAge:.4}).phase).toBe("PHASE_TRANSITION");});
});
