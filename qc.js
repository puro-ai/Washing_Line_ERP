(() => {
const qcState={projects:[],columns:[],files:[],currentFile:null,currentRows:[],builderColumns:[]};
let qcAutoSaveTimer=null;
let qcSaveInFlight=false;
let qcSavePending=false;
const canSetup=()=>currentProfile&&['admin','supervisor'].includes(currentProfile.role);
const canQC=()=>currentProfile&&['admin','supervisor','qc'].includes(currentProfile.role);
const qEsc=v=>esc(v); const uid=()=>currentProfile?.id;
const operatorOptions=['none','>','<','>=','<=','=','!=','between','outside'];
const opLabel={'>':'>','<':'<','>=':'≥','<=':'≤','=':'=','!=':'≠','between':'BETWEEN','outside':'OUTSIDE','none':'NO RULE'};
const opHuman={'>':'Greater Than','<':'Less Than','>=':'Greater Than or Equal To','<=':'Less Than or Equal To','=':'Equal To','!=':'Not Equal To','between':'Between','outside':'Outside','none':'No Rule'};

function qcMsg(id,msg,type='ok'){const el=$(id);if(!el)return;el.innerHTML=msg?`<div class="notice ${type}">${qEsc(msg)}</div>`:'';if(msg)setTimeout(()=>el.innerHTML='',4000)}
async function qcWriteAudit(action,module,record_number,new_data=null,old_data=null){try{await cloud.from('audit_logs').insert({action,module,record_type:'qc',record_number,old_data,new_data})}catch(e){console.warn('QC audit',e)}}
function nowIso(){return new Date().toISOString()}
function formatEditorDate(v){if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`}
function editorName(){return (currentProfile?.full_name||currentProfile?.email||'').toUpperCase()}

async function loadQCProjects(){
  if(!canQC())return;
  const [p,c]=await Promise.all([
    cloud.from('qc_projects').select('*').is('deleted_at',null).eq('is_active',true).order('name'),
    cloud.from('qc_project_columns').select('*').is('deleted_at',null).order('display_order')
  ]);
  if(p.error)throw p.error;if(c.error)throw c.error;
  qcState.projects=p.data||[];qcState.columns=c.data||[];refreshQCProjectSelects();renderProjectList();
}
function refreshQCProjectSelects(){
  const opts='<option value="">Select project</option>'+qcState.projects.map(p=>`<option value="${p.id}">${qEsc(p.name)}</option>`).join('');
  if($('qcProjectSelect'))$('qcProjectSelect').innerHTML=opts;
  if($('qcFilterProject'))$('qcFilterProject').innerHTML='<option value="">All projects</option>'+qcState.projects.map(p=>`<option value="${p.id}">${qEsc(p.name)}</option>`).join('');
}
function defaultCol(){return {id:crypto.randomUUID(),column_name:'',data_type:'decimal',unit:'',decimal_places:2,pass_operator:'<=',pass_value1:'',pass_value2:'',acceptable_enabled:false,acceptable_operator:'between',acceptable_value1:'',acceptable_value2:''}}
function valueCount(op){return ['between','outside'].includes(op)?2:(op==='none'?0:1)}
function ruleText(c,prefix='pass'){
  const op=c[prefix+'_operator']||'none',a=c[prefix+'_value1'],b=c[prefix+'_value2'],u=c.unit||'';
  if(op==='none')return 'NO RULE';
  if(op==='between')return `${a}${u} – ${b}${u}`;
  if(op==='outside')return `< ${a}${u} OR > ${b}${u}`;
  return `${opLabel[op]||op} ${a}${u}`;
}
function headerPreview(c){const n=(c.column_name||'COLUMN').toUpperCase(),r=ruleText(c,'pass');return r==='NO RULE'?n:`${n} (${r})`}
function ruleSelect(prefix,c,allowNone=true){
  const opts=(allowNone?operatorOptions:operatorOptions.filter(x=>x!=='none')).map(x=>`<option value="${x}" ${c[prefix+'_operator']===x?'selected':''}>${opHuman[x]}</option>`).join('');
  return `<select data-k="${prefix}_operator">${opts}</select>`;
}
function ruleInputs(prefix,c){
  const op=c[prefix+'_operator']||'none',cnt=valueCount(op);
  if(cnt===0)return '';
  const v1=c[prefix+'_value1']??'',v2=c[prefix+'_value2']??'';
  if(cnt===1)return `<div class="smart-value"><label>Value</label><input data-k="${prefix}_value1" type="number" step="any" value="${qEsc(v1)}"></div>`;
  return `<div class="smart-value"><label>From</label><input data-k="${prefix}_value1" type="number" step="any" value="${qEsc(v1)}"></div><div class="smart-value"><label>To</label><input data-k="${prefix}_value2" type="number" step="any" value="${qEsc(v2)}"></div>`;
}
function renderBuilder(){
  const host=$('qcColumnBuilder');if(!host)return;if(!qcState.builderColumns.length)qcState.builderColumns=[defaultCol()];
  host.innerHTML=qcState.builderColumns.map((c,i)=>{
    const numeric=c.data_type!=='text';
    return `<div class="qc-column-card" data-i="${i}">
      <div class="drag-handle" draggable="true" title="Drag to reorder">☰</div>
      <div class="qc-col-main">
        <div class="smart-field"><label>Column Name</label><input data-k="column_name" value="${qEsc(c.column_name||'')}" placeholder="PVC"></div>
        <div class="smart-field"><label>Data Type</label><select data-k="data_type"><option value="integer" ${c.data_type==='integer'?'selected':''}>Integer</option><option value="decimal" ${c.data_type==='decimal'?'selected':''}>Decimal</option><option value="text" ${c.data_type==='text'?'selected':''}>Text</option></select></div>
        ${numeric?`<div class="smart-field"><label>Unit</label><input data-k="unit" value="${qEsc(c.unit||'')}" placeholder="DPPM / %"></div>`:''}
        ${c.data_type==='decimal'?`<div class="smart-field smart-small"><label>Decimals</label><input data-k="decimal_places" type="number" min="0" max="6" value="${c.decimal_places??2}"></div>`:''}
        <button class="icon-btn danger qc-remove-col" type="button" data-i="${i}">×</button>
      </div>
      ${numeric?`<div class="smart-rule-row"><div class="rule-name"><strong>PASS RULE</strong></div><div class="smart-field"><label>Condition</label>${ruleSelect('pass',c,true)}</div>${ruleInputs('pass',c)}</div>
      <div class="smart-rule-row acceptable-row"><div class="rule-name"><label class="switch-label"><input data-k="acceptable_enabled" type="checkbox" ${c.acceptable_enabled?'checked':''}> STILL ACCEPTABLE</label></div>${c.acceptable_enabled?`<div class="smart-field"><label>Condition</label>${ruleSelect('acceptable',c,false)}</div>${ruleInputs('acceptable',c)}`:''}</div>`:''}
      <div class="rule-preview"><strong>${qEsc(headerPreview(c))}</strong><span>${numeric?`PASS: ${qEsc(ruleText(c,'pass'))}${c.acceptable_enabled?` · STILL ACCEPTABLE: ${qEsc(ruleText(c,'acceptable'))}`:''}`:'TEXT COLUMN · NO QC RULE'}</span></div>
    </div>`;
  }).join('');

  host.querySelectorAll('[data-k]').forEach(el=>{
    const update=()=>{
      const row=el.closest('.qc-column-card'),i=Number(row.dataset.i),k=el.dataset.k;
      qcState.builderColumns[i][k]=el.type==='checkbox'?el.checked:el.value;
      if(['column_name','unit'].includes(k))qcState.builderColumns[i][k]=String(qcState.builderColumns[i][k]).toUpperCase();
      if(k==='data_type'&&el.value==='text'){
        Object.assign(qcState.builderColumns[i],{unit:'',decimal_places:0,pass_operator:'none',pass_value1:'',pass_value2:'',acceptable_enabled:false,acceptable_operator:'between',acceptable_value1:'',acceptable_value2:''});
      }
      if(k.endsWith('_operator')){
        const prefix=k.replace('_operator',''),cnt=valueCount(el.value);
        if(cnt<2)qcState.builderColumns[i][prefix+'_value2']='';
        if(cnt===0)qcState.builderColumns[i][prefix+'_value1']='';
      }
      renderBuilder();
    };
    el.addEventListener('change',update);
    if(['column_name','unit'].includes(el.dataset.k))el.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase();qcState.builderColumns[Number(e.target.closest('.qc-column-card').dataset.i)][e.target.dataset.k]=e.target.value});
  });
  host.querySelectorAll('.qc-remove-col').forEach(b=>b.onclick=()=>{qcState.builderColumns.splice(Number(b.dataset.i),1);renderBuilder()});
  let from=null;
  host.querySelectorAll('.qc-column-card').forEach(row=>{
    row.addEventListener('dragover',e=>{e.preventDefault();row.classList.add('drag-target')});
    row.addEventListener('dragleave',()=>row.classList.remove('drag-target'));
    row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('drag-target');const to=Number(row.dataset.i);if(from===null||from===to)return;const [x]=qcState.builderColumns.splice(from,1);qcState.builderColumns.splice(to,0,x);from=null;renderBuilder()});
  });
  host.querySelectorAll('.drag-handle').forEach(handle=>{
    const row=handle.closest('.qc-column-card');
    handle.addEventListener('dragstart',e=>{from=Number(row.dataset.i);row.classList.add('dragging');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(from))}catch(_){}});
    handle.addEventListener('dragend',()=>{from=null;host.querySelectorAll('.qc-column-card').forEach(x=>x.classList.remove('dragging','drag-target'))});
    let pointerFrom=null,pointerTarget=null;
    handle.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointerFrom=Number(row.dataset.i);pointerTarget=pointerFrom;handle.setPointerCapture?.(e.pointerId)});
    handle.addEventListener('pointermove',e=>{if(pointerFrom===null)return;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.qc-column-card');host.querySelectorAll('.qc-column-card').forEach(x=>x.classList.remove('drag-target'));if(el&&host.contains(el)){pointerTarget=Number(el.dataset.i);el.classList.add('drag-target')}});
    const finishPointer=e=>{if(pointerFrom===null)return;host.querySelectorAll('.qc-column-card').forEach(x=>x.classList.remove('drag-target'));if(pointerTarget!==null&&pointerTarget!==pointerFrom){const [x]=qcState.builderColumns.splice(pointerFrom,1);qcState.builderColumns.splice(pointerTarget,0,x)}pointerFrom=null;pointerTarget=null;try{handle.releasePointerCapture?.(e.pointerId)}catch(_){}renderBuilder()};
    handle.addEventListener('pointerup',finishPointer);
    handle.addEventListener('pointercancel',()=>{pointerFrom=null;pointerTarget=null;host.querySelectorAll('.qc-column-card').forEach(x=>x.classList.remove('drag-target'))});
  });
}
function resetBuilder(){qcState.builderColumns=[defaultCol()];$('qcProjectId').value='';$('qcProjectName').value='';$('qcProjectDescription').value='';$('qcCancelProjectEdit').hidden=true;renderBuilder()}
function validateRuleColumn(c){
  if(c.data_type==='text')return null;
  const check=(prefix,label,enabled=true)=>{if(!enabled)return null;const op=c[prefix+'_operator']||'none',cnt=valueCount(op);if(cnt>=1&&(c[prefix+'_value1']===''||c[prefix+'_value1']===null||!Number.isFinite(Number(c[prefix+'_value1']))))return `${label} needs a value.`;if(cnt===2&&(c[prefix+'_value2']===''||c[prefix+'_value2']===null||!Number.isFinite(Number(c[prefix+'_value2']))))return `${label} needs two values.`;return null};
  return check('pass','PASS rule')||check('acceptable','STILL ACCEPTABLE rule',!!c.acceptable_enabled);
}
async function saveProject(){
  if(!canSetup())return;
  const name=$('qcProjectName').value.trim().toUpperCase();$('qcProjectName').value=name;
  if(!name)return qcMsg('qcProjectMessage','Project name is required.','bad');
  if(qcState.projects.some(p=>p.name?.toUpperCase()===name&&p.id!==$('qcProjectId').value))return qcMsg('qcProjectMessage','Project name already exists.','bad');
  if(!qcState.builderColumns.length||qcState.builderColumns.some(c=>!String(c.column_name||'').trim()))return qcMsg('qcProjectMessage','Every column needs a name.','bad');
  const duplicateNames=qcState.builderColumns.map(c=>String(c.column_name).trim().toUpperCase()).filter((v,i,a)=>a.indexOf(v)!==i);if(duplicateNames.length)return qcMsg('qcProjectMessage','Column names cannot be duplicated.','bad');
  for(const c of qcState.builderColumns){const err=validateRuleColumn(c);if(err)return qcMsg('qcProjectMessage',`${c.column_name||'COLUMN'}: ${err}`,'bad')}
  const id=$('qcProjectId').value,payload={name,description:$('qcProjectDescription').value.trim()||null,is_active:true,updated_by:uid(),updated_at:nowIso()};let projectId=id;
  if(id){const old=qcState.projects.find(x=>x.id===id),{error}=await cloud.from('qc_projects').update(payload).eq('id',id);if(error)return qcMsg('qcProjectMessage',error.message,'bad');await cloud.from('qc_project_columns').update({deleted_at:nowIso()}).eq('project_id',id).is('deleted_at',null);await qcWriteAudit('UPDATE QC PROJECT','qc_project',name,payload,old)}
  else{payload.created_by=uid();const {data,error}=await cloud.from('qc_projects').insert(payload).select('id').single();if(error)return qcMsg('qcProjectMessage',error.message,'bad');projectId=data.id;await qcWriteAudit('CREATE QC PROJECT','qc_project',name,payload)}
  const rows=qcState.builderColumns.map((c,i)=>({project_id:projectId,column_name:String(c.column_name).trim().toUpperCase(),data_type:c.data_type,unit:c.data_type==='text'?null:(String(c.unit||'').trim().toUpperCase()||null),is_required:true,decimal_places:c.data_type==='decimal'?(Number(c.decimal_places)||0):0,display_order:i+1,pass_operator:c.data_type==='text'?'none':(c.pass_operator||'none'),pass_value1:c.pass_value1===''?null:Number(c.pass_value1),pass_value2:c.pass_value2===''?null:Number(c.pass_value2),acceptable_enabled:c.data_type==='text'?false:!!c.acceptable_enabled,acceptable_operator:c.acceptable_enabled?(c.acceptable_operator||null):null,acceptable_value1:c.acceptable_value1===''?null:Number(c.acceptable_value1),acceptable_value2:c.acceptable_value2===''?null:Number(c.acceptable_value2),created_by:uid()}));
  const {error:ce}=await cloud.from('qc_project_columns').insert(rows);if(ce)return qcMsg('qcProjectMessage',ce.message,'bad');
  qcMsg('qcProjectMessage','QC Project saved.');resetBuilder();await loadQCProjects();
}
function renderProjectList(){const host=$('qcProjectList');if(!host)return;if(!canSetup()){host.innerHTML='<div class="empty">Supervisor or Admin permission required.</div>';return}host.innerHTML=qcState.projects.length?qcState.projects.map(p=>{const count=qcState.columns.filter(c=>c.project_id===p.id&&!c.deleted_at).length;return `<div class="list-row"><div><strong>${qEsc(p.name)}</strong><div class="muted">${count} columns${p.description?' · '+qEsc(p.description):''}</div></div><div class="row-actions"><button class="icon-btn" onclick="window.editQCProject('${p.id}')">Edit</button><button class="icon-btn" onclick="window.deleteQCProject('${p.id}')">Delete</button></div></div>`}).join(''):'<div class="empty">No QC projects yet.</div>'}
window.editQCProject=id=>{const p=qcState.projects.find(x=>x.id===id);if(!p)return;$('qcProjectId').value=id;$('qcProjectName').value=p.name;$('qcProjectDescription').value=p.description||'';qcState.builderColumns=qcState.columns.filter(c=>c.project_id===id&&!c.deleted_at).sort((a,b)=>a.display_order-b.display_order).map(c=>({...c}));$('qcCancelProjectEdit').hidden=false;renderBuilder();document.querySelector('[data-tab="qc-projects"]').click()};
window.deleteQCProject=async id=>{if(!canSetup()||!confirm('Delete this QC project?'))return;const p=qcState.projects.find(x=>x.id===id),{error}=await cloud.from('qc_projects').update({deleted_at:nowIso(),is_active:false,updated_by:uid(),updated_at:nowIso()}).eq('id',id);if(error)return alert(error.message);await qcWriteAudit('DELETE QC PROJECT','qc_project',p?.name||id,{deleted:true});await loadQCProjects()};

function newBlankRows(count=5){return Array.from({length:count},(_,i)=>({id:null,row_no:i+1,values:{},remarks:'',editor:'',edited_at:''}))}
async function createQCFile(){
  if(!canQC())return;
  const fileName=$('qcFileNameInput').value.trim().toUpperCase(),projectId=$('qcProjectSelect').value;
  if(!fileName)return qcMsg('qcEntryMessage','File name is required.','bad');if(!projectId)return qcMsg('qcEntryMessage','Please select a QC project.','bad');
  const project=qcState.projects.find(p=>p.id===projectId),cols=qcState.columns.filter(c=>c.project_id===projectId&&!c.deleted_at).sort((a,b)=>a.display_order-b.display_order);if(!project||!cols.length)return qcMsg('qcEntryMessage','This project has no columns.','bad');
  const snapshot=cols.map(c=>({column_name:c.column_name,data_type:c.data_type,unit:c.unit,decimal_places:c.decimal_places,pass_operator:c.pass_operator,pass_value1:c.pass_value1,pass_value2:c.pass_value2,acceptable_enabled:c.acceptable_enabled,acceptable_operator:c.acceptable_operator,acceptable_value1:c.acceptable_value1,acceptable_value2:c.acceptable_value2,display_order:c.display_order}));
  const {data,error}=await cloud.rpc('create_qc_file_v2',{p_file_name:fileName,p_project_id:projectId,p_project_name:project.name,p_schema:snapshot});if(error)return qcMsg('qcEntryMessage',error.message,'bad');
  qcState.currentFile=data;qcState.currentRows=newBlankRows();$('qcFileNameInput').value='';$('qcProjectSelect').value='';renderQCEditor();await loadQCFiles();await qcWriteAudit('CREATE QC FILE','qc_file',data.file_number,{file_name:fileName,project:project.name});
}
function matchRule(op,x,a,b){a=Number(a);b=Number(b);if(op==='>')return x>a;if(op==='<')return x<a;if(op==='>=')return x>=a;if(op==='<=')return x<=a;if(op==='=')return x===a;if(op==='!=')return x!==a;if(op==='between')return x>=a&&x<=b;if(op==='outside')return x<a||x>b;if(op==='none'||!op)return true;return false}
function evaluate(col,val){if(val===null||val===undefined||String(val).trim()==='')return 'blank';if(col.data_type==='text'||col.pass_operator==='none')return 'pass';const x=Number(val);if(!Number.isFinite(x))return 'fail';if(matchRule(col.pass_operator,x,col.pass_value1,col.pass_value2))return 'pass';if(col.acceptable_enabled&&matchRule(col.acceptable_operator,x,col.acceptable_value1,col.acceptable_value2))return 'acceptable';return 'fail'}
function inputFor(col,rowIndex,value){const key=qEsc(col.column_name),v=value??'',type=['integer','decimal'].includes(col.data_type)?'number':'text',step=col.data_type==='decimal'?'any':'1';return `<input class="qc-cell" data-row="${rowIndex}" data-col="${key}" type="${type}" ${type==='number'?`step="${step}"`:''} value="${qEsc(v)}">`}
function renderQCEditor(){
  const f=qcState.currentFile;
  if(!f){if($('qcEditorCard'))$('qcEditorCard').style.display='none';if($('qcCreateCard'))$('qcCreateCard').style.display='block';if($('qcCreatePanel'))$('qcCreatePanel').style.display='flex';return}
  if($('qcCreateCard'))$('qcCreateCard').style.display='none';
  $('qcEditorCard').style.display='block';$('qcEditorTitle').textContent=f.file_name||f.project_name_snapshot||'QC File';$('qcEditorSubtitle').textContent=`${f.project_name_snapshot||''} · Scroll horizontally when the project has many columns.`;$('qcFileNumber').textContent=f.file_number;$('qcFileStatus').textContent=f.status||'draft';
  const cols=f.project_schema||[];
  $('qcGridHost').innerHTML=`<div class="qc-grid-wrap"><table class="qc-grid"><thead><tr><th class="system-col date-col">DATE</th>${cols.map(c=>`<th>${qEsc(headerPreview(c))}</th>`).join('')}<th class="system-col">PASS / FAIL</th><th class="system-col remarks-head">REMARKS</th><th class="system-col editor-head">EDITOR</th></tr></thead><tbody>${qcState.currentRows.map((r,ri)=>`<tr><td class="qc-date" data-date="${ri}">${qEsc(formatEditorDate(r.edited_at))}</td>${cols.map(c=>`<td>${inputFor(c,ri,r.values?.[c.column_name])}</td>`).join('')}<td class="qc-result" data-result="${ri}">—</td><td><input class="qc-remarks" data-row="${ri}" value="${qEsc(r.remarks||'')}"></td><td class="qc-editor" data-editor="${ri}">${qEsc(r.editor||'')}</td></tr>`).join('')}</tbody></table></div>`;
  bindGrid();refreshRowResults();
}
function touchRow(i){const row=qcState.currentRows[i];row.editor=editorName();row.edited_at=nowIso();const e=document.querySelector(`[data-editor="${i}"]`),d=document.querySelector(`[data-date="${i}"]`);if(e)e.textContent=row.editor;if(d)d.textContent=formatEditorDate(row.edited_at)}
function bindGrid(){
  document.querySelectorAll('.qc-cell').forEach(el=>{const handler=()=>{const r=Number(el.dataset.row),c=el.dataset.col;qcState.currentRows[r].values[c]=el.value;touchRow(r);refreshRowResults();scheduleQCAutoSave()};el.addEventListener('input',handler);el.addEventListener('change',handler)});
  document.querySelectorAll('.qc-remarks').forEach(el=>el.addEventListener('input',()=>{const r=Number(el.dataset.row);qcState.currentRows[r].remarks=el.value;touchRow(r);scheduleQCAutoSave()}));
}
function setQCSaveState(state,text){const el=$('qcAutoSaveStatus');if(!el)return;el.className='qc-save-status'+(state?` ${state}`:'');el.textContent=text}
function scheduleQCAutoSave(){if(!qcState.currentFile)return;setQCSaveState('saving','Saving…');qcSavePending=true;clearTimeout(qcAutoSaveTimer);qcAutoSaveTimer=setTimeout(()=>saveQCFile(true),850)}
function rowResult(row,cols){let hasFail=false,hasBlank=false,hasAcceptable=false;cols.forEach(c=>{const s=evaluate(c,row.values?.[c.column_name]);hasFail||=s==='fail';hasBlank||=s==='blank';hasAcceptable||=s==='acceptable'});return {result:hasBlank?'':hasFail?'FAIL':'PASS',hasAcceptable}}
function refreshRowResults(){
  const f=qcState.currentFile;if(!f)return;const cols=f.project_schema||[];
  qcState.currentRows.forEach((r,ri)=>{let hasFail=false,hasBlank=false;cols.forEach(c=>{const el=document.querySelector(`.qc-cell[data-row="${ri}"][data-col="${CSS.escape(c.column_name)}"]`);if(!el)return;const status=evaluate(c,r.values?.[c.column_name]);el.classList.remove('fail','acceptable');if(status==='fail')el.classList.add('fail');if(status==='acceptable')el.classList.add('acceptable');hasFail||=status==='fail';hasBlank||=status==='blank'});const result=hasBlank?'—':hasFail?'FAIL':'PASS',cell=document.querySelector(`[data-result="${ri}"]`);if(cell){cell.textContent=result;cell.className='qc-result '+(result==='PASS'?'qc-status-pass':result==='FAIL'?'qc-status-fail':'')}});
}
async function saveQCFile(auto=false){
  const f=qcState.currentFile;if(!f)return;if(qcSaveInFlight){qcSavePending=true;return}qcSaveInFlight=true;qcSavePending=false;setQCSaveState('saving','Saving…');
  try{
    const rows=qcState.currentRows.map((r,i)=>({file_id:f.id,row_no:i+1,values:{...(r.values||{}),__remarks:r.remarks||'',__editor:r.editor||'',__edited_at:r.edited_at||''},created_by:uid(),updated_by:uid(),updated_at:nowIso()}));
    const {error:delErr}=await cloud.from('qc_file_rows').update({deleted_at:nowIso(),deleted_by:uid()}).eq('file_id',f.id).is('deleted_at',null);if(delErr)throw delErr;
    const {error}=await cloud.from('qc_file_rows').insert(rows);if(error)throw error;
    await cloud.from('qc_files').update({updated_by:uid(),updated_at:nowIso()}).eq('id',f.id);
    await qcWriteAudit(auto?'AUTO SAVE QC DATA':'EDIT QC DATA','qc_file',f.file_number,{rows:rows.length});
    setQCSaveState('','Saved');
    await loadQCFiles();
  }catch(e){console.error(e);setQCSaveState('error','Save failed');qcMsg('qcSaveMessage',e.message||String(e),'bad')}finally{qcSaveInFlight=false;if(qcSavePending){clearTimeout(qcAutoSaveTimer);qcAutoSaveTimer=setTimeout(()=>saveQCFile(true),250)}}
}
async function loadQCFiles(){if(!canQC())return;const {data,error}=await cloud.from('qc_files').select('id,file_number,file_name,project_id,project_name_snapshot,project_schema,status,created_at,updated_at,created_by,profiles:created_by(full_name,email)').is('deleted_at',null).order('created_at',{ascending:false}).limit(500);if(error){if($('qcFilesTable'))$('qcFilesTable').innerHTML=`<div class="notice bad">${qEsc(error.message)}</div>`;return}qcState.files=data||[];renderQCFiles()}
function renderQCFiles(){const host=$('qcFilesTable');if(!host)return;let rows=[...qcState.files],date=$('qcFilterDate')?.value,project=$('qcFilterProject')?.value,user=($('qcFilterUser')?.value||'').toLowerCase(),search=($('qcFilterSearch')?.value||'').toLowerCase();if(date)rows=rows.filter(r=>r.created_at?.slice(0,10)===date);if(project)rows=rows.filter(r=>r.project_id===project);if(user)rows=rows.filter(r=>((r.profiles?.full_name||'')+' '+(r.profiles?.email||'')).toLowerCase().includes(user));if(search)rows=rows.filter(r=>((r.file_number||'')+' '+(r.file_name||'')).toLowerCase().includes(search));host.innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>File</th><th>File Name</th><th>Project</th><th>Created</th><th>Created By</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${qEsc(r.file_number)}</strong></td><td>${qEsc(r.file_name||'-')}</td><td>${qEsc(r.project_name_snapshot||'-')}</td><td>${new Date(r.created_at).toLocaleString('en-MY')}</td><td>${qEsc(r.profiles?.full_name||r.profiles?.email||'-')}</td><td>${qEsc(r.status||'draft')}</td><td><button class="icon-btn" onclick="window.openQCFile('${r.id}')">Open / Edit</button> <button class="icon-btn" onclick="window.exportQCFile('${r.id}','excel')">Excel</button> <button class="icon-btn" onclick="window.exportQCFile('${r.id}','pdf')">PDF</button> <button class="icon-btn danger" onclick="window.deleteQCFile('${r.id}')">Delete</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No QC files found.</div>'}
window.openQCFile=async id=>{const f=qcState.files.find(x=>x.id===id);if(!f)return;const {data,error}=await cloud.from('qc_file_rows').select('id,row_no,values').eq('file_id',id).is('deleted_at',null).order('row_no');if(error)return alert(error.message);qcState.currentFile=f;qcState.currentRows=(data&&data.length)?data.map(x=>({id:x.id,row_no:x.row_no,values:Object.fromEntries(Object.entries(x.values||{}).filter(([k])=>!k.startsWith('__'))),remarks:x.values?.__remarks||'',editor:x.values?.__editor||'',edited_at:x.values?.__edited_at||''})):newBlankRows();document.querySelector('[data-tab="qc-entry"]').click();renderQCEditor()};
window.deleteQCFile=async id=>{if(!canQC()||!confirm('Delete this QC file?'))return;const f=qcState.files.find(x=>x.id===id),now=nowIso();const {error}=await cloud.from('qc_files').update({deleted_at:now,deleted_by:uid(),updated_by:uid(),updated_at:now}).eq('id',id);if(error)return alert(error.message);await qcWriteAudit('DELETE QC FILE','qc_file',f?.file_number||id,{deleted:true});if(qcState.currentFile?.id===id){qcState.currentFile=null;renderQCEditor()}await loadQCFiles()};
window.exportQCFile=async(id,type)=>{
  const f=qcState.files.find(x=>x.id===id);if(!f)return;
  const {data,error}=await cloud.from('qc_file_rows').select('id,row_no,values').eq('file_id',id).is('deleted_at',null).order('row_no');if(error)return alert(error.message);
  const rows=(data&&data.length)?data.map(x=>({id:x.id,row_no:x.row_no,values:Object.fromEntries(Object.entries(x.values||{}).filter(([k])=>!k.startsWith('__'))),remarks:x.values?.__remarks||'',editor:x.values?.__editor||'',edited_at:x.values?.__edited_at||''})):[];
  if(type==='excel')await exportQCExcel(f,rows);else exportQCPdf(f,rows);
};
function startNewQCFile(){clearTimeout(qcAutoSaveTimer);qcSavePending=false;qcState.currentFile=null;qcState.currentRows=[];if($('qcEntryMessage'))$('qcEntryMessage').innerHTML='';renderQCEditor();$('qcFileNameInput')?.focus()}

function exportRows(file=qcState.currentFile,rows=qcState.currentRows){
  const f=file,cols=f.project_schema||[];
  return {cols,head:['DATE',...cols.map(c=>headerPreview(c)),'PASS / FAIL','REMARKS','EDITOR'],body:rows.map(r=>{const rr=rowResult(r,cols);return [formatEditorDate(r.edited_at),...cols.map(c=>r.values?.[c.column_name]??''),rr.result,r.remarks||'',r.editor||'']})};
}
async function exportQCExcel(file=qcState.currentFile,rows=qcState.currentRows){
  const f=file;if(!f)return;if(!window.ExcelJS)return alert('Excel export library is not available.');
  const {cols,head,body}=exportRows(f,rows),wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('QC',{views:[{state:'frozen',ySplit:5}]});
  ws.addRow([f.file_name||f.project_name_snapshot]);ws.addRow([`FILE: ${f.file_number}`]);ws.addRow([`PROJECT: ${f.project_name_snapshot}`]);ws.addRow([]);ws.addRow(head);
  const title=ws.getCell('A1');title.font={bold:true,size:16};ws.mergeCells(1,1,1,head.length);title.alignment={horizontal:'left'};
  ws.mergeCells(2,1,2,head.length);ws.mergeCells(3,1,3,head.length);
  const headerRow=ws.getRow(5);headerRow.height=34;headerRow.eachCell(cell=>{cell.font={bold:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEFE5DA'}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};cell.border={top:{style:'thin',color:{argb:'FFD7C7B8'}},left:{style:'thin',color:{argb:'FFD7C7B8'}},bottom:{style:'thin',color:{argb:'FFD7C7B8'}},right:{style:'thin',color:{argb:'FFD7C7B8'}}}});
  body.forEach((arr,ri)=>{const excelRow=ws.addRow(arr);excelRow.height=22;excelRow.eachCell(cell=>{cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:{style:'thin',color:{argb:'FFE7DDD4'}},left:{style:'thin',color:{argb:'FFE7DDD4'}},bottom:{style:'thin',color:{argb:'FFE7DDD4'}},right:{style:'thin',color:{argb:'FFE7DDD4'}}}});const dataRow=rows[ri];cols.forEach((c,ci)=>{const s=evaluate(c,dataRow.values?.[c.column_name]),cell=excelRow.getCell(ci+2);if(s==='fail')cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF6CACA'}};else if(s==='acceptable')cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF0A8'}}});const resultCell=excelRow.getCell(cols.length+2);if(arr[cols.length+1]==='FAIL')resultCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF6CACA'}},resultCell.font={bold:true,color:{argb:'FF9D2222'}};else if(arr[cols.length+1]==='PASS')resultCell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDFF2E5'}},resultCell.font={bold:true,color:{argb:'FF17653A'}}});
  const widths=head.map((h,i)=>{if(i===0)return 19;if(i===head.length-1)return 16;if(i===head.length-2)return 24;if(i===head.length-3)return 14;return Math.min(28,Math.max(12,String(h).length*0.85))});widths.forEach((w,i)=>ws.getColumn(i+1).width=w);ws.autoFilter={from:{row:5,column:1},to:{row:5,column:head.length}};
  const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${f.file_name||f.file_number}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);qcWriteAudit('EXPORT EXCEL','qc_file',f.file_number);
}
function exportQCPdf(file=qcState.currentFile,rows=qcState.currentRows){
  const f=file;if(!f||!window.jspdf)return alert('PDF export library is not available.');
  const {jsPDF}=window.jspdf,{cols,head,body}=exportRows(f,rows),many=head.length>12,doc=new jsPDF({orientation:'landscape',unit:'mm',format:many?'a3':'a4'});
  doc.setFontSize(15);doc.text(f.file_name||f.project_name_snapshot||'QC File',14,14);doc.setFontSize(9);doc.text(`FILE: ${f.file_number}  |  PROJECT: ${f.project_name_snapshot}`,14,20);
  doc.autoTable({startY:25,head:[head],body,theme:'grid',styles:{fontSize:many?5.5:7,cellPadding:1.5,halign:'center',valign:'middle',overflow:'linebreak'},headStyles:{fillColor:[239,229,218],textColor:[45,36,29],fontStyle:'bold'},didParseCell:(data)=>{if(data.section!=='body')return;const ri=data.row.index,ci=data.column.index,row=rows[ri];if(ci>=1&&ci<=cols.length){const s=evaluate(cols[ci-1],row.values?.[cols[ci-1].column_name]);if(s==='fail')data.cell.styles.fillColor=[246,202,202];else if(s==='acceptable')data.cell.styles.fillColor=[255,240,168]}if(ci===cols.length+1){const r=rowResult(row,cols).result;if(r==='FAIL'){data.cell.styles.fillColor=[246,202,202];data.cell.styles.textColor=[157,34,34];data.cell.styles.fontStyle='bold'}else if(r==='PASS'){data.cell.styles.fillColor=[223,242,229];data.cell.styles.textColor=[23,101,58];data.cell.styles.fontStyle='bold'}}},margin:{left:8,right:8}});
  doc.save(`${f.file_name||f.file_number}.pdf`);qcWriteAudit('EXPORT PDF','qc_file',f.file_number);
}
function hook(){
  if($('qcProjectName'))$('qcProjectName').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());if($('qcFileNameInput'))$('qcFileNameInput').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());
  if($('qcAddColumn'))$('qcAddColumn').onclick=()=>{qcState.builderColumns.push(defaultCol());renderBuilder()};if($('qcSaveProject'))$('qcSaveProject').onclick=saveProject;if($('qcCancelProjectEdit'))$('qcCancelProjectEdit').onclick=resetBuilder;if($('qcRefreshProjects'))$('qcRefreshProjects').onclick=loadQCProjects;if($('qcCreateFile'))$('qcCreateFile').onclick=createQCFile;if($('qcNewFile'))$('qcNewFile').onclick=startNewQCFile;if($('qcAddRow'))$('qcAddRow').onclick=()=>{qcState.currentRows.push({id:null,row_no:qcState.currentRows.length+1,values:{},remarks:'',editor:'',edited_at:''});renderQCEditor();scheduleQCAutoSave()};if($('qcExportXlsx'))$('qcExportXlsx').onclick=()=>exportQCExcel();if($('qcExportPdf'))$('qcExportPdf').onclick=()=>exportQCPdf();if($('qcRefreshFiles'))$('qcRefreshFiles').onclick=loadQCFiles;
  ['qcFilterDate','qcFilterProject','qcFilterUser','qcFilterSearch'].forEach(id=>{if($(id))$(id).addEventListener('input',renderQCFiles)});document.querySelectorAll('[data-tab="qc-entry"],[data-tab="qc-files"],[data-tab="qc-projects"]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='qc-files')loadQCFiles();if(btn.dataset.tab==='qc-projects')loadQCProjects()}));resetBuilder();
}
window.addEventListener('fgms:profile',async()=>{if(canQC()){await loadQCProjects();await loadQCFiles()}});document.addEventListener('DOMContentLoaded',hook);
})();
