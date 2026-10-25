"use client";
import { create } from "zustand";
export const useUi = create<{screen:string;menu:boolean;setScreen:(screen:string)=>void;setMenu:(open:boolean)=>void}>(set=>({screen:"lobby",menu:false,setScreen:screen=>set({screen,menu:false}),setMenu:menu=>set({menu})}));
