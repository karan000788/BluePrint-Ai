import type { Domain, ClarifyQ, CreateResult } from "../types"

export function contextualClarify(idea:string, domain:Domain):ClarifyQ[]{
  const low=idea.toLowerCase()
  if(domain==='video'){
    const q1:ClarifyQ = low.includes("ad")||low.includes("product")
      ? {question:`What feeling should this video give about "${idea.slice(0,28)}"?`,pills:["Epic & inspiring","Cozy & friendly","Sleek & premium","Fun & energetic"]}
      : {question:`What's happening in "${idea.slice(0,26)}"?`,pills:["Slow cinematic reveal","Fast action cut","Gentle floating camera","Character walking"] }
    const q2:ClarifyQ = {question:"Where does it take place?",pills:["Golden hour outdoors","Neon city at night","Clean studio","Nature / forest"]}
    const q3:ClarifyQ = {question:"How should it look?",pills:["Realistic 4K film","Soft anime style","Vintage grain","Ultra sharp commercial"]}
    return [q1,q2,q3].slice(0,3)
  }
  if(domain==='image'){
    const q1:ClarifyQ = {question:`What's the main focus of "${idea.slice(0,26)}"?`,pills:["Close-up detail","Wide scene","Person as hero","Object on clean background"]}
    const q2:ClarifyQ = {question:"What mood or style do you want?",pills:["Warm & dreamy","Bold & colorful","Minimal & clean","Dark & moody"]}
    const q3:ClarifyQ = {question:"Where will you use it?",pills:["Instagram post","Poster / print","Website hero","Phone wallpaper"]}
    return [q1,q2,q3]
  }
  const isShop=low.includes("shop")||low.includes("store")||low.includes("ecommerce")||low.includes("shoe")||low.includes("cloth")
  const isApp=low.includes("app")||low.includes("landing")||low.includes("website")||low.includes("dashboard")
  if(isShop) return [
    {question:`For "${idea.slice(0,26)}", what should customers do first?`,pills:["Browse products","See a big hero sale","Search quickly","View collections"]},
    {question:"How should it feel to shop here?",pills:["Premium & minimal","Colorful & playful","Cozy & handmade","Sleek & modern"]},
    {question:"What do you want to show off?",pills:["Product photos","Reviews & trust","Fast checkout","Deals & bundles"]},
  ]
  if(isApp) return [
    {question:`What should "${idea.slice(0,24)}" help people do?`,pills:["Showcase something","Collect leads","Help users manage","Tell a story"]},
    {question:"Who is it for?",pills:["Everyday people","Shoppers","Creators","Small business"]},
    {question:"What vibe fits best?",pills:["Clean & professional","Fun & friendly","Dark & modern","Light & airy"]},
  ]
  return [
    {question:`What should "${idea.slice(0,28)}" actually do for someone?`,pills:["Create something","Organize info","Make shopping easy","Entertain / inspire"]},
    {question:"How should it look and feel?",pills:["Simple & elegant","Bold & eye-catching","Calm & friendly","Premium & sleek"]},
    {question:"Any must-have detail?",pills:["Mobile friendly","Easy to share","Super fast","With images"]},
  ]
}

function buildPrompt(idea:string, domain:Domain, answers:string[]):CreateResult{
  const d=domain||'image'
  const ans=answers.filter(Boolean).join(" • ") || "balanced pro quality defaults"
  const ctx=`You want: "${idea}". We tailored this for ${d} using your picks: ${ans}. The goal is to turn a vague wish into an exact, copy-paste prompt.`
  const role=d==='video'?"You are a world-class Sora / Runway cinematographer. You know lenses, light, and motion by heart."
    :d==='image'?"You are a Midjourney v6 / Flux art director obsessed with light, composition, and color."
    :"You are a friendly senior product builder who turns plain English into working code — no jargon needed."
  const exec=d==='video'
    ?`Take the idea and expand into: subject + action + camera (lens & move) + lighting + environment + style + time + audio hint + technical tags (--ar 16:9 --motion 4). Make it ready to paste into Sora/Runway/Pika/Luma.`
    :d==='image'
    ?`Expand into: main subject, surroundings, lighting, lens, color palette, mood, detail level + technical tags (--ar 3:2 --v 6 --style raw). Ready for Midjourney / DALL·E / Flux.`
    :`Turn the wish into a clear build plan: what the page/app does, how it looks in plain English, then provide clean, runnable code blocks (no heavy jargon, comments explain why). Include file list and how to run.`
  const constraints=d==='code'?"Keep it simple, working first-try, mobile-friendly, commented, and easy to tweak — avoid over-engineering."
    :"Keep it clean, high-detail, no blurry or warped hands, no watermark, photoreal where possible."
  const target=d==='video'?"A single copy-paste video prompt block."
    :d==='image'?"A single copy-paste image prompt block."
    :"Markdown with runnable code blocks ready for Cursor / ChatGPT / Claude."
  const prompt=d==='video'
    ?`[CREATE — ${d.toUpperCase()}]\nC: ${ctx}\nR: ${role}\nE: ${exec}\nC: ${constraints}\nT: ${target}\n\n---\nPROMPT TO COPY:\n"${idea} — filmed on ARRI Alexa 65, 35mm lens, slow push-in, ${ans}, volumetric golden-hour light, shallow depth of field, 24fps, 8K, subtle film grain, teal-orange grade, gentle wind —ar 16:9 --style cinematic --motion 4 --neg blurry,deformed,lowres"`
    :d==='image'
    ?`[CREATE — ${d.toUpperCase()}]\nC: ${ctx}\nR: ${role}\nE: ${exec}\nC: ${constraints}\nT: ${target}\n\n---\nPROMPT TO COPY:\n"${idea}, ${ans}, ultra photorealistic, 8K, soft studio light + golden rim, highly detailed, sharp focus, vibrant palette —ar 3:2 --v 6 --style raw --s 750 --chaos 6"`
    :`[CREATE — ${d.toUpperCase()}]\nC: ${ctx}\nR: ${role}\nE: ${exec}\nC: ${constraints}\nT: ${target}\n\n---\nPROMPT TO COPY:\n\`\`\`tsx\n// Build: ${idea}\n// Vibe & choices: ${ans}\n// Stack: React + Tailwind + TypeScript (simple, modern)\n// Pages: Home • Catalog • Cart • Checkout\n// Hint: Paste this whole block into Cursor/Claude — it will scaffold files, add sample data, and be runnable with npm run dev.\n\`\`\`\n`
  return {prompt,breakdown:{context:ctx,role,execution:exec,constraints,target}}
}

export function normalizeClarify(raw:any, idea:string, domain:Domain):ClarifyQ[]{
  const toPills=(v:any):string[]=>{
    if(Array.isArray(v)) return v.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,4)
    if(typeof v === 'string' && v.trim()) return v.split(/[,;|]/).map((s:string)=>s.trim()).filter(Boolean).slice(0,4)
    return []
  }
  const toQuestion=(item:any):ClarifyQ|null=>{
    if(!item || typeof item !== 'object') return null
    const question = item.question ?? item.q ?? item.text ?? item.title ?? item.prompt ?? item.label
    const pillsRaw = item.pills ?? item.options ?? item.answers ?? item.choices ?? item.alternatives ?? item.suggestions ?? item.values
    if(typeof question !== 'string' || !question.trim()) return null
    const pills = toPills(pillsRaw)
    return {question: question.trim(), pills: pills.length ? pills : contextualClarify(idea,domain)[0]?.pills ?? ["Option A","Option B","Option C"]}
  }
  try{
    let arr:any = raw
    if(typeof raw === 'string'){
      try{ const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim()); arr=parsed }catch{ arr=[] }
    }
    if(raw && typeof raw === 'object' && !Array.isArray(raw)){
      arr = raw.questions ?? raw.clarify ?? raw.data ?? raw.result ?? raw.items ?? raw.response ?? []
    }
    if(typeof arr === 'string'){
      try{ const parsed=JSON.parse(arr.replace(/```json|```/g,"").trim()); arr=parsed }catch{ arr=[] }
    }
    if(Array.isArray(arr)){
      const normalized = arr.map(toQuestion).filter(Boolean) as ClarifyQ[]
      if(normalized.length) return normalized.slice(0,3)
    }
  }catch{}
  return contextualClarify(idea,domain)
}

function safeParseJson(text:string):any{
  try{ return JSON.parse(text.replace(/```json|```/g,"").trim()) }catch{ return null }
}

export async function generateClarify(idea:string, domain:Domain):Promise<ClarifyQ[]>{
  try{
    try{
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const r=await fetch("http://localhost:5000/api/ai/clarify",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({idea,domain}),
        signal: controller.signal
      })
      clearTimeout(timeoutId);
      if(r.ok){
        let j:any=null
        try{ j=await r.json() }catch{ j=null }
        if(j){
          const normalized = normalizeClarify(j, idea, domain)
          const rawArr = Array.isArray(j)?j: j?.questions??j?.clarify??j?.data??[]
          const isFallback = Array.isArray(rawArr) && rawArr.length===0
          if(normalized.length && !isFallback) return normalized
          if(normalized.length) return normalized
        }
      } else {
        console.warn("Primary clarify API failed, using fallback.")
      }
    }catch(e){
      console.warn("Primary clarify API failed, using fallback.");
    }
    
    const key=import.meta.env.VITE_OPENAI_KEY
    if(key){
      try{
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const r=await fetch("https://api.openai.com/v1/chat/completions",{
          method:"POST",
          headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
          body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:`You are Blueprint AI clarification engine. CRITICAL RULES: 1) Read the user's exact idea and make questions SPECIFIC to it. 2) NEVER ask generic developer questions like "What is your tech stack?" "Write a CRUD app?" "API only?" 3) Always 2-3 simple, non-technical, human-friendly questions a 12-year-old would understand. 4) Each question must reference what they typed. 5) Pills are short click-options (2-3 words) plain English. Return ONLY JSON array [{question,pills:[]}] for domain ${domain}.`},{role:"user",content:idea}],temperature:0.8}),
          signal: controller.signal
        })
        clearTimeout(timeoutId);
        let j:any=null
        try{ j=await r.json() }catch{ j=null }
        const c=j?.choices?.[0]?.message?.content
        if(c){ 
          const parsed=safeParseJson(c)
          if(parsed){
            const normalized = normalizeClarify(parsed, idea, domain)
            if(normalized.length) return normalized
          }
        }
      }catch{}
    }
    
    const local=localStorage.getItem("blueprint_endpoint")
    if(local){
      try{
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const r=await fetch(`${local}/api/generate`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({model:"deepseek-r1:1.5b",prompt:`clarify non-technical ${domain}: ${idea}`,stream:false}),
          signal: controller.signal
        })
        clearTimeout(timeoutId);
        let j:any=null
        try{ j=await r.json() }catch{ j=null }
        if(j?.response){
          const parsed = safeParseJson(j.response) ?? j.response
          const normalized = normalizeClarify(parsed, idea, domain)
          if(normalized.length) return normalized;
        }
      }catch{}
    }
  }catch{}
  try{
    return normalizeClarify(contextualClarify(idea,domain), idea, domain)
  }catch{
    return contextualClarify(idea,domain)
  }
}

export async function generateFinal(idea:string, domain:Domain, answers:string[]):Promise<CreateResult>{
  const key=import.meta.env.VITE_OPENAI_KEY
  if(key){
    try{
      const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:"You are Blueprint AI CREATE engine. Output JSON {prompt,breakdown:{context,role,execution,constraints,target}} hyper-detailed but non-technical where possible. Prompt must be copy-paste ready."},{role:"user",content:`idea:${idea} domain:${domain} answers:${answers.join(",")}`}],temperature:0.85})})
      const j=await r.json()
      const c=j.choices?.[0]?.message?.content
      if(c) return JSON.parse(c.replace(/```json|```/g,""))
    }catch{}
  }
  await new Promise(r=>setTimeout(r,800))
  return buildPrompt(idea,domain,answers)
}

export async function tweakPrompt(original:string, instruction:string):Promise<string>{
  const key=import.meta.env.VITE_OPENAI_KEY
  if(key){
    try{
      const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:"Tweak the prompt per instruction. Return only the new prompt."},{role:"user",content:`Original:\n${original}\n\nTweak: ${instruction}`}]})})
      const j=await r.json()
      return j.choices?.[0]?.message?.content||original
    }catch{}
  }
  return original + `\n\n// Tweaked: ${instruction}\n// (Applied: adjusted tone / details per your note)`
}
