export const WORLD_VIEWS = [
  ['north','Bắc'],['northeast','Đông Bắc'],['east','Đông'],['southeast','Đông Nam'],
  ['south','Nam'],['southwest','Tây Nam'],['west','Tây'],['northwest','Tây Bắc'],
  ['sky','Bầu trời'],['street','Đường phố'],['tower','Chung cư'],['facade','Mặt dựng'],
  ['corridor','Hành lang'],['window','Qua cửa kính'],['apartment','Toàn căn hộ'],
] as const;
export type WorldView = typeof WORLD_VIEWS[number][0];
export function worldViewPose(view:WorldView, ground:number){
  let position:[number,number,number]=[0,5,-8],target:[number,number,number]=[0,5,-100];
  const directions=['north','northeast','east','southeast','south','southwest','west','northwest'];
  const i=directions.indexOf(view);
  if(i>=0){const a=i*Math.PI/4;position=[Math.sin(a)*18,5,-Math.cos(a)*18];target=[Math.sin(a)*120,7,-Math.cos(a)*120];}
  if(view==='sky'){position=[0,5,-12];target=[0,70,-40];}
  if(view==='street'){position=[18,ground+2,30];target=[0,ground+5,7];}
  if(view==='tower'){position=[48,22,64];target=[0,18,2];}
  if(view==='facade'){position=[19,-7,24];target=[0,-6,3];}
  if(view==='corridor'){position=[0,1.65,5.35];target=[0,1.65,8.5];}
  if(view==='window'){position=[0,1.7,-4.1];target=[22,1,-100];}
  if(view==='apartment'){position=[13,12,16];target=[0,.5,0];}
  return {position,target};
}
