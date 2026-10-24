const SUPABASE_URL='https://kzwuycfgvztlvyfbkimh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_s1rAqIVAN71PcKfEEatVIA_CpgHlF_L';
const cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id), n=v=>Number(v)||0, fmt=v=>Number(v).toLocaleString('en-MY',{maximumFractionDigits:3}), today=()=>new Date().toISOString().slice(0,10);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const state={customers:[],weights:[],production:[],deliveries:[],resorts:[]};
let currentProfile=null,realtimeChannel=null,realtimeReloadTimer=null,realtimeFallbackTimer=null;
function customerById(id){return state.customers.find(x=>x.id===id)}
function weightById(id){return state.weights.find(x=>x.id===id)}
function productionView(r){return {...r,customer:customerById(r.customer_id)?.name||'Unknown',weight:n(weightById(r.weight_id)?.weight_kg)}}
function allowedFor(role,el){return (el.dataset.roles||'admin,production,store').split(',').includes(role)}
function activateFirstAllowed(role){const btn=[...document.querySelectorAll('.nav button')].find(b=>allowedFor(role,b));if(btn)btn.click()}
function applyRoleUI(role){document.querySelectorAll('.nav button[data-roles]').forEach(b=>b.hidden=!allowedFor(role,b));const active=document.querySelector('.nav button.active');if(!active||active.hidden)activateFirstAllowed(role)}
function optionCustomers(value='',empty='Select customer'){return `<option value="">${empty}</option>`+state.customers.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${esc(x.name)}</option>`).join('')}
function optionWeights(value='',empty='Select weight'){return `<option value="">${empty}</option>`+state.weights.map(x=>`<option value="${x.id}" ${x.id===value?'selected':''}>${fmt(x.weight_kg)} kg</option>`).join('')}
function refreshSelects(){
 for(const id of ['pCustomer','dCustomer','dRecipientCustomer','prodFilterCustomer','deliveryFilterCustomer','rCustomer']){const el=$(id),old=el.value;el.innerHTML=optionCustomers(old,id.includes('Filter')?'All customers':'Select customer')}
 const old=$('pWeight').value;$('pWeight').innerHTML=optionWeights(old);
 refreshDeliveryWeights();refreshResortWeights();
}
function renderTop(){const t=today(),pr=state.production.filter(r=>!r.deleted_at&&r.production_date===t),out=pr.reduce((a,r)=>a+n(r.pass_bags)+n(r.fail_bags),0),pass=pr.reduce((a,r)=>a+n(r.pass_bags),0),fail=pr.reduce((a,r)=>a+n(r.fail_bags),0),available=inventoryRows().reduce((a,r)=>a+r.available,0);$('topToday').textContent=fmt(out);$('topPass').textContent=fmt(pass);$('topStock').textContent=fmt(available);$('prodOutput').textContent=fmt(out);$('prodPass').textContent=fmt(pass);$('prodFail').textContent=fmt(fail);$('prodRate').textContent=out?((pass/out)*100).toFixed(1)+'%':'0%'}
function renderAll(){refreshSelects();renderTop();renderProduction();renderDelivery();renderResorts();renderInventory();renderSettings();updatePTotal();updateDeliveryCheck();updateResortCheck()}
async function loadCloudData(){const [c,w,p,d,r]=await Promise.all([cloud.from('customers').select('id,name,created_at').is('deleted_at',null).eq('is_active',true).order('name'),cloud.from('weight_presets').select('id,weight_kg,created_at').is('deleted_at',null).eq('is_active',true).order('weight_kg'),cloud.from('production_records').select('id,record_number,production_date,shift,customer_id,pass_bags,fail_bags,weight_id,remark,version,created_at,updated_at,deleted_at').is('deleted_at',null).order('production_date',{ascending:false}).order('created_at',{ascending:false}),cloud.from('delivery_records').select('id,record_number,delivery_date,customer_id,bags,weight_id,delivered_to_customer_id,reference,remark,version,created_at,updated_at,deleted_at').is('deleted_at',null).order('delivery_date',{ascending:false}).order('created_at',{ascending:false}),cloud.from('resort_transactions').select('id,customer_id,weight_id,bags,actual_output_bags,remark,created_at,updated_at,deleted_at').is('deleted_at',null).order('created_at',{ascending:false})]);for(const x of [c,w,p,d,r])if(x.error)throw x.error;state.customers=c.data||[];state.weights=w.data||[];state.production=p.data||[];state.deliveries=d.data||[];state.resorts=r.data||[];renderAll()}
async function writeLoginAudit(){await cloud.from('audit_logs').insert({action:'LOGIN',module:'authentication',record_type:'session',new_data:{user_agent:navigator.userAgent}})}
async function loadProfile(user){const {data,error}=await cloud.from('profiles').select('id,email,full_name,employee_id,role,status,last_login_at').eq('id',user.id).single();if(error)throw new Error(error.message);if(data.status!=='active'){await cloud.auth.signOut();const messages={pending:'Your account is waiting for Admin approval.',disabled:'This account is disabled. Please contact an Administrator.',deleted:'This account has been deleted. Please contact an Administrator.'};throw new Error(messages[data.status]||'This account is not active.')}currentProfile=data;$('currentUserName').textContent=data.full_name||data.email;$('currentRole').textContent=data.role;$('accountAvatar').textContent=(data.full_name||data.email||'U').trim().charAt(0).toUpperCase();$('userBox').style.display='flex';applyRoleUI(data.role);await cloud.rpc('mark_login');await writeLoginAudit();if(data.role!=='qc'){await loadCloudData();subscribeRealtime()}if(data.role==='admin'){await loadUsers();await loadAudit()} window.dispatchEvent(new CustomEvent('fgms:profile',{detail:data}))}
async function handleSession(session){if(!session){currentProfile=null;$('authScreen').style.display='grid';$('userBox').style.display='none';if(realtimeChannel){await cloud.removeChannel(realtimeChannel);realtimeChannel=null}stopRealtimeFallback();return}try{await loadProfile(session.user);$('authScreen').style.display='none'}catch(err){$('loginError').textContent=err.message}}
function scheduleRealtimeReload(){clearTimeout(realtimeReloadTimer);realtimeReloadTimer=setTimeout(()=>loadCloudData().catch(err=>console.error('Realtime reload failed:',err)),150)}
function startRealtimeFallback(){clearInterval(realtimeFallbackTimer);realtimeFallbackTimer=setInterval(()=>{if(currentProfile&&!document.hidden)loadCloudData().catch(()=>{})},5000)}
function stopRealtimeFallback(){clearInterval(realtimeFallbackTimer);realtimeFallbackTimer=null}
function subscribeRealtime(){
 if(realtimeChannel)cloud.removeChannel(realtimeChannel);
 realtimeChannel=cloud.channel('fgms-build3-realtime-'+currentProfile.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'customers'},scheduleRealtimeReload)
  .on('postgres_changes',{event:'*',schema:'public',table:'weight_presets'},scheduleRealtimeReload)
  .on('postgres_changes',{event:'*',schema:'public',table:'production_records'},scheduleRealtimeReload)
  .on('postgres_changes',{event:'*',schema:'public',table:'delivery_records'},scheduleRealtimeReload)
  .on('postgres_changes',{event:'*',schema:'public',table:'resort_transactions'},scheduleRealtimeReload)
  .subscribe(status=>{
    console.log('FGMS Realtime status:',status);
    if(status==='SUBSCRIBED')scheduleRealtimeReload();
  });
 startRealtimeFallback();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentProfile)loadCloudData().catch(()=>{})});
window.addEventListener('focus',()=>{if(currentProfile)loadCloudData().catch(()=>{})});
async function adminManageUser(action,user_id,role=null){const {data,error}=await cloud.rpc('admin_manage_user',{p_action:action,p_user_id:user_id,p_role:role});if(error)throw new Error(error.message);if(!data?.ok)throw new Error(data?.error||'User management action failed.');return data}
