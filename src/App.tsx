import { useState,useRef,useEffect } from "react"
import { motion,AnimatePresence } from "framer-motion"
import { Sparkles, Mic, Send, Copy, Check, Bookmark, ChevronDown, Trash2, History, Zap, Plus, User, Settings2, MicOff, X, Pencil, Sparkle, Menu, LogOut, Edit2, Search } from "lucide-react"
import { generateClarify, generateFinal, tweakPrompt, contextualClarify } from "./services/aiService"
import { useSpeech } from "./hooks/useSpeech"
import type { Domain, Message, VaultItem } from "./types"
import { cn } from "@/lib/utils"
import { MagicCard } from "@/components/ui/magic-card"
import { BorderBeam } from "@/components/ui/border-beam"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Particles } from "@/components/ui/particles"

type ChatSession={id:string;title:string;domain:Domain;messages:Message[];createdAt:number;updatedAt:number}
type AppUser={name:string;email:string}

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).substring(2))

const spring={type:"spring" as const,stiffness:400,damping:25}
const stagger={animate:{transition:{staggerChildren:0.07,delayChildren:0.08}}}
const fadeUp={initial:{opacity:0,y:10},animate:{opacity:1,y:0},transition:spring}
const CATEGORIES=[
  {id:"video" as Domain,label:"Video Prompt",emoji:"🎥",desc:"Sora, Runway, Pika, Luma",grad:"from-violet-500 to-fuchsia-500",glow:"rgba(139,92,246,0.5)"},
  {id:"image" as Domain,label:"Photo & Image Prompt",emoji:"🎨",desc:"Midjourney, DALL·E, Flux",grad:"from-blue-500 to-cyan-400",glow:"rgba(59,130,246,0.5)"},
  {id:"code" as Domain,label:"Code & Text Prompt",emoji:"💻",desc:"Cursor, Claude, ChatGPT",grad:"from-emerald-500 to-teal-400",glow:"rgba(16,185,129,0.5)"},
]
function BoldText({text,domain}:{text:string;domain?:Domain}){
  const parts=text.split(/(\*\*.*?\*\*)/g)
  return <>{parts.map((p,i)=>{
    if(p.startsWith("**")&&p.endsWith("**")) return <strong key={i} className="font-bold text-white">{p.slice(2,-2)}</strong>
    if(domain && p.toLowerCase().includes(domain)) {
      const segs=p.split(new RegExp(`(${domain})`,"i"))
      return <span key={i}>{segs.map((s,j)=> s.toLowerCase()===domain?.toLowerCase() ? <strong key={j} className="font-bold text-white capitalize">{s}</strong> : s)}</span>
    }
    return <span key={i}>{p}</span>
  })}</>
}
function GlassCategoryCard({c,domain,onSelect}:{c:typeof CATEGORIES[number];domain:Domain;onSelect:(d:Domain)=>void}){
  const innerRef=useRef<HTMLDivElement>(null)
  const onMove=(e:React.MouseEvent)=>{
    const el=innerRef.current; if(!el) return;
    const r=el.getBoundingClientRect(); el.style.setProperty("--mx",`${e.clientX-r.left}px`); el.style.setProperty("--my",`${e.clientY-r.top}px`)
    const cx=r.width/2, cy=r.height/2
    const rx=(e.clientY-r.top-cy)/14, ry=(cx-(e.clientX-r.left))/14
    el.style.transform=`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`
  }
  const onLeave=()=>{ if(innerRef.current) innerRef.current.style.transform=`perspective(900px) rotateX(0) rotateY(0) translateZ(0)`}
  return (
    <motion.button variants={fadeUp} whileTap={{scale:0.97}} transition={spring} onClick={()=>onSelect(c.id)} className="p-0 bg-transparent border-0 w-full text-left">
      <div ref={innerRef} onMouseMove={onMove} onMouseLeave={onLeave} className={cn("spotlight text-left p-6 rounded-[28px] glass-strong min-h-[186px] flex flex-col justify-between group relative overflow-hidden text-slate-100 will-change-transform",
      domain===c.id?'ring-1 ring-violet-400/40 border-violet-400/30 shadow-[0_0_40px_rgba(139,92,246,0.25)]':'border-white/10 hover:border-white/15')}>
      {domain===c.id && <BorderBeam size={220} duration={12} colorFrom="#8b5cf6" colorTo="#38bdf8" borderWidth={1.2} />}
      <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/[0.07] via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-28 h-28 blur-2xl opacity-20 rounded-full pointer-events-none" style={{background:c.glow}} />
      <div>
        <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg text-[20px] relative",c.grad)}>
          <span className="relative z-10">{c.emoji}</span>
          <span className="absolute inset-0 rounded-2xl bg-white/15 opacity-0 group-hover:opacity-100 transition blur-[1px]" />
        </div>
        <div className="font-semibold text-[15px] tracking-tight">{c.label}</div>
        <div className="text-xs text-slate-400 mt-1 leading-relaxed">Optimized for {c.desc}</div>
      </div>
      <div className="text-xs text-slate-500 mt-4 group-hover:text-slate-200 flex items-center gap-1 transition">Start creating <span className="group-hover:translate-x-1 transition-transform">→</span></div>
      </div>
    </motion.button>
  )
}

export default function App(){
  const [domain,setDomain]=useState<Domain>(null)
  const [messages,setMessages]=useState<Message[]>([])
  const [input,setInput]=useState("")
  const [clarifyAnswers,setClarifyAnswers]=useState<string[]>([])
  const [pendingIdea,setPendingIdea]=useState("")
  const [generations,setGenerations]=useState(()=>Number(localStorage.getItem("bp_gen")||"0"))
  const [vault,setVault]=useState<VaultItem[]>(()=>{try{return JSON.parse(localStorage.getItem("bp_vault")||"[]")}catch{return []}})
  const [showVault,setShowVault]=useState(false)
  const [toast,setToast]=useState("")
  const [streamText,setStreamText]=useState("")
  const [tweakFor,setTweakFor]=useState<string|null>(null)
  const [tweakInputs,setTweakInputs]=useState<Record<string,string>>({})
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const [searchQuery,setSearchQuery]=useState("")
  const [chats,setChats]=useState<ChatSession[]>(()=>{try{return JSON.parse(localStorage.getItem("bp_chats")||"[]")}catch{return []}})
  const [activeId,setActiveId]=useState<string|null>(null)
  const [user,setUser]=useState<AppUser|null>(()=>{try{return JSON.parse(localStorage.getItem("bp_user")||"null")}catch{return null}})
  const [showAuth,setShowAuth]=useState(false)
  const [authTab,setAuthTab]=useState<'signin'|'signup'>('signin')
  const [authEmail,setAuthEmail]=useState("")
  const [authPass,setAuthPass]=useState("")
  const [authName,setAuthName]=useState("")
  const [hasStarted,setHasStarted]=useState(false)
  const [editingId,setEditingId]=useState<string|null>(null)
  const [editTitle,setEditTitle]=useState("")
  const listRef=useRef<HTMLDivElement>(null)
  const endRef=useRef<HTMLDivElement>(null)
  const {listening,toggle}=useSpeech(t=>setInput(t))

  const scrollToBottom=(smooth=true)=>{
    const beh:ScrollBehavior=smooth?"smooth":"auto"
    requestAnimationFrame(()=>{
      if(listRef.current){
        listRef.current.scrollTo({top:listRef.current.scrollHeight,behavior:beh})
      }
      endRef.current?.scrollIntoView({behavior:beh,block:"end"})
    })
  }
  useEffect(()=>{
    scrollToBottom(true)
  },[messages,streamText])
  useEffect(()=>localStorage.setItem("bp_vault",JSON.stringify(vault)),[vault])
  useEffect(()=>localStorage.setItem("bp_gen",String(generations)),[generations])
  useEffect(()=>localStorage.setItem("bp_chats",JSON.stringify(chats)),[chats])
  useEffect(()=>{ if(user) localStorage.setItem("bp_user",JSON.stringify(user)); else localStorage.removeItem("bp_user")},[user])
  useEffect(()=>{
    if(activeId){
      const c=chats.find(x=>x.id===activeId)
      if(c){ setMessages(c.messages); setDomain(c.domain); setHasStarted(c.messages.length>0) }
    }
  },[activeId])

  const persistMessages=(next:Message[], d:Domain|null)=>{
    if(!activeId){
      const id=generateId()
      const title=next.find(m=>m.role==='user')?.text.slice(0,38) || "New chat"
      const ns:ChatSession={id,title,domain:d,messages:next,createdAt:Date.now(),updatedAt:Date.now()}
      setChats(prev=>[ns,...prev]); setActiveId(id)
      return
    }
    setChats(prev=>prev.map(c=> c.id===activeId ? {...c,messages:next,domain:d??c.domain,updatedAt:Date.now(),title: c.title==="New chat" ? (next.find(m=>m.role==='user')?.text.slice(0,38)||c.title) : c.title } : c))
  }

  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(""),2200)}
  const newChat=()=>{
    const id=generateId()
    const ns:ChatSession={id,title:"New chat",domain:null,messages:[],createdAt:Date.now(),updatedAt:Date.now()}
    setChats(prev=>[ns,...prev]); setActiveId(id)
    setMessages([]);setDomain(null);setPendingIdea("");setClarifyAnswers([]);setStreamText("");setTweakFor(null);setTweakInputs({});setHasStarted(false)
    setSidebarOpen(false)
  }
  const handleCategory = (d: Domain) => {
    setDomain(d);
    setHasStarted(true);
    const chatIdToUse = activeId || generateId();
    const welcomeMsg: Message = {
      id: generateId(),
      role: "assistant",
      text: `Great — ${d} mode activated. Describe your idea and I'll craft a hyper-detailed CREATE prompt.`,
      domain: d
    };
    const next = [welcomeMsg];
    setMessages(next);
    setChats(prev => {
      const exists = prev.find(c => c.id === chatIdToUse);
      if (!exists) {
        return [{ id: chatIdToUse, title: `${d} project`, domain: d, messages: next, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
      }
      return prev.map(c => c.id === chatIdToUse ? { ...c, messages: next, domain: d, updatedAt: Date.now() } : c);
    });
    if (!activeId) setActiveId(chatIdToUse);
  }
  const handleSend = async (text?: string) => {
    const idea = (text || input).trim();
    if (!idea) return;
    setHasStarted(true);
    
    let currentDomain = domain || ("code" as Domain);
    if (!domain) setDomain(currentDomain);
    
    if (generations >= 10) { showToast("Free limit reached — upgrade to Pro"); return; }

    const chatIdToUse = activeId || generateId();
    
    const userMsg: Message = { id: generateId(), role: "user", text: idea, domain: currentDomain };
    setMessages(prev => {
      const next = [...prev, userMsg];
      setChats(cPrev => {
        const exists = cPrev.find(c => c.id === chatIdToUse);
        if (!exists) {
          return [{ id: chatIdToUse, title: idea.slice(0, 38), domain: currentDomain, messages: next, createdAt: Date.now(), updatedAt: Date.now() }, ...cPrev];
        }
        return cPrev.map(c => c.id === chatIdToUse ? { ...c, messages: next, domain: currentDomain, updatedAt: Date.now() } : c);
      });
      return next;
    });
    
    if (!activeId) setActiveId(chatIdToUse);
    setInput(""); setPendingIdea(idea); setClarifyAnswers([]);

    try {
      const qs = await generateClarify(idea, currentDomain);
      const validQs = qs && qs.length ? qs : contextualClarify(idea, currentDomain);
      const safeQs = validQs.map((q: any) => ({
        question: q.question || "Could you clarify?",
        pills: (q.pills && q.pills.length ? q.pills : ["Option A", "Option B", "Option C"])
      }));
      
      const bot: Message = { id: generateId(), role: "assistant", text: "Got it — a couple quick questions to make it perfect:", clarify: safeQs };
      
      setMessages(prev => {
        const finalMessages = [...prev, bot];
        setChats(oldChats => oldChats.map(c => c.id === chatIdToUse ? { ...c, messages: finalMessages, updatedAt: Date.now() } : c));
        return finalMessages;
      });
      setTimeout(() => scrollToBottom(true), 100);
      
    } catch (e) {
      console.warn("API failed, using fallback.", e);
      const fallback = contextualClarify(idea, currentDomain);
      const safeQs = fallback.map((q: any) => ({
        question: q.question,
        pills: (q.pills && q.pills.length ? q.pills : ["Option A", "Option B", "Option C"])
      }));
      
      const bot: Message = { id: generateId(), role: "assistant", text: "Got it — a couple quick questions to make it perfect:", clarify: safeQs };
      
      setMessages(prev => {
        const finalMessages = [...prev, bot];
        setChats(oldChats => oldChats.map(c => c.id === chatIdToUse ? { ...c, messages: finalMessages, updatedAt: Date.now() } : c));
        return finalMessages;
      });
      setTimeout(() => scrollToBottom(true), 100);
    }
  }
  const pickPill=(qIdx:number,pill:string)=>{const next=[...clarifyAnswers];next[qIdx]=pill;setClarifyAnswers(next)}
  const handleCompile=async()=>{
    if(!pendingIdea||!domain) return
    if(generations>=10){ showToast("Free limit reached — upgrade to Pro");return}
    const consumedMid=messages.map(m=> m.clarify ? {...m, clarifyConsumed:true} : m)
    const um:Message={id:generateId(),role:"user",text:clarifyAnswers.filter(Boolean).join(" • ")||"Use best defaults"}
    const mid=[...consumedMid,um]; setMessages(mid); persistMessages(mid,domain)
    setStreamText("Crafting your CREATE blueprint…")
    const res=await generateFinal(pendingIdea,domain,clarifyAnswers)
    let out="";for(const ch of res.prompt){ out+=ch; setStreamText(out); await new Promise(r=>setTimeout(r,5))}
    setStreamText("")
    const bot:Message={id:generateId(),role:"assistant",text:"Here is your hyper-detailed CREATE prompt — ready to paste:",result:res,domain:domain!}
    const fin=[...mid,bot]; setMessages(fin); persistMessages(fin,domain); setGenerations(g=>g+1);setClarifyAnswers([])
  }
  const handleRegenerate=async()=>{
    if(!pendingIdea||!domain) return
    if(generations>=10){ showToast("Free limit reached — upgrade to Pro");return}
    setStreamText("Regenerating…")
    const res=await generateFinal(pendingIdea,domain,clarifyAnswers)
    let out=""; for(const ch of res.prompt){ out+=ch; setStreamText(out); await new Promise(r=>setTimeout(r,4))}
    setStreamText("")
    const bot:Message={id:generateId(),role:"assistant",text:"Here's a fresh variation:",result:res,domain:domain!}
    const fin=[...messages,bot]; setMessages(fin); persistMessages(fin,domain); setGenerations(g=>g+1)
  }
  const handleTweak=async(id:string, prompt:string)=>{
    const cur=(tweakInputs[id]||"").trim()
    if(!cur) return
    const tweaked=await tweakPrompt(prompt,cur)
    const upd=messages.map(x=> x.id===id && x.result ? {...x,result:{...x.result,prompt:tweaked}} : x)
    setMessages(upd); persistMessages(upd,domain); setTweakFor(null); setTweakInputs(p=>{const n={...p}; delete n[id]; return n});showToast("Prompt tweaked")
  }
  const copy=(t:string)=>{navigator.clipboard.writeText(t);showToast("Copied to clipboard")}
  const save=(p:string,d:Domain)=>{setVault(v=>[{id:generateId(),prompt:p,domain:d,createdAt:Date.now()},...v]);showToast("Saved to Vault")}
  const loadChat=(id:string)=>{setActiveId(id);setSidebarOpen(false)}
  const deleteChat=(id:string)=>{setChats(c=>c.filter(x=>x.id!==id)); if(activeId===id){setActiveId(null);setMessages([]);setDomain(null)}}
  const renameChat=(id:string)=>{if(!editTitle.trim()){ setEditingId(null); return } setChats(c=>c.map(x=>x.id===id?{...x,title:editTitle.trim()}:x));setEditingId(null)}

  const now=Date.now()
  const filteredBySearch=searchQuery.trim() ? chats.filter(c=>{
    const q=searchQuery.toLowerCase()
    return c.title.toLowerCase().includes(q) || (c.domain||"").toLowerCase().includes(q) || c.messages.some(m=>m.text.toLowerCase().includes(q))
  }) : chats
  const today=filteredBySearch.filter(c=> now - c.updatedAt < 86400000)
  const week=filteredBySearch.filter(c=> now - c.updatedAt >=86400000 && now - c.updatedAt < 7*86400000)
  const older=filteredBySearch.filter(c=> now - c.updatedAt >= 7*86400000)

  const handleAuth=()=>{
    if(!authEmail || !authPass || (authTab==='signup' && !authName)){ showToast("Fill all fields"); return}
    const u:AppUser={name: authTab==='signup' ? authName : authEmail.split("@")[0], email:authEmail}
    setUser(u); setShowAuth(false); setAuthEmail("");setAuthPass("");setAuthName(""); showToast(authTab==='signup'?"Account created":"Signed in")
  }
  const handleGoogle=()=>{
    const u:AppUser={name:"Alex Carter", email:"alex@gmail.com"}
    setUser(u); setShowAuth(false); showToast("Signed in with Google")
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0f1e] text-slate-100 flex flex-col relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.55]" style={{background:`radial-gradient(800px circle at 15% 10%, rgba(139,92,246,0.18), transparent 60%), radial-gradient(700px circle at 90% 20%, rgba(56,189,248,0.14), transparent 60%), radial-gradient(900px circle at 50% 90%, rgba(99,102,241,0.10), transparent 70%)`}} />
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-violet-600/18 blur-[120px] rounded-full animate-pulse_glow"/>
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-blue-600/12 blur-[120px] rounded-full animate-pulse_glow" style={{animationDelay:"1s"}}/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-cyan-500/08 blur-[130px] rounded-full"/>
        <div className="absolute inset-0 opacity-40"><Particles quantity={30} className="absolute inset-0" /></div>
        <div className="absolute inset-0" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize:"48px 48px", maskImage:"radial-gradient(ellipse at center, black 35%, transparent 75%)", WebkitMaskImage:"radial-gradient(ellipse at center, black 35%, transparent 75%)"}} />
      </div>

      <header className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/[0.07] glass-strong w-full !rounded-none !border-x-0 !border-t-0 backdrop-blur-2xl shrink-0">
        <div className="flex items-center gap-2">
          <motion.button whileTap={{scale:0.92}} transition={spring} onClick={()=>setSidebarOpen(v=>!v)} className="p-2.5 rounded-xl glass-subtle hover:bg-white/10 border border-white/10"><Menu size={18}/></motion.button>
          <motion.div whileHover={{scale:1.04, rotate:3}} whileTap={{scale:0.97}} transition={spring} className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-600/30 ring-1 ring-white/15 relative overflow-hidden">
            <span className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            <Sparkles size={18} className="text-white relative"/>
          </motion.div>
          <span className="font-semibold text-[17px] tracking-tight hidden sm:inline shimmer-text">Blueprint AI</span>
          <span className="hidden sm:inline text-[10px] tracking-[0.18em] glass-subtle px-2.5 py-1 rounded-full border border-white/10 font-semibold">BETA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-2 glass-subtle rounded-full px-3.5 py-1.5 text-xs border border-white/10">
            <Zap size={14} className="text-amber-400"/> {generations} / 10 Free Generations <span className="bg-gradient-to-r from-violet-500 to-blue-500 px-2.5 py-0.5 rounded-full text-white font-medium ml-1 shadow">Pro</span>
          </div>
          <div className="flex lg:hidden items-center gap-1.5 glass-subtle rounded-full px-2.5 py-1.5 text-[11px] border border-white/10"><Zap size={12} className="text-amber-400"/>{generations}/10</div>
          <motion.button whileHover={{scale:1.03,y:-1}} whileTap={{scale:0.97}} transition={spring} onClick={()=>setShowVault(true)} className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full glass-subtle border border-white/10 hover:bg-white/10 text-xs font-medium"><Bookmark size={14}/> Saved {vault.length}</motion.button>
          <motion.button whileTap={{scale:0.97}} transition={spring} onClick={()=>setShowVault(true)} className="sm:hidden p-2.5 rounded-xl glass-subtle border border-white/10"><History size={16}/></motion.button>
          <ShimmerButton onClick={newChat} shimmerColor="rgba(255,255,255,0.9)" className="hidden sm:flex text-sm !py-2"><Plus size={16}/> New Prompt</ShimmerButton>
          <motion.button whileTap={{scale:0.97}} transition={spring} onClick={newChat} className="sm:hidden p-2.5 rounded-full bg-white text-slate-900 shadow-lg"><Plus size={16}/></motion.button>
          <motion.button whileTap={{scale:0.92}} whileHover={{scale:1.05}} transition={spring} onClick={()=>setShowAuth(true)} className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center ml-1 overflow-hidden border border-white/15 shadow-lg relative">
            <span className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            {user ? <span className="text-xs font-bold text-white relative">{user.name.slice(0,1).toUpperCase()}</span> : <User size={14} className="text-white relative"/>}
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"/>
            <motion.div initial={{x:-340, opacity:0.6}} animate={{x:0, opacity:1}} exit={{x:-340, opacity:0}} transition={spring} className="fixed left-0 top-0 bottom-0 z-40 w-[340px] glass-strong !rounded-none !border-y-0 !border-l-0 flex flex-col overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/[0.06] via-transparent to-blue-600/[0.04] pointer-events-none" />
              <div className="relative p-4 flex items-center justify-between border-b border-white/10">
                <span className="font-semibold flex items-center gap-2"><span className="w-7 h-7 rounded-xl glass-subtle flex items-center justify-center border border-white/10"><History size={14}/></span> History</span>
                <button onClick={()=>setSidebarOpen(false)} className="p-2 rounded-xl glass-subtle hover:bg-white/10 border border-white/10"><X size={14}/></button>
              </div>
              <div className="relative p-3">
                <ShimmerButton onClick={newChat} className="w-full justify-center !rounded-2xl"><Plus size={16}/>+ New Chat</ShimmerButton>
                <div className="mt-3 relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search chats" className="w-full glass-subtle rounded-full pl-9 pr-3 py-2.5 text-xs placeholder:text-slate-500 outline-none focus:border-violet-500/40 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition"/>
                </div>
              </div>
              <div className="relative flex-1 overflow-y-auto px-3 pb-4 space-y-5">
                {filteredBySearch.length===0 ? <p className="text-xs text-slate-500 text-center mt-10 glass-subtle rounded-2xl py-6 mx-2 border border-white/5">{chats.length===0?"No chats yet. Start a new prompt.":"No matches for \""+searchQuery+"\""}</p> : (
                  <div className="space-y-5">
                    {[["Today",today],["Previous 7 Days",week],["Older",older] as const].map(([label,list]:any)=> list.length>0 && (
                      <div key={label as string}>
                        <div className="text-[10px] tracking-[0.16em] text-slate-500 font-semibold mb-2 px-2">{label as string}</div>
                        <div className="space-y-1.5">
                          {list.map((c:ChatSession)=>(
                            <div key={c.id} className={cn("group flex items-center gap-2 px-3 py-3 rounded-2xl border cursor-pointer transition-all", activeId===c.id?'bg-white text-slate-900 border-white shadow-lg scale-[1.01]':'glass-subtle border-white/10 hover:bg-white/[0.07] hover:border-white/15 text-slate-300 hover:translate-x-0.5')}>
                              <button onClick={()=>loadChat(c.id)} className="flex-1 text-left min-w-0">
                                {editingId===c.id ? (
                                  <input autoFocus value={editTitle} onChange={e=>setEditTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') renameChat(c.id); if(e.key==='Escape') setEditingId(null)}} onBlur={()=>renameChat(c.id)} className="w-full bg-transparent outline-none text-xs border-b border-slate-400"/>
                                ) : (
                                  <>
                                    <div className="text-xs font-medium truncate">{c.title}</div>
                                    <div className={cn("text-[11px] truncate", activeId===c.id?'text-slate-500':'text-slate-500')}>{c.domain || "no domain"} • {new Date(c.updatedAt).toLocaleDateString()}</div>
                                  </>
                                )}
                              </button>
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={()=>{setEditingId(c.id);setEditTitle(c.title)}} className={cn("p-1.5 rounded-lg border", activeId===c.id?'hover:bg-black/10 border-transparent':'hover:bg-white/10 border-white/5')}><Edit2 size={12}/></button>
                                <button onClick={()=>deleteChat(c.id)} className={cn("p-1.5 rounded-lg hover:text-red-500 border", activeId===c.id?'hover:bg-black/10 border-transparent':'hover:bg-white/10 border-white/5')}><Trash2 size={12}/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {user && (
                <div className="relative p-3 border-t border-white/10 flex items-center justify-between glass-subtle !rounded-none !border-x-0 !border-b-0">
                  <div className="flex items-center gap-2.5 min-w-0"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-xs font-bold border border-white/15 shadow">{user.name.slice(0,1).toUpperCase()}</div><div className="min-w-0"><div className="text-xs font-medium truncate">{user.name}</div><div className="text-[11px] text-slate-500 truncate">{user.email}</div></div></div>
                  <button onClick={()=>setUser(null)} className="p-2 rounded-xl glass-subtle hover:bg-white/10 border border-white/10"><LogOut size={14}/></button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col w-full max-w-[920px] mx-auto overflow-hidden">
        <div ref={listRef} className="chat-scroll overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-8 space-y-5">
          {!hasStarted ? (
            <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={spring} className="flex flex-col items-center text-center flex-1 justify-center py-6 sm:py-10 w-full">
              <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{...spring,delay:0.05}} className="inline-flex items-center gap-2 glass-subtle rounded-full px-3 py-1.5 text-[11px] border border-white/10 mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> Powered by CREATE framework • Beta 2.0
              </motion.div>
              <motion.h1 initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{...spring,delay:0.08}} className="text-[38px] sm:text-[54px] font-semibold tracking-tight leading-[0.92] text-white">What are you<br/><span className="shimmer-text text-glow">creating today?</span></motion.h1>
              <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.18}} className="text-slate-400 mt-3 text-[14px] max-w-md glass-subtle rounded-full px-4 py-2 border border-white/5">Choose a domain below — Blueprint transforms any vague idea into a hyper-detailed prompt.</motion.p>
              <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 w-full max-w-[760px]">
                {CATEGORIES.map(c=>(
                  <GlassCategoryCard key={c.id} c={c} domain={domain} onSelect={handleCategory} />
                ))}
              </motion.div>
              <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.35}} className="flex gap-2 mt-8 text-xs flex-wrap justify-center max-w-2xl">
                {["A cyberpunk street market","E-commerce shoe store","Cinematic drone over Iceland"].map(s=>(
                  <motion.button key={s} whileHover={{scale:1.04,y:-1}} whileTap={{scale:0.97}} transition={spring} onClick={()=>{if(!domain) setDomain("image"); handleSend(s)}} className="px-4 py-2.5 rounded-full glass-subtle border border-white/10 hover:bg-white/10 hover:border-white/15 text-slate-300 hover:text-white transition shadow-lg">{s}</motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-5">
              {messages.map(m=>(
                <motion.div key={m.id} variants={fadeUp} transition={spring} className={cn("flex", m.role==='user'?'justify-end':'justify-start')}>
                  {m.role==='user' ? (
                    <div className="max-w-[82%] bg-gradient-to-br from-blue-600 via-violet-600 to-indigo-600 text-white px-5 py-3.5 rounded-[24px] rounded-br-lg shadow-xl shadow-violet-600/20 border border-white/15 relative overflow-hidden">
                      <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap relative"><BoldText text={m.text} domain={m.domain} /></p>
                    </div>
                  ) : (
                    <MagicCard className="w-full p-5">
                      <BorderBeam size={180} duration={10} colorFrom="#8b5cf6" colorTo="#38bdf8" />
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-slate-100"><BoldText text={m.text} domain={m.domain} /></p>
                      {m.clarify && (
                        <motion.div variants={stagger} initial="initial" animate="animate" className={cn("mt-4 space-y-4", m.clarifyConsumed && "opacity-60 pointer-events-none")}>
                          {m.clarify.map((q,qi)=>(
                            <motion.div key={qi} variants={fadeUp} transition={spring} className="glass-subtle rounded-2xl p-3.5 border border-white/5">
                              <div className="text-sm font-medium text-slate-100">{qi+1}. {q.question} {m.clarifyConsumed && <span className="ml-2 text-xs text-slate-500">(answered)</span>}</div>
                              <motion.div variants={stagger} className="flex flex-wrap gap-2 mt-2.5">
                                {(q.pills || (q as any).answers || (q as any).options || []).map((p:string)=>(
                                  <motion.button key={p} variants={fadeUp} whileHover={m.clarifyConsumed?{}:{scale:1.04,y:-1}} whileTap={m.clarifyConsumed?{}:{scale:0.97}} transition={spring} disabled={!!m.clarifyConsumed} onClick={()=>!m.clarifyConsumed && pickPill(qi,p)} className={cn("px-3.5 py-1.5 rounded-full text-xs border transition shadow-sm", clarifyAnswers[qi]===p?'bg-white text-slate-900 border-white font-medium shadow-lg':'glass hover:bg-white/10 border-white/10 text-slate-300', m.clarifyConsumed && "opacity-50 cursor-not-allowed")}>{p}</motion.button>
                                ))}
                              </motion.div>
                            </motion.div>
                          ))}
                          <ShimmerButton onClick={handleCompile} disabled={!!m.clarifyConsumed} className={cn("w-full sm:w-auto justify-center", m.clarifyConsumed && "opacity-50 pointer-events-none")}>{m.clarifyConsumed ? "Blueprint generated" : <><Sparkle size={14}/> Generate Blueprint <Send size={14}/></>}</ShimmerButton>
                        </motion.div>
                      )}
                      {m.result && (
                        <ResultCard messageId={m.id} result={m.result} domain={m.domain as Domain} onCopy={copy} onSave={save} onRegenerate={handleRegenerate} tweakFor={tweakFor} setTweakFor={setTweakFor} tweakInputs={tweakInputs} setTweakInputs={setTweakInputs} onTweak={handleTweak} />
                      )}
                    </MagicCard>
                  )}
                </motion.div>
              ))}
              {streamText && (
                <motion.div initial={{opacity:0,y:6,scale:0.98}} animate={{opacity:1,y:0,scale:1}} transition={spring} className="glass-strong rounded-[28px] p-5 overflow-hidden relative">
                  <BorderBeam size={200} duration={14} colorFrom="#10b981" colorTo="#38bdf8" />
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]"/> Blueprint is crafting…</div>
                  <p className="mono text-sm whitespace-pre-wrap leading-relaxed text-slate-200">{streamText}</p>
                </motion.div>
              )}
              <div ref={endRef} className="h-1" />
            </motion.div>
          )}
        </div>

        <div className="shrink-0 p-4 sm:p-6 bg-gradient-to-t from-[#0a0f1e] via-[#0a0f1e]/95 to-transparent pt-6">
          <div className="glass-strong rounded-[28px] p-2 flex items-center gap-2 shadow-[0_16px_48px_rgba(0,0,0,0.45),0_0_40px_rgba(139,92,246,0.12)] border border-white/10 has-[:focus]:border-violet-400/40 has-[:focus]:shadow-[0_0_0_4px_rgba(139,92,246,0.15),0_16px_48px_rgba(0,0,0,0.45)] transition relative overflow-hidden">
            <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-violet-600/10 via-transparent to-blue-600/10 opacity-0 has-[:focus]:opacity-100 transition pointer-events-none" />
            {domain && <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold bg-white text-slate-900 px-3.5 py-2.5 rounded-full shrink-0 capitalize border border-white shadow-lg relative"><Settings2 size={12}/>{domain}</span>}
            <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()}}} placeholder={domain?"Describe your idea — be vague, we'll refine it...":"Pick a category above, then describe..."} rows={1} className="flex-1 bg-transparent outline-none resize-none py-3.5 px-3 text-sm placeholder:text-slate-500 max-h-32 min-h-[44px] relative"/>
            <motion.button whileHover={{scale:1.05,y:-1}} whileTap={{scale:0.92}} transition={spring} onClick={toggle} aria-label="Voice input" className={cn("p-3.5 rounded-full border shrink-0 transition shadow-lg relative", listening?'bg-red-500 border-red-400 text-white animate-pulse shadow-red-500/30':'glass-subtle border-white/10 hover:bg-white/10 hover:border-white/15 text-slate-300')}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</motion.button>
            <ShimmerButton onClick={()=>handleSend()} aria-label="Send" className="!p-3.5 !rounded-full !px-3.5 shrink-0"><Send size={18}/></ShimmerButton>
          </div>
          <p className="text-[11px] text-center text-slate-500 mt-2.5">Blueprint AI can make mistakes. Verify important prompts. • 3D Glass • Magic UI</p>
        </div>
      </div>

      <AnimatePresence>
        {showVault && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex justify-end" onClick={()=>setShowVault(false)}>
            <motion.div initial={{x:460, opacity:0.8}} animate={{x:0, opacity:1}} exit={{x:460, opacity:0}} transition={spring} onClick={e=>e.stopPropagation()} className="w-[460px] max-w-[92vw] glass-strong !rounded-none !border-y-0 !border-r-0 h-full flex flex-col overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/[0.07] via-transparent to-blue-600/[0.05] pointer-events-none" />
              <div className="relative p-5 border-b border-white/10 flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow"><Bookmark size={14} className="text-white"/></span> Vault — {vault.length}</h2><button onClick={()=>setShowVault(false)} className="p-2.5 rounded-xl glass-subtle hover:bg-white/10 border border-white/10"><X size={16}/></button></div>
              <div className="relative flex-1 overflow-y-auto p-4 space-y-3">
                {vault.length===0 ? <p className="text-sm text-slate-500 text-center mt-10 glass-subtle rounded-2xl py-8 border border-white/5">No saved prompts yet.</p> : vault.map(v=>(
                  <MagicCard key={v.id} className="!rounded-2xl p-4">
                    <div className="text-[11px] text-violet-300 capitalize tracking-wide font-medium">{v.domain} • {new Date(v.createdAt).toLocaleString()}</div>
                    <p className="mono text-xs mt-2 line-clamp-4 whitespace-pre-wrap break-words text-slate-300 leading-relaxed">{v.prompt}</p>
                    <div className="flex gap-2 mt-3"><motion.button whileTap={{scale:0.97}} transition={spring} onClick={()=>copy(v.prompt)} className="text-xs bg-white text-slate-900 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 font-medium shadow"><Copy size={12}/>Copy</motion.button><motion.button whileTap={{scale:0.97}} transition={spring} onClick={()=>setVault(x=>x.filter(i=>i.id!==v.id))} className="text-xs glass-subtle border border-white/10 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-white/10"><Trash2 size={12}/>Delete</motion.button></div>
                  </MagicCard>
                ))}
              </div>
              {vault.length>0 && <div className="relative p-4"><motion.button whileTap={{scale:0.97}} transition={spring} onClick={()=>setVault([])} className="w-full py-2.5 rounded-full glass-subtle border border-white/10 text-sm hover:bg-white/10">Clear all</motion.button></div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuth && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-4" onClick={()=>setShowAuth(false)}>
            <motion.div initial={{opacity:0,scale:0.96,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.96,y:8}} transition={spring} onClick={e=>e.stopPropagation()} className="w-full max-w-[420px] glass-strong rounded-[28px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.55),0_0_60px_rgba(139,92,246,0.15)] relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-blue-600/10 pointer-events-none" />
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-violet-500/20 blur-3xl rounded-full pointer-events-none" />
              <div className="relative p-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg border border-white/10"><Sparkles size={15} className="text-white"/></div><span className="font-semibold">Blueprint AI</span></div>
                <button onClick={()=>setShowAuth(false)} className="p-2 rounded-xl glass-subtle hover:bg-white/10 border border-white/10"><X size={16}/></button>
              </div>
              <div className="relative px-6">
                <div className="flex glass-subtle rounded-full p-1 border border-white/10">
                  <button onClick={()=>setAuthTab('signin')} className={cn("flex-1 py-2 rounded-full text-sm font-medium transition", authTab==='signin'?'bg-white text-slate-900 shadow':'text-slate-400 hover:text-white')}>Sign In</button>
                  <button onClick={()=>setAuthTab('signup')} className={cn("flex-1 py-2 rounded-full text-sm font-medium transition", authTab==='signup'?'bg-white text-slate-900 shadow':'text-slate-400 hover:text-white')}>Create Account</button>
                </div>
              </div>
              <div className="relative p-6 space-y-3">
                {authTab==='signup' && <input value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Full name" className="w-full glass-subtle rounded-2xl px-4 py-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-violet-500/50 border border-white/10"/>}
                <input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Email" type="email" className="w-full glass-subtle rounded-2xl px-4 py-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-violet-500/50 border border-white/10"/>
                <input value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Password" type="password" className="w-full glass-subtle rounded-2xl px-4 py-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-violet-500/50 border border-white/10"/>
                <ShimmerButton onClick={handleAuth} className="w-full justify-center !rounded-2xl !py-3.5">{authTab==='signup'?'Create Account':'Sign In'}</ShimmerButton>
                <div className="flex items-center gap-3 py-1"><div className="flex-1 h-px bg-white/10"/><span className="text-xs text-slate-500">or</span><div className="flex-1 h-px bg-white/10"/></div>
                <motion.button whileTap={{scale:0.97}} transition={spring} onClick={handleGoogle} className="w-full py-3.5 rounded-full bg-white text-slate-900 text-sm font-medium flex items-center justify-center gap-2 shadow-lg hover:bg-slate-50"><span className="w-5 h-5 rounded-full bg-white border flex items-center justify-center text-[10px] font-bold shadow-sm">G</span> Continue with Google</motion.button>
                {user && <p className="text-xs text-center text-emerald-400 glass-subtle rounded-full py-2 border border-emerald-500/20">Signed in as {user.email}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{toast && <motion.div initial={{opacity:0,y:12,scale:0.92}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:0.96}} transition={spring} className="fixed bottom-28 left-1/2 -translate-x-1/2 glass-strong px-5 py-2.5 rounded-full text-sm font-medium shadow-2xl z-50 flex items-center gap-2 border border-white/15"><span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><Check size={12} className="text-white"/></span>{toast}</motion.div>}</AnimatePresence>
    </div>
  )
}

function ResultCard({messageId,result,domain,onCopy,onSave,onRegenerate,tweakFor,setTweakFor,tweakInputs,setTweakInputs,onTweak}:{messageId:string;result:any;domain:Domain;onCopy:(s:string)=>void;onSave:(s:string,d:Domain)=>void;onRegenerate:()=>void;tweakFor:string|null;setTweakFor:(s:string|null)=>void;tweakInputs:Record<string,string>;setTweakInputs:React.Dispatch<React.SetStateAction<Record<string,string>>>;onTweak:(id:string,prompt:string)=>void}){
  const [open,setOpen]=useState(false)
  const [copied,setCopied]=useState(false)
  const doCopy=()=>{onCopy(result.prompt);setCopied(true);setTimeout(()=>setCopied(false),1500)}
  const isTweaking=tweakFor===messageId
  const curInput=tweakInputs[messageId]||""
  return (
    <div className="mt-4">
      <div className="glass !rounded-2xl overflow-hidden border border-white/10 relative">
        <BorderBeam size={160} duration={11} colorFrom="#8b5cf6" colorTo="#06b6d4" borderWidth={1} />
        <div className="flex items-center justify-between px-3.5 py-2.5 glass-subtle !rounded-none !border-x-0 !border-t-0 border-b border-white/10 text-xs">
          <span className="flex items-center gap-2 text-slate-300"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]"/> CREATE Blueprint • ready to paste</span>
          <span className="text-[10px] glass px-2 py-1 rounded-full border border-white/10 font-mono">JetBrains Mono</span>
        </div>
        <pre className="mono text-[13px] leading-relaxed p-4 whitespace-pre-wrap break-words text-slate-200 max-h-[420px] overflow-auto">{result.prompt}</pre>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <ShimmerButton onClick={doCopy} className="!px-4 !py-2 text-xs">{copied ? <><Check size={14}/> Copied</> : <>📋 Copy Prompt</>}</ShimmerButton>
        <motion.button whileHover={{scale:1.03,y:-1}} whileTap={{scale:0.97}} transition={spring} onClick={onRegenerate} className="px-4 py-2 rounded-full glass-subtle border border-white/10 text-xs flex items-center gap-1.5 hover:bg-white/10">🔄 Regenerate</motion.button>
        <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} transition={spring} onClick={()=> isTweaking ? setTweakFor(null) : setTweakFor(messageId)} className={cn("px-4 py-2 rounded-full border text-xs flex items-center gap-1.5 transition", isTweaking?'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-600/20':'glass-subtle border-white/10 hover:bg-white/10')}><Pencil size={12}/> Tweak</motion.button>
        <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} transition={spring} onClick={()=>onSave(result.prompt,domain!)} className="px-4 py-2 rounded-full glass-subtle border border-white/10 text-xs flex items-center gap-1.5 hover:bg-white/10">💾 Save to Vault</motion.button>
      </div>
      <AnimatePresence>{isTweaking && (
        <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={spring} className="mt-3 flex gap-2 glass-subtle border border-white/10 rounded-2xl p-2 overflow-hidden">
          <input value={curInput} onChange={e=>setTweakInputs(p=>({...p,[messageId]:e.target.value}))} placeholder="e.g., make it more minimal, add dark mode..." className="flex-1 bg-transparent outline-none text-sm px-3 placeholder:text-slate-500"/>
          <ShimmerButton onClick={()=>onTweak(messageId,result.prompt)} className="!py-1.5 text-xs !px-4">Apply</ShimmerButton>
        </motion.div>
      )}</AnimatePresence>
      <motion.button whileTap={{scale:0.97}} transition={spring} onClick={()=>setOpen(!open)} className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">Why this works (CREATE Breakdown) <motion.span animate={{rotate:open?180:0}} transition={spring}><ChevronDown size={14}/></motion.span></motion.button>
      <AnimatePresence>{open && (
        <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={spring} className="mt-2 grid gap-2 text-xs overflow-hidden">
          <BreakdownRow k="Context" v={result.breakdown.context} desc="Who it's for & what you're actually making."/>
          <BreakdownRow k="Role" v={result.breakdown.role} desc="Which expert the AI acts as."/>
          <BreakdownRow k="Execution" v={result.breakdown.execution} desc="Step-by-step instructions."/>
          <BreakdownRow k="Constraints" v={result.breakdown.constraints} desc="Guardrails for quality."/>
          <BreakdownRow k="Target Format" v={result.breakdown.target} desc="How the final output should look."/>
        </motion.div>
      )}</AnimatePresence>
    </div>
  )
}
function BreakdownRow({k,v,desc}:{k:string;v:string;desc:string}){
  return <div className="glass-subtle rounded-xl p-3.5 border border-white/10"><div className="font-semibold text-violet-300">{k} <span className="font-normal text-slate-500">— {desc}</span></div><div className="text-slate-300 mt-1 leading-relaxed">{v}</div></div>
}
