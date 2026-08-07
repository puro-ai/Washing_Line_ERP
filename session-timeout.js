(() => {
const LIMIT_MS=5*60*1000, WARNING_MS=30*1000;
let lastActivity=Date.now(),tick=null,warningShown=false;
function reset(){if(!currentProfile)return;lastActivity=Date.now();warningShown=false;const w=document.getElementById('sessionWarning');if(w)w.classList.remove('show')}
async function expire(){if(!currentProfile)return;try{await cloud.auth.signOut()}finally{const w=document.getElementById('sessionWarning');if(w)w.classList.remove('show')}}
function check(){if(!currentProfile)return;const idle=Date.now()-lastActivity,remain=LIMIT_MS-idle;if(remain<=0)return expire();if(remain<=WARNING_MS){warningShown=true;const w=document.getElementById('sessionWarning'),c=document.getElementById('sessionCountdown');if(w)w.classList.add('show');if(c)c.textContent=Math.max(1,Math.ceil(remain/1000))}else if(warningShown){const w=document.getElementById('sessionWarning');if(w)w.classList.remove('show');warningShown=false}}
function start(){lastActivity=Date.now();clearInterval(tick);tick=setInterval(check,1000)}
// Only clicks/taps and keyboard input count as user activity. Mouse movement and scrolling do not.
document.addEventListener('click',reset,true);document.addEventListener('keydown',reset,true);window.addEventListener('fgms:profile',start);document.addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('staySignedIn');if(b)b.onclick=reset});
})();
