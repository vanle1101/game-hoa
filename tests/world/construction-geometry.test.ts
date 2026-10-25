import { describe, expect, it } from "vitest";
import { wallParts, nearestEdge, wallKey } from "../../src/components/construction/render-geometry";
import type { WallSegment } from "../../src/construction/types";
const wall:WallSegment={x:0,z:0,level:0,orientation:"x",materialId:"wall-basic"};
const intersects=(part:ReturnType<typeof wallParts>[number],x:number,y:number)=>Math.abs(part.x-x)<part.width/2&&Math.abs(part.y-y)<part.height/2;
describe("construction wall geometry",()=>{
  it("solid wall spans one cell and full catalog height",()=>{expect(wallParts(wall)).toEqual([{x:0,y:1.4,width:1,height:2.8,depth:.12}]);});
  it("door has a real empty opening with solid sides and lintel",()=>{const parts=wallParts({...wall,opening:{kind:"door",catalogId:"door-standard"}});expect(parts).toHaveLength(3);for(const height of [.1,1,2.1])expect(parts.some(part=>intersects(part,0,height))).toBe(false);expect(parts.some(part=>intersects(part,0,2.5))).toBe(true);expect(parts.some(part=>intersects(part,.48,1))).toBe(true);});
  it("window has a real opening with sill and lintel",()=>{const parts=wallParts({...wall,opening:{kind:"window",catalogId:"window-small"}});expect(parts).toHaveLength(4);expect(parts.some(part=>intersects(part,0,1.5))).toBe(false);expect(parts.some(part=>intersects(part,0,.5))).toBe(true);expect(parts.some(part=>intersects(part,0,2.6))).toBe(true);});
  it("removing an opening restores original solid geometry",()=>{const before=wallParts(wall);const edited={...wall,opening:{kind:"door" as const,catalogId:"door-standard"}};delete (edited as WallSegment).opening;expect(wallParts(edited)).toEqual(before);});
  it("snaps nearest wall edge and retains negative coordinates/floor",()=>{expect(nearestEdge({x:-1.95,z:2.4},1)).toEqual({x:-2,z:2,level:1,orientation:"z"});expect(nearestEdge({x:1.4,z:2.02},0)).toEqual({x:1,z:2,level:0,orientation:"x"});expect(wallKey(wall)).toBe("0:x:0:0");});
  it("wall parts have no overlap inside a door opening at any sample",()=>{const parts=wallParts({...wall,opening:{kind:"door",catalogId:"door-auto"}});for(let x=-.4;x<=.4;x+=.1)for(let y=.1;y<2.3;y+=.2)expect(parts.some(part=>intersects(part,x,y))).toBe(false);expect(parts.every(part=>part.width>0&&part.height>0)).toBe(true);});
});
