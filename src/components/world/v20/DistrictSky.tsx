"use client";

import * as THREE from 'three';

export type SkyPreset = 'night' | 'sunset' | 'day';
export const SKY_PRESETS = {
  // Matches the supplied apartment view: navy overhead, violet horizon and a
  // magenta city bloom rather than a flat purple backdrop.
  night: { zenith: '#060b21', horizon: '#552579', glow: '#e75bf0', cloud: '#3e296c' },
  sunset: { zenith: '#292b63', horizon: '#e99575', glow: '#ffd7a0', cloud: '#975c83' },
  day: { zenith: '#255585', horizon: '#9fb7cd', glow: '#d5d4cf', cloud: '#d4deed' },
};

// Remove camera translation and write directly to the far plane. A 900m sky sphere
// clipped by a 300m camera used to make the night sky disappear entirely.
export function DistrictSky({ preset = 'night' }: { preset?: SkyPreset }) {
  const palette = SKY_PRESETS[preset];
  return <mesh name="district07-atmosphere" frustumCulled={false} renderOrder={-1000} raycast={() => {}}>
    <sphereGeometry args={[1, 48, 32]} />
    <shaderMaterial side={THREE.BackSide} depthWrite={false} depthTest={false} fog={false}
      uniforms={{
        zenith: { value: new THREE.Color(palette.zenith) }, horizon: { value: new THREE.Color(palette.horizon) },
        glow: { value: new THREE.Color(palette.glow) }, cloud: { value: new THREE.Color(palette.cloud) },
        night: { value: preset === 'night' ? 1 : 0 },
      }}
      vertexShader={`varying vec3 vRay;
        void main(){vRay=normalize(mat3(modelMatrix)*position);
        vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*vRay,1.0);
        gl_Position=clip.xyww;}`}
      fragmentShader={`varying vec3 vRay; uniform vec3 zenith,horizon,glow,cloud; uniform float night;
        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float noise3(vec3 p){vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        void main(){vec3 d=normalize(vRay); float e=max(d.y,0.0);
          vec3 c=mix(horizon,zenith,pow(smoothstep(-.12,.9,d.y),.45));
          // The apartment panorama faces north (-Z). Keep the strongest city
          // bounce above the harbor rather than behind the camera.
          float harborFacing=smoothstep(-.15,.85,-d.z);
          c+=glow*exp(-abs(d.y+.015)*6.0)*(.08+.37*harborFacing);
          c+=vec3(.018,.075,.11)*exp(-abs(d.y+.015)*16.0)*smoothstep(.1,.9,d.x);
          vec3 p=d*vec3(4.0,10.0,4.0)+vec3(1.0,0.7,3.0);
          float f=noise3(p)*.55+noise3(p*2.03)*.27+noise3(p*4.1)*.12+noise3(p*8.1)*.06;
          float mask=smoothstep(.45,.68,f)*smoothstep(-.02,.18,d.y);
          c=mix(c,cloud*(.68+.5*e),mask*.72);
          float star=step(.99955,hash(floor(d*750.0)))*smoothstep(.22,.8,d.y)*(1.0-mask)*night;
          c+=star*vec3(.35,.4,.55); c=mix(c,zenith*.45,(1.0-smoothstep(-.45,0.0,d.y)));
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}
