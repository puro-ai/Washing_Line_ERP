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
    const redirectTo=new URL('./?mode=reset',window.location.href).href;
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
    history.replaceState(null,'',location.pathname);
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

// Build 4.5.2: Explicit recovery destination survives Supabase redirect/PKCE.
// Wait for Supabase to process ?code= before choosing the auth screen.
const recoveryHash=new URLSearchParams(location.hash.replace(/^#/,''));
const recoveryQuery=new URLSearchParams(location.search);
const isRecoveryDestination=recoveryQuery.get('mode')==='reset'||recoveryHash.get('type')==='recovery'||recoveryQuery.get('type')==='recovery';
const recoveryFailure=recoveryHash.get('error_description')||recoveryQuery.get('error_description');
passwordRecoveryActive=isRecoveryDestination;
let recoveryResolved=false;
function recoveryFailureUI(message){
  passwordRecoveryActive=false;
  recoveryResolved=true;
  showAuthForm('loginForm');
  $('loginError').style.color='var(--bad)';
  $('loginError').textContent=message||'Reset link invalid or expired. Request a new link.';
  history.replaceState(null,'',location.pathname);
}
if(isRecoveryDestination){
  showAuthForm('resetPasswordForm');
  $('resetPasswordMessage').textContent='Verifying your reset link…';
  $('saveNewPassword').disabled=true;
}
cloud.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){
    recoveryResolved=true;
    enterPasswordRecovery();
    $('saveNewPassword').disabled=false;
    return;
  }
  if(passwordRecoveryActive){
    if(event==='SIGNED_IN'&&session){
      recoveryResolved=true;
      enterPasswordRecovery();
      $('saveNewPassword').disabled=false;
    }
    return;
  }
  setTimeout(()=>handleSession(session),0);
});
(async()=>{
  if(recoveryFailure){
    recoveryFailureUI(recoveryFailure);
    return;
  }
  if(isRecoveryDestination){
    try{
      // SDK initialize() exchanges PKCE codes automatically when detectSessionInUrl is enabled.
      // getSession() awaits the client's initialization; no early 'missing session' rejection.
      const {data,error}=await cloud.auth.getSession();
      if(error)throw error;
      if(!data?.session){
        recoveryFailureUI('The reset link is invalid or expired. Please request a new email.');
        return;
      }
      recoveryResolved=true;
      enterPasswordRecovery();
      $('saveNewPassword').disabled=false;
    }catch(err){recoveryFailureUI(err.message)}
    return;
  }
  const {data}=await cloud.auth.getSession();
  if(!passwordRecoveryActive)handleSession(data.session);
})();

if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));
}
if('caches' in window){
  caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));
}
