"use client";
import { Canvas } from "@react-three/fiber";
import { CharacterModel } from "./CharacterModel";
export default function NovaHologram(){return <Canvas dpr={[1,1.25]} camera={{position:[.04,1.67,1.35],fov:32}} onCreated={({camera})=>camera.lookAt(0,1.58,0)}><ambientLight intensity={1.8}/><directionalLight position={[-2,3,3]} intensity={2.5} color="#83eaff"/><pointLight position={[1,1.7,-.5]} intensity={3} color="#9067ff"/><group position={[0,-.03,0]}><CharacterModel character={{skin:"#719faa",hair:"#b9e7ee",outfit:"#1a3447",appearance:{hairPreset:9,eyeColor:"#32e6f4",cyberware:true,facePreset:1}}}/></group></Canvas>;}
