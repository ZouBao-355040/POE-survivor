import {resolveLevelChoice} from './progression.mjs';

export const currencies=Object.freeze(['蛻變石','改造石','增幅石','點金石','富豪石']);
const weights=[.33,.32,.25,.08,.02];

export function randomCurrency(random=Math.random){
 let roll=random();
 for(let i=0;i<weights.length-1;i++){roll-=weights[i];if(roll<0)return currencies[i];}
 return currencies.at(-1);
}

export function rollCurrencyChoices(random=Math.random){
 const pool=[...currencies],choices=[];
 while(choices.length<3)choices.push(pool.splice(Math.floor(random()*pool.length),1)[0]);
 return choices;
}

export function currencyBalance(wallet,name){return Object.hasOwn(wallet??{},name)?wallet[name]:0;}
export function debitCurrency(wallet,name){
 if(!currencies.includes(name))throw new Error('未知通貨');
 const count=currencyBalance(wallet,name);
 if(count<=0)throw new Error('倉庫存量不足');
 const next={...wallet};
 const left=typeof count==='bigint'?count-1n:count-1;
 if(left===0||left===0n)delete next[name];else next[name]=left;
 return next;
}

export function creditCurrency(wallet,drops){
 const result={...wallet};
 for(const name of drops){
  if(!currencies.includes(name))throw new Error('未知通貨');
  const count=currencyBalance(result,name);
  result[name]=typeof count==='bigint'||count>=Number.MAX_SAFE_INTEGER?BigInt(count)+1n:count+1;
 }
 return result;
}

export function claimLevelCurrency(progression,wallet,choices,choice){
 if(!choices.includes(choice))throw new Error('未提供這顆通貨');
 return {progression:resolveLevelChoice(progression),wallet:creditCurrency(wallet,[choice])};
}

export function currencyDrop(kill,random=Math.random){
 if(!kill.boss&&random()>=.08)return null;
 return randomCurrency(random);
}
