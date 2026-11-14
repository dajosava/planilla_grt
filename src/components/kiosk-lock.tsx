"use client";
import {useEffect} from "react";

/**
 * Bloquea gestos de tablet en PWA/kiosco:
 * - swipe horizontal / gesto "atrás" del sistema (historial)
 * - pinch-zoom
 * - overscroll lateral
 */
export function KioskLock({children}:{children:React.ReactNode}){
 useEffect(()=>{
  const root=document.documentElement;
  root.classList.add("kiosk-locked");
  document.body.classList.add("kiosk-locked");

  const here=()=>`${window.location.pathname}${window.location.search}${window.location.hash}`;

  // Trampa de historial: el gesto atrás/adelante (swipe) no sale de marcación/operaciones.
  const trapHistory=()=>{
   try{
    window.history.pushState({kioskLock:true},"",here());
   }catch{/* ignore */}
  };
  // Sembrar un par de entradas para absorber swipes dobles.
  trapHistory();
  trapHistory();

  const onPopState=()=>{
   trapHistory();
  };
  window.addEventListener("popstate",onPopState);

  const blockMultiTouch=(e:TouchEvent)=>{
   if(e.touches.length>1)e.preventDefault();
  };

  const blockGesture=(e:Event)=>e.preventDefault();

  // Edge swipe (gesto atrás de Chrome Android / PWA).
  let startX=0;
  let startY=0;
  let fromEdge=false;
  const EDGE=28;

  const onTouchStart=(e:TouchEvent)=>{
   if(e.touches.length!==1)return;
   startX=e.touches[0].clientX;
   startY=e.touches[0].clientY;
   const w=window.innerWidth||0;
   fromEdge=startX<=EDGE||startX>=w-EDGE;
  };

  const onTouchMove=(e:TouchEvent)=>{
   if(e.touches.length>1){
    e.preventDefault();
    return;
   }
   if(e.touches.length!==1)return;
   const dx=e.touches[0].clientX-startX;
   const dy=e.touches[0].clientY-startY;
   const absX=Math.abs(dx);
   const absY=Math.abs(dy);

   // Cualquier pan horizontal relevante, sobre todo desde el borde.
   if((fromEdge&&absX>6)||(absX>absY&&absX>10)){
    e.preventDefault();
   }
  };

  document.addEventListener("touchstart",onTouchStart,{passive:true,capture:true});
  document.addEventListener("touchmove",onTouchMove,{passive:false,capture:true});
  document.addEventListener("touchmove",blockMultiTouch,{passive:false,capture:true});
  document.addEventListener("gesturestart",blockGesture,{passive:false,capture:true} as AddEventListenerOptions);
  document.addEventListener("gesturechange",blockGesture,{passive:false,capture:true} as AddEventListenerOptions);
  document.addEventListener("gestureend",blockGesture,{passive:false,capture:true} as AddEventListenerOptions);

  return ()=>{
   root.classList.remove("kiosk-locked");
   document.body.classList.remove("kiosk-locked");
   window.removeEventListener("popstate",onPopState);
   document.removeEventListener("touchstart",onTouchStart,true);
   document.removeEventListener("touchmove",onTouchMove,true);
   document.removeEventListener("touchmove",blockMultiTouch,true);
   document.removeEventListener("gesturestart",blockGesture,true);
   document.removeEventListener("gesturechange",blockGesture,true);
   document.removeEventListener("gestureend",blockGesture,true);
  };
 },[]);

 return <div className="kiosk-lock-root">{children}</div>;
}
