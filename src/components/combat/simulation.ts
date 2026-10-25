/** Presentation clock only. This module never accepts or returns authoritative game state. */
export type CombatPhase="IDLE"|"APPROACH"|"ATTACK_LOOP"|"DODGE"|"BLOCK"|"BOSS_ATTACK"|"PROGRESS_EVENT"|"DAMAGE_REACTION"|"PHASE_TRANSITION"|"BOSS_DEFEATED"|"VICTORY"|"PAUSED";
export type CombatPose={phase:CombatPhase;motion:"idle"|"walk"|"attack"|"heavy"|"dodge"|"block"|"victory";playerX:number;playerZ:number;bossLean:number;weaponArc:number;impact:number;cycle:number};
const beats:[CombatPhase,CombatPose["motion"],number][]=[["IDLE","idle",1.7],["APPROACH","walk",1.2],["ATTACK_LOOP","attack",1.1],["DODGE","dodge",.8],["BOSS_ATTACK","block",1.2],["BLOCK","block",.7],["ATTACK_LOOP","heavy",1.4],["DAMAGE_REACTION","idle",.8],["IDLE","idle",1.8]];
const duration=beats.reduce((sum,beat)=>sum+beat[2],0);
export function sampleCombat(seconds:number,options:{paused?:boolean;reducedMotion?:boolean;defeated?:boolean;progressAge?:number;phaseAge?:number}={}):CombatPose{
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0);const cycle=Math.floor(t/duration);let remainder=t%duration;
 let phase:CombatPhase="IDLE",motion:CombatPose["motion"]="idle",fraction=0;
 for(const beat of beats){if(remainder<beat[2]){phase=beat[0];motion=beat[1];fraction=remainder/beat[2];break;}remainder-=beat[2];}
 if(options.paused){phase="PAUSED";motion="idle";}else if(options.defeated){phase="VICTORY";motion="victory";}else if(options.progressAge!==undefined&&options.progressAge>=0&&options.progressAge<2.2){phase="PROGRESS_EVENT";motion="heavy";fraction=options.progressAge/2.2;}else if(options.phaseAge!==undefined&&options.phaseAge>=0&&options.phaseAge<1.5){phase="PHASE_TRANSITION";motion="block";}
 if(options.reducedMotion||options.paused)return {phase,motion:"idle",playerX:-2.5,playerZ:1.5,bossLean:0,weaponArc:0,impact:0,cycle};
 const attacking=motion==="attack"||motion==="heavy";const wave=Math.sin(fraction*Math.PI);
 return {phase,motion,playerX:-2.5+(motion==="walk"?fraction*.65:attacking?.65:0),playerZ:1.5+(motion==="dodge"?wave*.6:0),bossLean:phase==="DAMAGE_REACTION"||phase==="PROGRESS_EVENT"?wave*.08:phase==="BOSS_ATTACK"?-wave*.12:0,weaponArc:attacking?Math.sin(fraction*Math.PI*2)*1.4:0,impact:attacking?Math.max(0,1-Math.abs(fraction-.53)*9):0,cycle};
}
