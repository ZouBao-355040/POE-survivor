import {versionCompare} from './checkpoint.mjs?v=0.5.31';

export const buildVersion='0.5.31';
export function versionCheck({read,show,now=()=>Date.now(),cooldown=60000,build=buildVersion}){
 let last=-Infinity,inflight=null,dismissed=null;
 return {
  check(){
   if(inflight)return inflight;
   const t=now();
   if(t-last<cooldown)return Promise.resolve(null);
   last=t;
   inflight=Promise.resolve().then(read).then(meta=>{
    const version=meta?.version;
    if(versionCompare(version,build)>0&&version!==dismissed){show(version);return version;}
    return null;
   }).catch(()=>null).finally(()=>{inflight=null;});
   return inflight;
  },
  dismiss(version){dismissed=version;}
 };
}
