import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, Send, Copy, Check, Bookmark, ChevronDown, Trash2, History, Zap, Plus, User, Settings2, MicOff, X, Pencil, Sparkle, Menu, LogOut, Edit2, Search } from "lucide-react"
import { generateClarify, generateFinal, tweakPrompt, contextualClarify } from "./services/aiService"
import { useSpeech } from "./hooks/useSpeech"
import type { Domain, Message, VaultItem } from "./types"
import { cn } from "@/lib/utils"
import bpLogo from "@/assets/bp-logo.png"

type ChatSession = { id: string; title: string; domain: Domain; messages: Message[]; createdAt: number; updatedAt: number }
type AppUser = { name: string; email: string }

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).substring(2))
const CATEGORIES = [
  { id: "video" as Domain, label: "Video Prompt", emoji: "🎥", desc: "Sora, Runway, Pika, Luma", grad: "from-[#B25730] to-[#D97A4D]", glow: "rgba(178,87,48,0.35)" },
  { id: "image" as Domain, label: "Photo & Image Prompt", emoji: "🎨", desc: "Midjourney, DALL·E, Flux", grad: "from-[#B25730] to-[#D97A4D]", glow: "rgba(178,87,48,0.35)" },
  { id: "code" as Domain, label: "Code & Text Prompt", emoji: "💻", desc: "Cursor, Claude, ChatGPT", grad: "from-[#B25730] to-[#D97A4D]", glow: "rgba(178,87,48,0.35)" },
]
function BoldText({ text, domain }: { text: string; domain?: Domain }) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return <>{parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-bold text-[#ECECEC]">{p.slice(2, -2)}</strong>
    if (domain && p.toLowerCase().includes(domain)) {
      const segs = p.split(new RegExp(`(${domain})`, "i"))
      return <span key={i}>{segs.map((s, j) => s.toLowerCase() === domain?.toLowerCase() ? <strong key={j} className="font-bold text-[#ECECEC] capitalize">{s}</strong> : s)}</span>
    }
    return <span key={i}>{p}</span>
  })}</>
}
// @ts-ignore - retained for domain logic
function GlassCategoryCard({ c, domain, onSelect }: { c: typeof CATEGORIES[number]; domain: Domain; onSelect: (d: Domain) => void }) {
  return (
    <button onClick={() => onSelect(c.id)} className="p-0 bg-transparent border-0 w-full text-left">
      <div className={cn("text-left p-6 rounded-xl min-h-[186px] flex flex-col justify-between relative overflow-hidden border",
        domain === c.id ? 'bg-[#2E2E2E] border-[#B25730]' : 'bg-[#262625] border-[#2E2E2E] hover:bg-[#2E2E2E]')}>
        <div>
          <div className="w-11 h-11 rounded-lg bg-[#2E2E2E] border border-[#3a3a3a] flex items-center justify-center mb-4 text-[20px]">
            <span>{c.emoji}</span>
          </div>
          <div className="font-semibold text-[15px] tracking-tight text-[#ECECEC]">{c.label}</div>
          <div className="text-xs text-[#9A9A98] mt-1 leading-relaxed">Optimized for {c.desc}</div>
        </div>
        <div className="text-xs text-[#9A9A98] mt-4 flex items-center gap-1">Start creating <span>→</span></div>
      </div>
    </button>
  )
}

export default function App() {
  const [domain, setDomain] = useState<Domain>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([])
  const [pendingIdea, setPendingIdea] = useState("")
  const [generations, setGenerations] = useState(() => Number(localStorage.getItem("bp_gen") || "0"))
  const [vault, setVault] = useState<VaultItem[]>(() => { try { return JSON.parse(localStorage.getItem("bp_vault") || "[]") } catch { return [] } })
  const [showVault, setShowVault] = useState(false)
  const [toast, setToast] = useState("")
  const [streamText, setStreamText] = useState("")
  const [tweakFor, setTweakFor] = useState<string | null>(null)
  const [tweakInputs, setTweakInputs] = useState<Record<string, string>>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [chats, setChats] = useState<ChatSession[]>(() => { try { return JSON.parse(localStorage.getItem("bp_chats") || "[]") } catch { return [] } })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [user, setUser] = useState<AppUser | null>(() => { try { return JSON.parse(localStorage.getItem("bp_user") || "null") } catch { return null } })
  const [showAuth, setShowAuth] = useState(false)
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState("")
  const [authPass, setAuthPass] = useState("")
  const [authName, setAuthName] = useState("")
  const [hasStarted, setHasStarted] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const createMenuRef = useRef<HTMLDivElement>(null)
  const createMenuRefBottom = useRef<HTMLDivElement>(null)
  const { listening, toggle } = useSpeech(t => setInput(t))

  const scrollToBottom = (smooth = true) => {
    const beh: ScrollBehavior = smooth ? "smooth" : "auto"
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: beh })
      }
      endRef.current?.scrollIntoView({ behavior: beh, block: "end" })
    })
  }
  useEffect(() => {
    if (!createMenuOpen) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      const inTop = createMenuRef.current?.contains(t)
      const inBottom = createMenuRefBottom.current?.contains(t)
      if (!inTop && !inBottom) setCreateMenuOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [createMenuOpen])
  useEffect(() => {
    scrollToBottom(true)
  }, [messages, streamText])
  useEffect(() => localStorage.setItem("bp_vault", JSON.stringify(vault)), [vault])
  useEffect(() => localStorage.setItem("bp_gen", String(generations)), [generations])
  useEffect(() => localStorage.setItem("bp_chats", JSON.stringify(chats)), [chats])
  useEffect(() => { if (user) localStorage.setItem("bp_user", JSON.stringify(user)); else localStorage.removeItem("bp_user") }, [user])
  useEffect(() => {
    if (activeId) {
      const c = chats.find(x => x.id === activeId)
      console.log("FOUND CHAT:", c);
      if (c && c.messages.length > 0) {
        console.log("OVERWRITING MESSAGES WITH:", c.messages);
        setMessages(c.messages); setDomain(c.domain)
      }
    }
  }, [activeId])

  const persistMessages = (next: Message[], d: Domain | null) => {
    console.log("PERSIST CALLED", "activeId:", activeId, "next:", next);
    if (!activeId) {
      const id = generateId()
      const title = next.find(m => m.role === 'user')?.text.slice(0, 38) || "New chat"
      const ns: ChatSession = { id, title, domain: d, messages: next, createdAt: Date.now(), updatedAt: Date.now() }
      setChats(prev => [ns, ...prev]); setActiveId(id)
      return
    }
    console.log("UPDATING EXISTING CHAT", activeId);
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: next, domain: d ?? c.domain, updatedAt: Date.now(), title: c.title === "New chat" ? (next.find(m => m.role === 'user')?.text.slice(0, 38) || c.title) : c.title } : c))
  }

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200) }
  const newChat = () => {
    const id = generateId()
    const ns: ChatSession = { id, title: "New chat", domain: null, messages: [], createdAt: Date.now(), updatedAt: Date.now() }
    setChats(prev => [ns, ...prev]); setActiveId(id)
    setMessages([]); setDomain(null); setPendingIdea(""); setClarifyAnswers([]); setStreamText(""); setTweakFor(null); setTweakInputs({}); setHasStarted(false); setCreateMenuOpen(false)
    setSidebarOpen(false)
  }
  // @ts-ignore - retained for domain logic
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
    console.log("SEND CALLED", text, input);
    const idea = (text || input).trim();
    if (!idea) return;
    setHasStarted(true);
    if (!domain) {
      if (generations >= 10) { showToast("Free limit reached — upgrade to Pro"); return; }
      const userMsg: Message = { id: generateId(), role: "user", text: idea, domain: null };
      const withUser = [...messages, userMsg];
      console.log("ABOUT TO SET MESSAGES", withUser);
      setMessages(withUser);
      persistMessages(withUser, null);
      setInput(""); setPendingIdea(""); setClarifyAnswers([]);
      const lower = idea.toLowerCase().trim();
      let reply = "";
      if (["hi", "hello", "hey", "hola", "greetings", "yo"].includes(lower) || lower.startsWith("hi ") || lower.startsWith("hello ") || lower.startsWith("hey ")) {
        reply = `Hey${user?.name ? ` ${user.name.split(" ")[0]}` : ""}! I'm Oto AI — your prompt engineering companion. Ask me anything, or share an idea you'd like to turn into a powerful prompt.`;
      } else if (lower.includes("what can you do") || lower.includes("help")) {
        reply = "I can chat naturally and also help you craft hyper-detailed prompts for Video, Image, or Code. Just tell me what you want to build!";
      } else {
        reply = `Got it — "${idea.slice(0, 140)}" — happy to chat! I'm Oto AI, here to help with ideas, questions, or prompt crafting.`;
      }
      reply += `\n\nIf you'd like to build a structured prompt, you can click on **CREATE** at the bottom to choose a task domain (Video, Image, or Code).`;
      await new Promise(r => setTimeout(r, 500));
      const bot: Message = { id: generateId(), role: "assistant", text: reply };
      const finalMessages = [...withUser, bot];
      setMessages(finalMessages);
      persistMessages(finalMessages, null);
      setTimeout(() => scrollToBottom(true), 100);
      return;
    }
    let currentDomain = domain as Domain;
    if (generations >= 10) { showToast("Free limit reached — upgrade to Pro"); return; }
    const userMsg: Message = { id: generateId(), role: "user", text: idea, domain: currentDomain };
    const withUser = [...messages, userMsg];
    console.log("ABOUT TO SET MESSAGES", withUser);
    setMessages(withUser);
    persistMessages(withUser, currentDomain);
    setInput(""); setPendingIdea(idea); setClarifyAnswers([]);
    try {
      const qs = await generateClarify(idea, currentDomain);
      const validQs = qs && qs.length ? qs : contextualClarify(idea, currentDomain);
      const safeQs = validQs.map((q: any) => ({
        question: q.question || "Could you clarify?",
        pills: (q.pills && q.pills.length ? q.pills : ["Option A", "Option B", "Option C"])
      }));
      const bot: Message = { id: generateId(), role: "assistant", text: "Got it — a couple quick questions to make it perfect:", clarify: safeQs };
      const finalMessages = [...withUser, bot];
      setMessages(finalMessages);
      persistMessages(finalMessages, currentDomain);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (e) {
      console.warn("API failed, using fallback.", e);
      const fallback = contextualClarify(idea, currentDomain);
      const safeQs = fallback.map((q: any) => ({
        question: q.question,
        pills: (q.pills && q.pills.length ? q.pills : ["Option A", "Option B", "Option C"])
      }));
      const bot: Message = { id: generateId(), role: "assistant", text: "Got it — a couple quick questions to make it perfect:", clarify: safeQs };
      const finalMessages = [...withUser, bot];
      setMessages(finalMessages);
      persistMessages(finalMessages, currentDomain);
      setTimeout(() => scrollToBottom(true), 100);
    }
  }
  const pickPill = (qIdx: number, pill: string) => { const next = [...clarifyAnswers]; next[qIdx] = pill; setClarifyAnswers(next) }
  const handleCompile = async () => {
    if (!pendingIdea || !domain) return
    if (generations >= 10) { showToast("Free limit reached — upgrade to Pro"); return }
    const consumedMid = messages.map(m => m.clarify ? { ...m, clarifyConsumed: true } : m)
    const um: Message = { id: generateId(), role: "user", text: clarifyAnswers.filter(Boolean).join(" • ") || "Use best defaults" }
    const mid = [...consumedMid, um]; setMessages(mid); persistMessages(mid, domain)
    setStreamText("Crafting your CREATE Oto AI…")
    const res = await generateFinal(pendingIdea, domain, clarifyAnswers)
    let out = ""; for (const ch of res.prompt) { out += ch; setStreamText(out); await new Promise(r => setTimeout(r, 5)) }
    setStreamText("")
    const bot: Message = { id: generateId(), role: "assistant", text: "Here is your hyper-detailed CREATE prompt — ready to paste:", result: res, domain: domain! }
    const fin = [...mid, bot]; setMessages(fin); persistMessages(fin, domain); setGenerations(g => g + 1); setClarifyAnswers([])
  }
  const handleRegenerate = async () => {
    if (!pendingIdea || !domain) return
    if (generations >= 10) { showToast("Free limit reached — upgrade to Pro"); return }
    setStreamText("Regenerating…")
    const res = await generateFinal(pendingIdea, domain, clarifyAnswers)
    let out = ""; for (const ch of res.prompt) { out += ch; setStreamText(out); await new Promise(r => setTimeout(r, 4)) }
    setStreamText("")
    const bot: Message = { id: generateId(), role: "assistant", text: "Here's a fresh variation:", result: res, domain: domain! }
    const fin = [...messages, bot]; setMessages(fin); persistMessages(fin, domain); setGenerations(g => g + 1)
  }
  const handleTweak = async (id: string, prompt: string) => {
    const cur = (tweakInputs[id] || "").trim()
    if (!cur) return
    const tweaked = await tweakPrompt(prompt, cur)
    const upd = messages.map(x => x.id === id && x.result ? { ...x, result: { ...x.result, prompt: tweaked } } : x)
    setMessages(upd); persistMessages(upd, domain); setTweakFor(null); setTweakInputs(p => { const n = { ...p }; delete n[id]; return n }); showToast("Prompt tweaked")
  }
  const copy = (t: string) => { navigator.clipboard.writeText(t); showToast("Copied to clipboard") }
  const save = (p: string, d: Domain) => { setVault(v => [{ id: generateId(), prompt: p, domain: d, createdAt: Date.now() }, ...v]); showToast("Saved to Vault") }
  const loadChat = (id: string) => { const c = chats.find(x => x.id === id); if (c && c.messages.length > 0) setHasStarted(true); setActiveId(id); setSidebarOpen(false) }
  const deleteChat = (id: string) => { setChats(c => c.filter(x => x.id !== id)); if (activeId === id) { setActiveId(null); setMessages([]); setDomain(null) } }
  const renameChat = (id: string) => { if (!editTitle.trim()) { setEditingId(null); return } setChats(c => c.map(x => x.id === id ? { ...x, title: editTitle.trim() } : x)); setEditingId(null) }

  const now = Date.now()
  const filteredBySearch = searchQuery.trim() ? chats.filter(c => {
    const q = searchQuery.toLowerCase()
    return c.title.toLowerCase().includes(q) || (c.domain || "").toLowerCase().includes(q) || c.messages.some(m => m.text.toLowerCase().includes(q))
  }) : chats
  const today = filteredBySearch.filter(c => now - c.updatedAt < 86400000)
  const week = filteredBySearch.filter(c => now - c.updatedAt >= 86400000 && now - c.updatedAt < 7 * 86400000)
  const older = filteredBySearch.filter(c => now - c.updatedAt >= 7 * 86400000)

  const handleAuth = () => {
    if (!authEmail || !authPass || (authTab === 'signup' && !authName)) { showToast("Fill all fields"); return }
    const u: AppUser = { name: authTab === 'signup' ? authName : authEmail.split("@")[0], email: authEmail }
    setUser(u); setShowAuth(false); setAuthEmail(""); setAuthPass(""); setAuthName(""); showToast(authTab === 'signup' ? "Account created" : "Signed in")
  }
  const handleGoogle = () => {
    const u: AppUser = { name: "Alex Carter", email: "alex@gmail.com" }
    setUser(u); setShowAuth(false); showToast("Signed in with Google")
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#1E1E1E] text-[#ECECEC] flex flex-col relative">

      <header className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-[#2E2E2E] bg-[#1E1E1E] w-full !rounded-none !border-x-0 !border-t-0 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(v => !v)} className="p-2.5 rounded-lg bg-transparent hover:bg-[#262625] border border-transparent hover:border-[#2E2E2E]"><Menu size={18} /></button>
          <img src={bpLogo} alt="Oto AI" className="w-9 h-9 rounded-lg object-cover border border-[#2E2E2E] shrink-0" />
          <span className="font-semibold text-[17px] tracking-tight hidden sm:inline text-[#ECECEC]">Oto AI</span>
          <span className="hidden sm:inline text-[10px] tracking-[0.18em] bg-[#262625] px-2.5 py-1 rounded-full border border-[#2E2E2E] font-semibold text-[#9A9A98]">BETA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-2 bg-[#262625] rounded-full px-3.5 py-1.5 text-xs border border-[#2E2E2E] text-[#9A9A98]">
            <Zap size={14} className="text-[#D97A4D]" /> {generations} / 10 Free Generations <span className="bg-[#B25730] px-2.5 py-0.5 rounded-full text-white font-medium ml-1">Pro</span>
          </div>
          <div className="flex lg:hidden items-center gap-1.5 bg-[#262625] rounded-full px-2.5 py-1.5 text-[11px] border border-[#2E2E2E] text-[#9A9A98]"><Zap size={12} className="text-[#D97A4D]" />{generations}/10</div>
          <button onClick={() => setShowVault(true)} className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#262625] border border-[#2E2E2E] hover:bg-[#2E2E2E] text-xs font-medium text-[#ECECEC]"><Bookmark size={14} /> Saved {vault.length}</button>
          <button onClick={() => setShowVault(true)} className="sm:hidden p-2.5 rounded-lg bg-[#262625] border border-[#2E2E2E]"><History size={16} /></button>
          <button onClick={newChat} className="hidden sm:flex items-center gap-2 text-sm py-2 px-4 rounded-full bg-[#B25730] hover:bg-[#8F441F] text-white font-medium"><Plus size={16} /> New Prompt</button>
          <button onClick={newChat} className="sm:hidden p-2.5 rounded-full bg-[#B25730] hover:bg-[#8F441F] text-white"><Plus size={16} /></button>
          <button onClick={() => setShowAuth(true)} className="w-9 h-9 rounded-full bg-[#B25730] flex items-center justify-center ml-1 overflow-hidden border border-[#8F441F]">
            {user ? <span className="text-xs font-bold text-white">{user.name.slice(0, 1).toUpperCase()}</span> : <User size={14} className="text-white" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/50" />
            <motion.div initial={{ x: -340 }} animate={{ x: 0 }} exit={{ x: -340 }} transition={{ duration: 0.2 }} className="fixed left-0 top-0 bottom-0 z-40 w-[340px] bg-[#1E1E1E] !rounded-none !border-y-0 !border-l-0 flex flex-col overflow-hidden border-r border-[#2E2E2E]">
              <div className="relative p-4 flex items-center justify-between border-b border-[#2E2E2E]">
                <span className="font-semibold flex items-center gap-2 text-[#ECECEC]"><span className="w-7 h-7 rounded-lg bg-[#262625] flex items-center justify-center border border-[#2E2E2E]"><History size={14} /></span> History</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg bg-[#262625] hover:bg-[#2E2E2E] border border-[#2E2E2E]"><X size={14} /></button>
              </div>
              <div className="relative p-3">
                <button onClick={newChat} className="w-full justify-center rounded-xl py-2.5 px-4 bg-[#B25730] hover:bg-[#8F441F] text-white font-medium flex items-center gap-2"><Plus size={16} />+ New Chat</button>
                <div className="mt-3 relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A98]" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search chats" className="w-full bg-[#262625] rounded-full pl-9 pr-3 py-2.5 text-xs placeholder:text-[#9A9A98] outline-none border border-[#2E2E2E] focus:border-[#B25730]" />
                </div>
              </div>
              <div className="relative flex-1 overflow-y-auto px-3 pb-4 space-y-5">
                {filteredBySearch.length === 0 ? <p className="text-xs text-[#9A9A98] text-center mt-10 bg-[#262625] rounded-xl py-6 mx-2 border border-[#2E2E2E]">{chats.length === 0 ? "No chats yet. Start a new prompt." : "No matches for \"" + searchQuery + "\""}</p> : (
                  <div className="space-y-5">
                    {[["Today", today], ["Previous 7 Days", week], ["Older", older] as const].map(([label, list]: any) => list.length > 0 && (
                      <div key={label as string}>
                        <div className="text-[10px] tracking-[0.16em] text-[#9A9A98] font-semibold mb-2 px-2">{label as string}</div>
                        <div className="space-y-1.5">
                          {list.map((c: ChatSession) => (
                            <div key={c.id} className={cn("group flex items-center gap-2 px-3 py-3 rounded-xl border cursor-pointer", activeId === c.id ? 'bg-[#B25730] text-white border-[#8F441F]' : 'bg-[#262625] border-[#2E2E2E] hover:bg-[#2E2E2E] text-[#ECECEC]')}>
                              <button onClick={() => loadChat(c.id)} className="flex-1 text-left min-w-0">
                                {editingId === c.id ? (
                                  <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') renameChat(c.id); if (e.key === 'Escape') setEditingId(null) }} onBlur={() => renameChat(c.id)} className="w-full bg-transparent outline-none text-xs border-b border-[#9A9A98]" />
                                ) : (
                                  <>
                                    <div className="text-xs font-medium truncate">{c.title}</div>
                                    <div className={cn("text-[11px] truncate", activeId === c.id ? 'text-white/80' : 'text-[#9A9A98]')}>{c.domain || "no domain"} • {new Date(c.updatedAt).toLocaleDateString()}</div>
                                  </>
                                )}
                              </button>
                              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100">
                                <button onClick={() => { setEditingId(c.id); setEditTitle(c.title) }} className={cn("p-1.5 rounded-lg border", activeId === c.id ? 'hover:bg-black/10 border-transparent' : 'hover:bg-[#1E1E1E] border-transparent')}><Edit2 size={12} /></button>
                                <button onClick={() => deleteChat(c.id)} className={cn("p-1.5 rounded-lg border", activeId === c.id ? 'hover:bg-black/10 border-transparent' : 'hover:bg-[#1E1E1E] border-transparent hover:text-red-400')}><Trash2 size={12} /></button>
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
                <div className="relative p-3 border-t border-[#2E2E2E] flex items-center justify-between bg-[#262625] !rounded-none !border-x-0 !border-b-0">
                  <div className="flex items-center gap-2.5 min-w-0"><div className="w-8 h-8 rounded-full bg-[#B25730] flex items-center justify-center text-xs font-bold border border-[#8F441F]">{user.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><div className="text-xs font-medium truncate text-[#ECECEC]">{user.name}</div><div className="text-[11px] text-[#9A9A98] truncate">{user.email}</div></div></div>
                  <button onClick={() => setUser(null)} className="p-2 rounded-lg bg-[#1E1E1E] hover:bg-[#2E2E2E] border border-[#2E2E2E]"><LogOut size={14} /></button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col w-full max-w-[920px] mx-auto overflow-hidden">
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-8 chat-scroll scrollbar-none">
          {!hasStarted ? (
            <div className="flex flex-col items-center text-center flex-1 justify-center py-10 sm:py-16 w-full max-w-[760px] mx-auto">
              <img src={bpLogo} alt="Oto AI" className="w-14 h-14 rounded-2xl object-cover border border-[#2E2E2E] shadow-sm mb-6" />
              <h1 className="font-serif text-[36px] sm:text-[44px] font-light tracking-tight leading-[1.05] text-[#ECECEC]">
                {user?.name ? `Back at it, ${user.name.split(" ")[0]}` : "Welcome to Oto AI"}
              </h1>
              <p className="text-[#9A9A98] mt-2.5 text-[13px] font-light tracking-wide">Better prompts. Brilliant AI Outputs.</p>
              <p className="text-[#6B6B6B] mt-1 text-[12px]">What can I help you build today?</p>
              <div className="w-full mt-8 bg-[#262625] border border-[#2E2E2E] rounded-[28px] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.12)] text-left">
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder="How can I help you today?" rows={2} className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed placeholder:text-[#6B6B6B] text-[#ECECEC] min-h-[52px] max-h-32" />
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2E2E2E]/70">
                  <div className="flex items-center gap-2 relative" ref={createMenuRef}>
                    <button aria-label="Attach" className="w-8 h-8 rounded-full bg-[#1E1E1E] border border-[#2E2E2E] flex items-center justify-center text-[#9A9A98] hover:text-[#ECECEC] hover:border-[#3a3a3a] transition-colors"><Plus size={14} /></button>
                    <button onClick={() => { setDomain(null); setCreateMenuOpen(false); }} className={cn("hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors", !domain ? "bg-[#ECECEC] text-[#1E1E1E] border-[#ECECEC]" : "bg-[#1E1E1E] border-[#2E2E2E] text-[#9A9A98] hover:text-[#ECECEC] hover:border-[#3a3a3a]")}>Chat</button>
                    <div className="relative hidden sm:block">
                      <button onClick={() => setCreateMenuOpen(v => !v)} className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors", domain ? "bg-[#B25730] text-white border-[#B25730]" : "bg-[#1E1E1E] border-[#2E2E2E] text-[#9A9A98] hover:text-[#ECECEC] hover:border-[#3a3a3a]")}>CREATE <ChevronDown size={12} className={cn("transition-transform", createMenuOpen && "rotate-180")} /></button>
                      <AnimatePresence>
                        {createMenuOpen && (
                          <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.16 }} className="absolute bottom-full left-0 mb-2 w-[320px] bg-[#262625] border border-[#2E2E2E] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.4)] p-2 z-50 overflow-hidden">
                            {CATEGORIES.map(c => (
                              <button key={c.id} onClick={() => { setDomain(c.id); setCreateMenuOpen(false); showToast(`${c.label} selected`) }} className={cn("w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors border", domain === c.id ? "bg-[#2E2E2E] border-[#B25730] text-[#ECECEC]" : "bg-transparent border-transparent hover:bg-[#2E2E2E] hover:border-[#2E2E2E] text-[#ECECEC]")}>
                                <span className="w-9 h-9 rounded-lg bg-[#1E1E1E] border border-[#2E2E2E] flex items-center justify-center text-[16px] shrink-0">{c.emoji}</span>
                                <span className="flex-1 min-w-0">
                                  <span className="text-[13px] font-medium leading-none block">{c.label}</span>
                                  <span className="text-[11px] text-[#9A9A98] leading-tight block mt-1">Optimized for {c.desc}</span>
                                </span>
                                {domain === c.id && <span className="w-2 h-2 rounded-full bg-[#B25730] mt-2 shrink-0" />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {domain && <span className="text-[11px] text-[#D97A4D] capitalize hidden lg:inline">{domain}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline text-[11px] tracking-wide font-medium text-[#9A9A98] bg-[#1E1E1E] border border-[#2E2E2E] px-2.5 py-1.5 rounded-full">Oto 1.0</span>
                    <button onClick={toggle} aria-label="Voice input" className={cn("w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-colors", listening ? 'bg-red-500 border-red-400 text-white' : 'bg-[#1E1E1E] border-[#2E2E2E] text-[#9A9A98] hover:text-[#ECECEC] hover:border-[#3a3a3a]')}><span className="flex items-center justify-center w-5 h-5">{listening ? <MicOff size={16} /> : <Mic size={16} />}</span></button>
                    <button onClick={() => handleSend()} aria-label="Send" className="w-9 h-9 rounded-full bg-[#B25730] hover:bg-[#8F441F] text-white shrink-0 flex items-center justify-center transition-colors"><Send size={16} /></button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5 text-xs flex-wrap justify-center max-w-2xl">
                {["A cyberpunk street market", "E-commerce shoe store", "Cinematic drone over Iceland"].map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="px-3.5 py-2 rounded-full bg-[#262625] border border-[#2E2E2E] hover:bg-[#2E2E2E] text-[#9A9A98] hover:text-[#ECECEC] transition-colors">{s}</button>
                ))}
              </div>
              <p className="text-[11px] text-[#6B6B6B] mt-6">Powered by CREATE framework • Beta 2.0</p>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map(m => (
                <div key={m.id} className={cn("flex", m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'user' ? (
                    <div className="max-w-[82%] bg-[#2E2E2E] text-[#ECECEC] px-5 py-3.5 rounded-xl border border-[#3a3a3a]">
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap"><BoldText text={m.text} domain={m.domain} /></p>
                    </div>
                  ) : (
                    <div className="w-full py-2 px-1">
                      <p className="text-[15px] leading-[1.7] whitespace-pre-wrap text-[#ECECEC]"><BoldText text={m.text} domain={m.domain} /></p>
                      {m.clarify && (
                        <div className={cn("mt-4 space-y-4", m.clarifyConsumed && "opacity-60 pointer-events-none")}>
                          {m.clarify.map((q, qi) => (
                            <div key={qi} className="bg-[#262625] rounded-xl p-3.5 border border-[#2E2E2E]">
                              <div className="text-sm font-medium text-[#ECECEC]">{qi + 1}. {q.question} {m.clarifyConsumed && <span className="ml-2 text-xs text-[#9A9A98]">(answered)</span>}</div>
                              <div className="flex flex-wrap gap-2 mt-2.5">
                                {(q.pills || (q as any).answers || (q as any).options || []).map((p: string) => (
                                  <button key={p} disabled={!!m.clarifyConsumed} onClick={() => !m.clarifyConsumed && pickPill(qi, p)} className={cn("px-3.5 py-1.5 rounded-full text-xs border", clarifyAnswers[qi] === p ? 'bg-[#B25730] text-white border-[#B25730] font-medium' : 'bg-[#1E1E1E] hover:bg-[#2E2E2E] border-[#2E2E2E] text-[#9A9A98] hover:text-[#ECECEC]', m.clarifyConsumed && "opacity-50 cursor-not-allowed")}>{p}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                          <button onClick={handleCompile} disabled={!!m.clarifyConsumed} className={cn("w-full sm:w-auto justify-center rounded-full px-5 py-2.5 bg-[#B25730] hover:bg-[#8F441F] text-white font-medium flex items-center gap-2", m.clarifyConsumed && "opacity-50 pointer-events-none")}><Sparkle size={14} /> Generate Oto AI <Send size={14} /></button>
                        </div>
                      )}
                      {m.result && (
                        <ResultCard messageId={m.id} result={m.result} domain={m.domain as Domain} onCopy={copy} onSave={save} onRegenerate={handleRegenerate} tweakFor={tweakFor} setTweakFor={setTweakFor} tweakInputs={tweakInputs} setTweakInputs={setTweakInputs} onTweak={handleTweak} />
                      )}
                    </div>
                  )}
                </div>
              ))}
              {streamText && (
                <div className="bg-[#262625] rounded-xl p-5 border border-[#2E2E2E]">
                  <div className="flex items-center gap-2 text-xs text-[#9A9A98] mb-2"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> Oto AI is crafting…</div>
                  <p className="mono text-sm whitespace-pre-wrap leading-relaxed text-[#ECECEC]">{streamText}</p>
                </div>
              )}
              <div ref={endRef} className="h-1" />
            </div>
          )}
        </div>

        {hasStarted ? (
          <div className="shrink-0 p-4 sm:p-6 bg-[#1E1E1E] pt-6">
            <div className="bg-[#262625] rounded-xl p-2 flex items-center gap-2 border border-[#2E2E2E] focus-within:border-[#B25730] relative">
              <div className="hidden sm:flex items-center gap-2 shrink-0" ref={createMenuRefBottom}>
                <button onClick={() => { setDomain(null); setCreateMenuOpen(false) }} className={cn("px-3 py-2 rounded-full text-xs font-medium border transition-colors", !domain ? "bg-[#ECECEC] text-[#1E1E1E] border-[#ECECEC]" : "bg-[#1E1E1E] border-[#2E2E2E] text-[#9A9A98] hover:text-[#ECECEC]")}>Chat</button>
                <div className="relative">
                  <button onClick={() => setCreateMenuOpen(v => !v)} className={cn("px-3 py-2 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors", domain ? "bg-[#B25730] text-white border-[#B25730]" : "bg-[#1E1E1E] border-[#2E2E2E] text-[#9A9A98] hover:text-[#ECECEC]")}>CREATE <ChevronDown size={12} className={cn("transition-transform", createMenuOpen && "rotate-180")} /></button>
                  <AnimatePresence>
                    {createMenuOpen && (
                      <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.16 }} className="absolute bottom-full left-0 mb-2 w-[320px] bg-[#262625] border border-[#2E2E2E] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.4)] p-2 z-50 overflow-hidden">
                        {CATEGORIES.map(c => (
                          <button key={c.id} onClick={() => { setDomain(c.id); setCreateMenuOpen(false); showToast(`${c.label} selected`) }} className={cn("w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors border", domain === c.id ? "bg-[#2E2E2E] border-[#B25730] text-[#ECECEC]" : "bg-transparent border-transparent hover:bg-[#2E2E2E] text-[#ECECEC]")}>
                            <span className="w-9 h-9 rounded-lg bg-[#1E1E1E] border border-[#2E2E2E] flex items-center justify-center text-[16px] shrink-0">{c.emoji}</span>
                            <span className="flex-1 min-w-0">
                              <span className="text-[13px] font-medium leading-none block">{c.label}</span>
                              <span className="text-[11px] text-[#9A9A98] leading-tight block mt-1">Optimized for {c.desc}</span>
                            </span>
                            {domain === c.id && <span className="w-2 h-2 rounded-full bg-[#B25730] mt-2 shrink-0" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {domain && <span className="text-[11px] text-[#D97A4D] capitalize hidden lg:inline-flex items-center gap-1"><Settings2 size={10} />{domain}</span>}
              </div>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} placeholder={domain ? "Describe your idea — be vague, we'll refine it..." : "How can I help you today?"} rows={1} className="flex-1 bg-transparent outline-none resize-none py-3.5 px-3 text-sm placeholder:text-[#9A9A98] max-h-32 min-h-[44px] text-[#ECECEC]" />
              <button onClick={toggle} aria-label="Voice input" className={cn("p-3 rounded-full border shrink-0", listening ? 'bg-red-500 border-red-400 text-white' : 'bg-transparent border-transparent hover:bg-[#2E2E2E] text-[#9A9A98]')}><span className="flex items-center justify-center w-5 h-5">{listening ? <MicOff size={18} /> : <Mic size={18} />}</span></button>
              <button onClick={() => handleSend()} aria-label="Send" className="p-3 rounded-full bg-[#B25730] hover:bg-[#8F441F] text-white shrink-0 flex items-center justify-center"><Send size={18} /></button>
            </div>
            <p className="text-[11px] text-center text-[#9A9A98] mt-2.5">Oto AI can make mistakes. Verify important prompts.</p>
          </div>
        ) : (
          <div className="shrink-0 p-4 sm:p-6 bg-[#1E1E1E] pt-2">
            <p className="text-[11px] text-center text-[#6B6B6B]">Oto AI can make mistakes. Verify important prompts.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showVault && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setShowVault(false)}>
            <motion.div initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()} className="w-[460px] max-w-[92vw] bg-[#1E1E1E] !rounded-none !border-y-0 !border-r-0 h-full flex flex-col overflow-hidden border-l border-[#2E2E2E]">
              <div className="relative p-5 border-b border-[#2E2E2E] flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2 text-[#ECECEC]"><span className="w-8 h-8 rounded-lg bg-[#B25730] flex items-center justify-center"><Bookmark size={14} className="text-white" /></span> Vault — {vault.length}</h2><button onClick={() => setShowVault(false)} className="p-2 rounded-lg bg-[#262625] hover:bg-[#2E2E2E] border border-[#2E2E2E]"><X size={16} /></button></div>
              <div className="relative flex-1 overflow-y-auto p-4 space-y-3">
                {vault.length === 0 ? <p className="text-sm text-[#9A9A98] text-center mt-10 bg-[#262625] rounded-xl py-8 border border-[#2E2E2E]">No saved prompts yet.</p> : vault.map(v => (
                  <div key={v.id} className="rounded-xl p-4 bg-[#262625] border border-[#2E2E2E]">
                    <div className="text-[11px] text-[#D97A4D] capitalize tracking-wide font-medium">{v.domain} • {new Date(v.createdAt).toLocaleString()}</div>
                    <p className="mono text-xs mt-2 line-clamp-4 whitespace-pre-wrap break-words text-[#ECECEC] leading-relaxed">{v.prompt}</p>
                    <div className="flex gap-2 mt-3"><button onClick={() => copy(v.prompt)} className="text-xs bg-[#ECECEC] text-[#1E1E1E] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 font-medium"><Copy size={12} />Copy</button><button onClick={() => setVault(x => x.filter(i => i.id !== v.id))} className="text-xs bg-[#1E1E1E] border border-[#2E2E2E] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-[#2E2E2E] text-[#9A9A98]"><Trash2 size={12} />Delete</button></div>
                  </div>
                ))}
              </div>
              {vault.length > 0 && <div className="relative p-4"><button onClick={() => setVault([])} className="w-full py-2.5 rounded-full bg-[#262625] border border-[#2E2E2E] text-sm hover:bg-[#2E2E2E] text-[#ECECEC]">Clear all</button></div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuth && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAuth(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()} className="w-full max-w-[420px] bg-[#262625] rounded-xl overflow-hidden border border-[#2E2E2E] relative">
              <div className="relative p-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5"><img src={bpLogo} alt="Oto AI" className="w-9 h-9 rounded-lg object-cover border border-[#2E2E2E]" /><span className="font-semibold text-[#ECECEC]">Oto AI</span></div>
                <button onClick={() => setShowAuth(false)} className="p-2 rounded-lg bg-[#1E1E1E] hover:bg-[#2E2E2E] border border-[#2E2E2E]"><X size={16} /></button>
              </div>
              <div className="relative px-6">
                <div className="flex bg-[#1E1E1E] rounded-full p-1 border border-[#2E2E2E]">
                  <button onClick={() => setAuthTab('signin')} className={cn("flex-1 py-2 rounded-full text-sm font-medium", authTab === 'signin' ? 'bg-[#ECECEC] text-[#1E1E1E]' : 'text-[#9A9A98] hover:text-[#ECECEC]')}>Sign In</button>
                  <button onClick={() => setAuthTab('signup')} className={cn("flex-1 py-2 rounded-full text-sm font-medium", authTab === 'signup' ? 'bg-[#ECECEC] text-[#1E1E1E]' : 'text-[#9A9A98] hover:text-[#ECECEC]')}>Create Account</button>
                </div>
              </div>
              <div className="relative p-6 space-y-3">
                {authTab === 'signup' && <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Full name" className="w-full bg-[#1E1E1E] rounded-xl px-4 py-3.5 text-sm outline-none placeholder:text-[#9A9A98] focus:border-[#B25730] border border-[#2E2E2E] text-[#ECECEC]" />}
                <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" type="email" className="w-full bg-[#1E1E1E] rounded-xl px-4 py-3.5 text-sm outline-none placeholder:text-[#9A9A98] focus:border-[#B25730] border border-[#2E2E2E] text-[#ECECEC]" />
                <input value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="Password" type="password" className="w-full bg-[#1E1E1E] rounded-xl px-4 py-3.5 text-sm outline-none placeholder:text-[#9A9A98] focus:border-[#B25730] border border-[#2E2E2E] text-[#ECECEC]" />
                <button onClick={handleAuth} className="w-full justify-center rounded-full py-3.5 bg-[#B25730] hover:bg-[#8F441F] text-white font-medium">{authTab === 'signup' ? 'Create Account' : 'Sign In'}</button>
                <div className="flex items-center gap-3 py-1"><div className="flex-1 h-px bg-[#2E2E2E]" /><span className="text-xs text-[#9A9A98]">or</span><div className="flex-1 h-px bg-[#2E2E2E]" /></div>
                <button onClick={handleGoogle} className="w-full py-3.5 rounded-full bg-[#ECECEC] text-[#1E1E1E] text-sm font-medium flex items-center justify-center gap-2 hover:bg-white"><span className="w-5 h-5 rounded-full bg-white border flex items-center justify-center text-[10px] font-bold">G</span> Continue with Google</button>
                {user && <p className="text-xs text-center text-emerald-400 bg-[#1E1E1E] rounded-full py-2 border border-[#2E2E2E]">Signed in as {user.email}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }} className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-[#262625] px-5 py-2.5 rounded-full text-sm font-medium z-50 flex items-center gap-2 border border-[#2E2E2E] text-[#ECECEC]"><span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><Check size={12} className="text-white" /></span>{toast}</motion.div>}</AnimatePresence>
    </div>
  )
}

function ResultCard({ messageId, result, domain, onCopy, onSave, onRegenerate, tweakFor, setTweakFor, tweakInputs, setTweakInputs, onTweak }: { messageId: string; result: any; domain: Domain; onCopy: (s: string) => void; onSave: (s: string, d: Domain) => void; onRegenerate: () => void; tweakFor: string | null; setTweakFor: (s: string | null) => void; tweakInputs: Record<string, string>; setTweakInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>; onTweak: (id: string, prompt: string) => void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const purePrompt = (() => {
    const raw = (result.prompt || "") as string
    const marker = "PROMPT TO COPY:"
    const idx = raw.indexOf(marker)
    let p = idx !== -1 ? raw.slice(idx + marker.length).trim() : raw.trim()
    p = p.replace(/^---\s*\n?/, "").trim()
    p = p.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/,"").trim()
    if (p.startsWith('"') && p.endsWith('"') && p.length > 1) p = p.slice(1, -1).trim()
    if (p.startsWith("'") && p.endsWith("'") && p.length > 1) p = p.slice(1, -1).trim()
    return p
  })()
  const doCopy = () => { onCopy(purePrompt); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const isTweaking = tweakFor === messageId
  const curInput = tweakInputs[messageId] || ""
  return (
    <div className="mt-4">
      <div className="bg-[#262625] rounded-xl overflow-hidden border border-[#2E2E2E] relative">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1E1E1E] !rounded-none !border-x-0 !border-t-0 border-b border-[#2E2E2E] text-xs">
          <span className="flex items-center gap-2 text-[#9A9A98]"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> Oto Prompt Blueprint</span>
          <span className="text-[10px] bg-[#2E2E2E] px-2 py-1 rounded-full border border-[#3a3a3a] font-mono text-[#9A9A98]">Ready to copy</span>
        </div>
        <pre className="mono text-[13px] leading-relaxed p-4 whitespace-pre-wrap break-words text-[#ECECEC] max-h-[420px] overflow-auto">{purePrompt}</pre>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={doCopy} className="px-4 py-2 rounded-full bg-[#B25730] hover:bg-[#8F441F] text-white text-xs flex items-center gap-1.5 font-medium">{copied ? <><Check size={14} /> Copied</> : <>📋 Copy Prompt</>}</button>
        <button onClick={onRegenerate} className="px-4 py-2 rounded-full bg-[#262625] border border-[#2E2E2E] text-xs flex items-center gap-1.5 hover:bg-[#2E2E2E] text-[#ECECEC]">🔄 Regenerate</button>
        <button onClick={() => isTweaking ? setTweakFor(null) : setTweakFor(messageId)} className={cn("px-4 py-2 rounded-full border text-xs flex items-center gap-1.5", isTweaking ? 'bg-[#B25730] border-[#B25730] text-white' : 'bg-[#262625] border-[#2E2E2E] hover:bg-[#2E2E2E] text-[#ECECEC]')}><Pencil size={12} /> Tweak</button>
        <button onClick={() => onSave(purePrompt, domain!)} className="px-4 py-2 rounded-full bg-[#262625] border border-[#2E2E2E] text-xs flex items-center gap-1.5 hover:bg-[#2E2E2E] text-[#ECECEC]">💾 Save to Vault</button>
      </div>
      <AnimatePresence>{isTweaking && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mt-3 flex gap-2 bg-[#262625] border border-[#2E2E2E] rounded-xl p-2 overflow-hidden">
          <input value={curInput} onChange={e => setTweakInputs(p => ({ ...p, [messageId]: e.target.value }))} placeholder="e.g., make it more minimal, add dark mode..." className="flex-1 bg-transparent outline-none text-sm px-3 placeholder:text-[#9A9A98] text-[#ECECEC]" />
          <button onClick={() => onTweak(messageId, purePrompt)} className="py-1.5 text-xs px-4 rounded-full bg-[#B25730] hover:bg-[#8F441F] text-white font-medium">Apply</button>
        </motion.div>
      )}</AnimatePresence>
      <button onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1.5 text-xs text-[#9A9A98] hover:text-[#ECECEC]">Why this works (CREATE Breakdown) <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><ChevronDown size={14} /></span></button>
      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mt-2 grid gap-2 text-xs overflow-hidden">
          <BreakdownRow k="Context" v={result.breakdown.context} desc="Who it's for & what you're actually making." />
          <BreakdownRow k="Role" v={result.breakdown.role} desc="Which expert the AI acts as." />
          <BreakdownRow k="Execution" v={result.breakdown.execution} desc="Step-by-step instructions." />
          <BreakdownRow k="Constraints" v={result.breakdown.constraints} desc="Guardrails for quality." />
          <BreakdownRow k="Target Format" v={result.breakdown.target} desc="How the final output should look." />
        </motion.div>
      )}</AnimatePresence>
    </div>
  )
}
function BreakdownRow({ k, v, desc }: { k: string; v: string; desc: string }) {
  return <div className="bg-[#262625] rounded-xl p-3.5 border border-[#2E2E2E]"><div className="font-semibold text-[#D97A4D]">{k} <span className="font-normal text-[#9A9A98]">— {desc}</span></div><div className="text-[#ECECEC] mt-1 leading-relaxed">{v}</div></div>
}
