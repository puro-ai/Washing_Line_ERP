// APP BOOTSTRAP — navigation, authentication UI, sidebar and module initialization
document.querySelectorAll('.nav button').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b===btn));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id===btn.dataset.tab));
  if(btn.dataset.tab==='audit'&&currentProfile?.role==='admin')loadAudit();
});

function switchAuth(mode){
  const login=mode==='login';
  $('loginForm').hidden=!login;
  $('registerForm').hidden=login;
  $('forgotForm').hidden=true;
  $('resetPasswordForm').hidden=true;
  $('showLogin').className=login?'btn primary':'btn ghost';
  $('showRegister').className=login?'btn ghost':'btn primary';
  $('loginError').textContent='';
  $('registerMessage').textContent='';
  $('registerMessage').style.color='var(--bad)';
}
// Password recovery: Supabase sends a one-time recovery link to the registered email.
let passwordRecoveryActive = false;
function showAuthForm(name){
  for(const id of ['loginForm','registerForm','forgotForm','resetPasswordForm']) $(id).hidden=id!==name;
  $('authScreen').style.display='grid';
}
$('forgotPasswordLink').onclick=()=>{
  $('forgotEmail').value=$('loginEmail').value.trim();
  $('forgotMessage').textContent='';
  showAuthForm('forgotForm');
};
$('backToLogin').onclick=()=>switchAuth('login');
$('forgotForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=$('sendResetButton');
  btn.disabled=true;
  $('forgotMessage').textContent='';
  try{
    const redirectTo=new URL('./',window.location.href).origin+new URL('./',window.location.href).pathname;
    const {error}=await cloud.auth.resetPasswordForEmail($('forgotEmail').value.trim(),{redirectTo});
    if(error)throw error;
    $('forgotMessage').style.color='var(--good)';
    $('forgotMessage').textContent='If this email is registered, a password reset link will be sent. Check your inbox and spam folder.';
  }catch(err){
    $('forgotMessage').style.color='var(--bad)';
    $('forgotMessage').textContent=err.message;
  }finally{btn.disabled=false}
});
$('resetPasswordForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const password=$('newPassword').value;
  const msg=$('resetPasswordMessage');
  msg.style.color='var(--bad)';
  if(password.length<8||password!==$('confirmNewPassword').value){
    msg.textContent='Passwords must match and contain at least 8 characters.';
    return;
  }
  const btn=$('saveNewPassword');
  btn.disabled=true;
  try{
    const {error}=await cloud.auth.updateUser({password});
    if(error)throw error;
    $('resetPasswordForm').reset();
    await cloud.auth.signOut();
    passwordRecoveryActive=false;
    history.replaceState(null,'',location.pathname+location.search);
    switchAuth('login');
    $('loginError').style.color='var(--good)';
    $('loginError').textContent='Password updated successfully. Please sign in.';
  }catch(err){
    msg.textContent=err.message;
  }finally{btn.disabled=false}
});
function enterPasswordRecovery(){
  passwordRecoveryActive=true;
  $('resetPasswordMessage').textContent='';
  showAuthForm('resetPasswordForm');
}
// Notes UI is optional; a missing element must never break Register/Login.
const notesButton=$('developerNotesButton');
const notesDialog=$('developerNotesDialog');
if(notesButton&&notesDialog){
  notesButton.onclick=()=>notesDialog.showModal();
  $('closeDeveloperNotes').onclick=()=>notesDialog.close();
  notesDialog.addEventListener('click',e=>{if(e.target===notesDialog)notesDialog.close()});
}

$('showLogin').onclick=()=>switchAuth('login');
$('showRegister').onclick=()=>switchAuth('register');

$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  $('loginButton').disabled=true;
  $('loginButton').textContent='Signing In…';
  $('loginError').textContent='';
  const {error}=await cloud.auth.signInWithPassword({
    email:$('loginEmail').value.trim(),
    password:$('loginPassword').value
  });
  if(error)$('loginError').textContent=error.message;
  $('loginButton').disabled=false;
  $('loginButton').textContent='Sign In';
});

$('registerForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const password=$('registerPassword').value;
  if(password!==$('registerConfirm').value){
    $('registerMessage').textContent='Passwords do not match.';
    return;
  }
  const btn=$('registerButton');
  btn.disabled=true;
  btn.textContent='Registering…';
  $('registerMessage').textContent='';
  const email=$('registerEmail').value.trim().toLowerCase();
  const {data,error}=await cloud.auth.signUp({
    email,password,
    options:{data:{full_name:$('registerName').value.trim(),role:$('registerRole').value}}
  });
  if(error){
    $('registerMessage').textContent=error.message;
  }else{
    await cloud.auth.signOut();
    $('registerForm').reset();
    $('registerMessage').style.color='var(--good)';
    $('registerMessage').textContent=data.session
      ?'Registration submitted. Wait for Admin approval before signing in.'
      :'Registration submitted. Check your email if confirmation is enabled, then wait for Admin approval.';
  }
  btn.disabled=false;
  btn.textContent='Register Account';
});

const workspace=document.querySelector('.workspace');
const sidebarToggle=$('sidebarToggle');
function setSidebarCollapsed(collapsed){
  workspace.classList.toggle('sidebar-collapsed',collapsed);
  sidebarToggle.textContent=collapsed?'›':'‹';
  sidebarToggle.title=collapsed?'Expand sidebar':'Collapse sidebar';
  sidebarToggle.setAttribute('aria-label',sidebarToggle.title);
  try{localStorage.setItem('fgmsSidebarCollapsed',collapsed?'1':'0')}catch(e){}
}
try{setSidebarCollapsed(localStorage.getItem('fgmsSidebarCollapsed')==='1')}
catch(e){setSidebarCollapsed(false)}
sidebarToggle.onclick=()=>setSidebarCollapsed(!workspace.classList.contains('sidebar-collapsed'));

$('signOutButton').onclick=async()=>{
  ['loginPassword','registerPassword','registerConfirm'].forEach(id=>{if($(id))$(id).value=''});
  await cloud.auth.signOut();
  ['loginPassword','registerPassword','registerConfirm'].forEach(id=>{if($(id))$(id).value=''});
};

initProductionModule();
initDeliveryModule();
initAdministratorModule();

$('pDate').value=today();
$('dDate').value=today();
renderAll();

// Recovery tokens must not open the ERP or load a profile before a new password is set.
// Supabase recovery redirects can use an implicit URL hash or a PKCE ?code=.
// Capture the recovery marker before Supabase consumes/removes URL fragments.
const initialHash=new URLSearchParams(location.hash.replace(/^#/,''));
const initialQuery=new URLSearchParams(location.search);
const recoveryLink=initialHash.get('type')==='recovery'||initialQuery.get('type')==='recovery';
const recoveryError=initialHash.get('error_description')||initialQuery.get('error_description');
if(recoveryLink)passwordRecoveryActive=true;
if(recoveryError){
  $('loginError').textContent=decodeURIComponent(recoveryError.replace(/\+/g,' '));
}
cloud.auth.onAuthStateChange((event,s)=>{
  if(event==='PASSWORD_RECOVERY'){
    enterPasswordRecovery();
    return;
  }
  if(passwordRecoveryActive){
    // When a recovery session is established, show the new-password form.
    if(s)enterPasswordRecovery();
    return;
  }
  setTimeout(()=>handleSession(s),0);
});
cloud.auth.getSession().then(({data,error})=>{
  if(passwordRecoveryActive){
    if(data?.session)enterPasswordRecovery();
    else{
      showAuthForm('loginForm');
      $('loginError').textContent=error?.message||'The reset link is invalid or expired. Please request a new password reset email.';
      passwordRecoveryActive=false;
    }
  }else if(!recoveryError)handleSession(data.session);
});

if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));
}
if('caches' in window){
  caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));
}
