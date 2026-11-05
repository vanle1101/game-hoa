"use client";
import * as React from "react";
import "./reference-frame.css";

/**
 * Adaptable variant for OTHER ROUTES. Source 9-slice comes from today.png.
 * This is not pixel-identical to the one screenshot at arbitrary dimensions.
 * Preserve circular reactor proportions by never scaling an entire full-frame
 * sprite non-uniformly; instead use CSS border-image corner slices.
 *
 * Usage:
 * <section style={{position:'relative'}}>...
 *   <FluidMechanicalFrame />
 * </section>
 */
export function FluidMechanicalFrame({
 assetBase = "/lifelevel-frames", animated = true,
}: { assetBase?:string; animated?:boolean }) {
 const host = React.useRef<HTMLDivElement>(null);
 const [bounds,setBounds] = React.useState({w:632,h:321});
 React.useEffect(() => {
  const parent=host.current?.parentElement;
  if(!parent) return;
  const update = () => {
   const r=parent.getBoundingClientRect();
   if(r.width>0 && r.height>0){setBounds({w:Math.round(r.width),h:Math.round(r.height)});}
  };
  update();
  const ro=new ResizeObserver(update);ro.observe(parent);
  return () => ro.disconnect();
 },[]);
 const {w,h}=bounds;
 const ledPath = `M 74 19 H ${Math.max(75,w-55)} L ${Math.max(80,w-18)} 52 V ${Math.max(53,h-49)} L ${Math.max(70,w-53)} ${Math.max(45,h-18)} H 50 L 20 ${Math.max(45,h-50)} V 53 Z`;
 return (
  <div ref={host} className="lifelevel-frame-overlay lifelevel-fluid-overlay" aria-hidden="true">
   <div className="lifelevel-nine-slice" style={{
    borderImageSource:`url(${assetBase.replace(/\/$/,"")}/today.png)`,
   }}/>
   <svg className="lifelevel-frame-paths" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
    <path d={ledPath} pathLength={1000} className="lifelevel-track-soft" />
    {animated&&<>
     <path d={ledPath} pathLength={1000} className="lifelevel-led-glow lifelevel-nine-slice-anim" />
     <path d={ledPath} pathLength={1000} className="lifelevel-led-core lifelevel-nine-slice-anim" />
    </>}
   </svg>
  </div>
 );
}
