import { useState, useRef } from "react"
export function useSpeech(onResult:(t:string)=>void){
  const [listening,setListening]=useState(false)
  const recRef=useRef<any>(null)
  const toggle=()=>{
    const SR=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition
    if(!SR){alert("Speech not supported");return}
    if(listening){recRef.current?.stop();setListening(false);return}
    const rec=new SR()
    rec.lang="en-US";rec.interimResults=true;rec.continuous=false
    rec.onstart=()=>setListening(true)
    rec.onend=()=>setListening(false)
    rec.onresult=(e:any)=>{
      const t=Array.from(e.results).map((r:any)=>r[0].transcript).join("")
      onResult(t)
      if(e.results[0].isFinal) setListening(false)
    }
    rec.onerror=()=>setListening(false)
    recRef.current=rec;rec.start()
  }
  return {listening,toggle}
}
