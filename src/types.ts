export type Domain = 'video'|'image'|'code'|null
export type MsgRole='user'|'assistant'
export interface ClarifyQ{question:string; pills:string[]}
export interface CreateResult{
  prompt:string
  breakdown:{context:string;role:string;execution:string;constraints:string;target:string}
}
export interface Message{
  id:string
  role:MsgRole
  text:string
  domain?:Domain
  clarify?:ClarifyQ[]
  result?:CreateResult
  streaming?:boolean
}
export interface VaultItem{id:string;prompt:string;domain:Domain;createdAt:number}
