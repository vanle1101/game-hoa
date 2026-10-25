import type { CityLayer, Instance } from '../ApartmentCity';
import { DISTRICT_GROUND_Y as G, DISTRICT_ROADS, DISTRICT_LOTS, WATERFRONT, NORTH_HARBOR } from './district-layout';

function box(target: Instance[], x:number,y:number,z:number,w:number,h:number,d:number,color:string,rotation=0){
  target.push({position:[x,y,z],scale:[w,h,d],color,rotation});
}

/** Low-impact repeating infrastructure stays instanced; buildings use surveyed lots. */
export function addDistrictStreets(layer: CityLayer) {
  const { structure:s, lights:l, cylinders:c } = layer;
  // The north harbor is a real break in the western ground slab. Its far bank
  // carries the landmark row; the near bank leaves a broad waterfront outlook.
  const harborSouth = NORTH_HARBOR.z + NORTH_HARBOR.depth / 2;
  const harborNorth = NORTH_HARBOR.z - NORTH_HARBOR.depth / 2;
  box(s,-145,G-1.2,(harborSouth+340)/2,400,2,340-harborSouth,'#192332');
  box(s,-145,G-1.2,(-620+harborNorth)/2,400,2,harborNorth+620,'#192332');
  box(s,245,G-1.2,-140,320,2,960,'#192332');
  for(const x of DISTRICT_ROADS.northSouth){
    // Roads terminate at the quay and resume beyond the water. The old
    // continuous road slabs, sidewalks and dashed lanes crossed the harbor
    // at water level, turning the river into a rectangular street grid.
    const spans = x < WATERFRONT.x-WATERFRONT.width/2
      ? [[(harborSouth+310)/2,310-harborSouth],[(-310+harborNorth)/2,harborNorth+310]]
      : [[0,620]];
    for(const [centerZ,length] of spans){
      box(s,x,G-.11,centerZ,8,.12,length,'#111923');
      for(const side of [-1,1]) box(s,x+side*4.8,G+.05,centerZ,1.6,.25,length,'#535c64');
    }
    for(const side of [-1,1]){
      for(let z=-270;z<290;z+=24){
        if(x<WATERFRONT.x-WATERFRONT.width/2 && z>harborNorth && z<harborSouth)continue;
        box(c,x+side*5.3,G+3.2,z,.12,6.4,.12,'#62717e');
        box(s,x+side*4.8,G+6.3,z,1.1,.1,.18,'#81929a');
        box(l,x+side*4.65,G+6.23,z,.8,.04,.13,'#f8d39b');
      }
    }
    for(let z=-290;z<300;z+=8){
      if(x<WATERFRONT.x-WATERFRONT.width/2 && z>harborNorth && z<harborSouth)continue;
      box(s,x,G-.035,z,.12,.015,3,'#88949a');
    }
  }
  for(const z of DISTRICT_ROADS.eastWest){
    const westBank = z<harborNorth || z>harborSouth;
    if(westBank)box(s,-141,G-.09,z,386,.12,8,'#111923');
    box(s,245,G-.09,z,320,.12,8,'#111923');
    for(const side of [-1,1]){
      if(westBank)box(s,-141,G+.05,z+side*4.8,386,.25,1.6,'#535c64');
      box(s,245,G+.05,z+side*4.8,320,.25,1.6,'#535c64');
      for(let x=-260;x<290;x+=24){
        if((!westBank&&x<WATERFRONT.x-WATERFRONT.width/2)||(x>52&&x<88))continue;
        box(c,x,G+3.2,z+side*5.3,.12,6.4,.12,'#62717e');
        box(l,x,G+6.3,z+side*4.8,.18,.05,1,'#f8d39b');
      }
    }
    for(let x=-270;x<300;x+=8){
      if((!westBank&&x<WATERFRONT.x-WATERFRONT.width/2)||(x>52&&x<88))continue;
      box(s,x,G-.025,z,3,.015,.12,'#88949a');
    }
    for(const x of DISTRICT_ROADS.northSouth){
      if(!westBank&&x<WATERFRONT.x-WATERFRONT.width/2)continue;
      for(let stripe=-3;stripe<=3;stripe++){
        box(s,x+stripe,G+.003,z+6,.48,.015,2.4,'#c6c8ba');
        box(s,x+stripe,G+.003,z-6,.48,.015,2.4,'#c6c8ba');
      }
    }
  }
  // Canal retaining walls, promenades, railings and mooring lights.
  for(const x of [WATERFRONT.x-WATERFRONT.width/2,WATERFRONT.x+WATERFRONT.width/2]){
    // The western quay opens into the harbor instead of walling off the water.
    const spans = x < WATERFRONT.x
      ? [[(-320+harborNorth)/2,harborNorth+320],[(harborSouth+320)/2,320-harborSouth]]
      : [[0,640]];
    for(const [centerZ,length] of spans){
      box(s,x,G-1,centerZ,1.2,5.5,length,'#647383');
      box(s,x+(x<70?-1.7:1.7),G+.1,centerZ,2.4,.3,length,'#849098');
      box(s,x,G+1.05,centerZ,.07,.07,length,'#a3b5bf');
    }
    for(let z=-280;z<=280;z+=12){
      if(x<WATERFRONT.x&&z>harborNorth&&z<harborSouth)continue;
      box(s,x,G+.6,z,.08,1.2,.08,'#81949c');
      box(l,x,G+.2,z,.14,.2,.5,'#62a9c3');
    }
  }
  // Continuous lit quays provide a legible water edge from the apartment.
  for(const z of [harborSouth,harborNorth]){
    box(s,NORTH_HARBOR.x,G-.45,z,NORTH_HARBOR.width,1.5,1.4,'#647383');
    box(s,NORTH_HARBOR.x,G+.18,z+(z<0?.9:-.9),NORTH_HARBOR.width,.24,2.1,'#85949c');
    box(l,NORTH_HARBOR.x,G+.36,z,NORTH_HARBOR.width,.045,.16,z===harborSouth?'#d39b8c':'#8cb9e9');
  }
  // Three existing north/south streets become bridges across the harbor.
  for(const x of DISTRICT_ROADS.northSouth.filter(x=>x<WATERFRONT.x-WATERFRONT.width/2 && x!==-76)){
    box(s,x,G-.6,NORTH_HARBOR.z,9.8,1,NORTH_HARBOR.depth+2,'#51616e');
    box(s,x,G+.05,NORTH_HARBOR.z,8,.16,NORTH_HARBOR.depth+2,'#1a2633');
    for(const side of [-1,1]){
      box(s,x+side*4.35,G+1.05,NORTH_HARBOR.z,.16,1.8,NORTH_HARBOR.depth+2,'#788c99');
      box(l,x+side*4.35,G+2.0,NORTH_HARBOR.z,.08,.08,NORTH_HARBOR.depth+2,'#73c9d9');
    }
  }
  // Two actual bridges: deck, parapets, pylons and individually pitched stay cables.
  for(const z of [-60,84]){
    box(s,70,G+.55,z,34,1.2,9,'#536676');
    box(s,70,G+1.2,z,34,.08,7,'#192531');
    for(const side of [-1,1]){
      box(s,70,G+1.8,z+side*4.2,34,1.1,.2,'#7e929d');
      box(l,70,G+2.4,z+side*4.2,34,.08,.08,'#80d4dc');
      for(const x of [57,83]){
        box(s,x,G+9,z+side*4.2,.65,18,.6,'#7894a4');
        for(const dx of [-8,-4,4,8]){
          const height=15; const length=Math.hypot(dx,height);
          layer.structure.push({position:[x+dx/2,G+2+height/2,z+side*4.2],scale:[.075,length,.075],color:'#b4cbd0',rotation:[0,0,-Math.atan2(dx,height)]});
        }
      }
    }
  }
  // Deliberate forecourt planting beds and park paths protect the panorama opening.
  for(const [x,z] of [[-25,-27],[-25,-47],[23,-30],[23,-46],[-27,12],[24,12]]){
    box(s,x,G+.25,z,7,.6,9,'#5a625e');
    box(s,x,G+.6,z,6.5,.15,8.5,'#273f39');
    for(const dz of [-2,2]){
      box(c,x,G+2.1,z+dz,.24,3.2,.24,'#695a47');
      box(c,x,G+4.2,z+dz,3.4,3,3.4,'#2f5c4c');
    }
  }
  // Landmark crown beacons identify individual skyline silhouettes. Street-level
  // windows stay warm; only three surveyed corporate landmarks carry tall neon.
  for(const name of ['Halo Spire','Dawn Tower','Prism Crown','Aurora Needle','Neon Haven Crown','Opal Spire']){
    const lot=DISTRICT_LOTS.find(l=>l.name===name)!;
    const accent=name==='Halo Spire'||name==='Aurora Needle'?'#b05bfa':name==='Dawn Tower'||name==='Opal Spire'?'#56cbdc':'#dd7cc1';
    const top=G+lot.height;
    box(c,lot.x,top+4.5,lot.z,.3,9,.3,'#8698aa');
    box(l,lot.x,top+4.5,lot.z,.12,9,.12,accent);
    for(const side of [-1,1]){
      box(c,lot.x+side*2.7,top+1.7,lot.z,.16,3.4,.16,'#8b9eac');
      box(l,lot.x+side*2.7,top+3.4,lot.z,.23,.18,.23,accent);
    }
  }
}
