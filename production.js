// PRODUCTION MODULE — Production Entry, Settings and Re-sort
function refreshResortWeights(){const customerId=$('rCustomer').value,selected=$('rWeight').value,id=$('resortId')?.value,editing=state.resorts.find(x=>x.id===id&&!x.deleted_at),rows=inventoryRows().filter(r=>r.customerId===customerId&&(r.remainingFail>0||(editing&&editing.customer_id===customerId&&editing.weight_id===r.weightId)));$('rWeight').innerHTML='<option value="">'+(customerId?'Select weight':'Select customer first')+'</option>'+rows.map(r=>{const restored=r.remainingFail+(editing&&editing.customer_id===customerId&&editing.weight_id===r.weightId?n(editing.bags):0);return `<option value="${r.weightId}" ${r.weightId===selected?'selected':''}>${fmt(r.weight)} kg — ${fmt(restored)} fail bags</option>`}).join('');updateResortCheck()}
function updateResortCheck(){const c=$('rCustomer').value,w=$('rWeight').value,id=$('resortId').value,row=inventoryRows().find(x=>x.customerId===c&&x.weightId===w),old=state.resorts.find(x=>x.id===id&&!x.deleted_at),sameOld=old&&old.customer_id===c&&old.weight_id===w,remaining=(row?.remainingFail||0)+(sameOld?n(old.bags):0),weight=row?.weight||n(weightById(w)?.weight_kg),bags=n($('rBags').value),output=n($('rActualOutput').value),difference=Math.max(0,bags-output);$('rRemaining').textContent=fmt(remaining);$('rRemainingWeight').textContent=fmt(remaining*weight)+' kg';$('rDifference').value=fmt(difference)+' bags';const invalid=!c||!w||bags<=0||bags>remaining||output<=0||output>bags;$('resortSubmit').disabled=invalid;$('resortNotice').innerHTML=!c||!w||(!bags&&!output)?'':bags>remaining?`<div class="notice bad">Re-sort Qty cannot exceed Remaining Fail Bags (${fmt(remaining)} bags).</div>`:output>bags?`<div class="notice bad">Actual Output cannot exceed the Re-sort Qty (${fmt(bags)} bags).</div>`:output<=0?'<div class="notice bad">Actual Output must be more than 0.</div>':`<div class="notice ok">After re-sort: ${fmt(remaining-bags)} fail bags remaining; ${fmt(output)} actual Pass bags will be added to Finished Goods; difference ${fmt(difference)} bags.</div>`}
function renderProduction(){let rows=state.production.filter(r=>!r.deleted_at).map(productionView).sort((a,b)=>(b.production_date+b.created_at).localeCompare(a.production_date+a.created_at));const fd=$('prodFilterDate').value,fc=$('prodFilterCustomer').value;if(fd)rows=rows.filter(r=>r.production_date===fd);if(fc)rows=rows.filter(r=>r.customer_id===fc);if(!rows.length){$('productionTable').innerHTML='<div class="empty">No Pass / Fail records.</div>';return}$('productionTable').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Shift</th><th>Customer</th><th>Pass Bags</th><th>Pass Weight</th><th>Fail Bags</th><th>Fail Weight</th><th>Total Bags</th><th>kg / Bag</th><th>Remark</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.record_number)}</td><td>${r.production_date}</td><td>${r.shift}</td><td><strong>${esc(r.customer)}</strong></td><td><span class="pill ok">${r.pass_bags}</span></td><td>${fmt(n(r.pass_bags)*r.weight)} kg</td><td><span class="pill bad">${r.fail_bags}</span></td><td>${fmt(n(r.fail_bags)*r.weight)} kg</td><td>${n(r.pass_bags)+n(r.fail_bags)}</td><td>${fmt(r.weight)}</td><td>${esc(r.remark||'-')}</td><td><div class="row-actions"><button class="icon-btn" onclick="editProduction('${r.id}')">Edit</button><button class="icon-btn" onclick="deleteProduction('${r.id}')">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`}
function renderResorts(){const rows=state.resorts.filter(r=>!r.deleted_at).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));if(!rows.length){$('resortTable').innerHTML='<div class="empty">No Re-sort records yet.</div>';return}$('resortTable').innerHTML=`<div class="table-wrap"><table style="min-width:980px"><thead><tr><th>Date / Time</th><th>Customer</th><th>kg / Bag</th><th>Re-sort Qty</th><th>Actual Output</th><th>Difference</th><th>Remark</th><th>Action</th></tr></thead><tbody>${rows.map(r=>{const input=n(r.bags),output=n(r.actual_output_bags??r.bags);return `<tr><td>${new Date(r.created_at).toLocaleString('en-MY')}</td><td><strong>${esc(customerById(r.customer_id)?.name||'Unknown')}</strong></td><td>${fmt(weightById(r.weight_id)?.weight_kg||0)}</td><td><span class="pill bad">${fmt(input)}</span></td><td><span class="pill ok">${fmt(output)}</span></td><td>${fmt(Math.max(0,input-output))}</td><td>${esc(r.remark||'-')}</td><td><div class="row-actions"><button class="icon-btn" onclick="editResort('${r.id}')">Edit</button><button class="icon-btn" onclick="deleteResort('${r.id}')">Delete</button></div></td></tr>`}).join('')}</tbody></table></div>`}
function resetResort(){ $('resortId').value='';$('rCustomer').disabled=false;$('rWeight').disabled=false;$('rCustomer').value='';$('rWeight').innerHTML='<option value="">Select customer first</option>';$('rBags').value='';$('rActualOutput').value='';$('rDifference').value='0 bags';$('rRemark').value='';$('cancelResort').hidden=true;$('resortSubmit').textContent='Confirm Re-sort';$('resortNotice').innerHTML='';updateResortCheck()}
window.editResort=id=>{const r=state.resorts.find(x=>x.id===id);if(!r)return;$('resortId').value=r.id;$('rCustomer').value=r.customer_id;refreshResortWeights();$('rWeight').value=r.weight_id;$('rBags').value=r.bags;$('rActualOutput').value=r.actual_output_bags??r.bags;$('rRemark').value=r.remark||'';$('cancelResort').hidden=false;$('resortSubmit').textContent='Save Re-sort Changes';updateResortCheck();window.scrollTo({top:0,behavior:'smooth'})}
window.deleteResort=async id=>{if(!confirm('Delete this Re-sort record? Its Fail deduction and Finished Goods output will be reversed.'))return;const {error}=await cloud.from('resort_transactions').update({deleted_at:new Date().toISOString(),deleted_by:currentProfile.id}).eq('id',id);if(error)return alert(error.message);if($('resortId').value===id)resetResort();await loadCloudData();if(currentProfile.role==='admin')loadAudit()}
function updatePTotal(){$('pTotal').value=n($('pPass').value)+n($('pFail').value)+' bags'}
async function productionSubmit(e){e.preventDefault();if(!currentProfile||!['admin','supervisor','production'].includes(currentProfile.role))return alert('No permission.');const id=$('productionId').value,payload={production_date:$('pDate').value,shift:$('pShift').value,customer_id:$('pCustomer').value,pass_bags:n($('pPass').value),fail_bags:n($('pFail').value),weight_id:$('pWeight').value,remark:$('pRemark').value.trim()||null};if(!payload.customer_id||!payload.weight_id)return alert('Please select customer and net weight.');if(payload.pass_bags+payload.fail_bags<=0)return alert('Pass Bags and Fail Bags cannot both be empty or 0.');const btn=e.submitter;btn.disabled=true;btn.textContent='Saving…';const q=id?cloud.from('production_records').update(payload).eq('id',id):cloud.from('production_records').insert(payload);const {error}=await q;btn.disabled=false;btn.textContent='Save Record';if(error)return alert(error.message);resetProduction();await loadCloudData();if(currentProfile.role==='admin')loadAudit()}
function resetProduction(){$('productionForm').reset();$('productionId').value='';$('pDate').value=today();$('pPass').value='';$('pFail').value='';$('cancelProduction').hidden=true;updatePTotal();refreshSelects()}
window.editProduction=id=>{const r=state.production.find(x=>x.id===id);if(!r)return;$('productionId').value=r.id;$('pDate').value=r.production_date;$('pShift').value=r.shift;$('pCustomer').value=r.customer_id;$('pPass').value=r.pass_bags;$('pFail').value=r.fail_bags;$('pWeight').value=r.weight_id;$('pRemark').value=r.remark||'';$('cancelProduction').hidden=false;updatePTotal();document.querySelector('[data-tab="production"]').click();scrollTo({top:0,behavior:'smooth'})}
window.deleteProduction=async id=>{if(!confirm('Delete this production record? It remains in Audit Log.'))return;const {error}=await cloud.from('production_records').update({deleted_at:new Date().toISOString(),deleted_by:currentProfile.id}).eq('id',id);if(error)return alert(error.message);await loadCloudData();if(currentProfile.role==='admin')loadAudit()}
$('newCustomer').addEventListener('input',e=>{const pos=e.target.selectionStart;e.target.value=e.target.value.toUpperCase();e.target.setSelectionRange(pos,pos)});$('addCustomer').onclick=async()=>{const name=$('newCustomer').value.trim().toUpperCase();if(!name)return;const duplicate=state.customers.some(c=>c.name.toUpperCase()===name);if(duplicate)return alert('Customer already exists.');const {error}=await cloud.from('customers').insert({name});if(error)return alert(error.message);$('newCustomer').value='';await loadCloudData()}
$('addWeight').onclick=async()=>{const weight_kg=n($('newWeight').value);if(weight_kg<=0)return;const {error}=await cloud.from('weight_presets').insert({weight_kg});if(error)return alert(error.message);$('newWeight').value='';await loadCloudData()}
window.renameCustomer=async id=>{const c=customerById(id),name=prompt('Edit customer name',c?.name)?.trim().toUpperCase();if(!name||name===c.name)return;if(state.customers.some(x=>x.id!==id&&x.name.toUpperCase()===name))return alert('Customer already exists.');const {error}=await cloud.from('customers').update({name,updated_by:currentProfile.id}).eq('id',id);if(error)return alert(error.message);await loadCloudData()}
window.removeCustomer=async id=>{if(state.production.some(r=>r.customer_id===id))return alert('This customer is used in Production records and cannot be deleted. Edit the name instead.');if(!confirm('Delete this customer?'))return;const {error}=await cloud.from('customers').update({deleted_at:new Date().toISOString(),deleted_by:currentProfile.id,is_active:false}).eq('id',id);if(error)return alert(error.message);await loadCloudData()}
window.renameWeight=async id=>{const w=weightById(id),weight_kg=n(prompt('Edit net weight (kg)',w?.weight_kg));if(weight_kg<=0||weight_kg===n(w.weight_kg))return;const {error}=await cloud.from('weight_presets').update({weight_kg,updated_by:currentProfile.id}).eq('id',id);if(error)return alert(error.message);await loadCloudData()}
window.removeWeight=async id=>{if(state.production.some(r=>r.weight_id===id))return alert('This weight is used in Production records and cannot be deleted. Edit it instead.');if(!confirm('Delete this weight?'))return;const {error}=await cloud.from('weight_presets').update({deleted_at:new Date().toISOString(),deleted_by:currentProfile.id,is_active:false}).eq('id',id);if(error)return alert(error.message);await loadCloudData()}


function initProductionModule(){
  $('productionForm').addEventListener('submit',productionSubmit);
  $('cancelProduction').onclick=resetProduction;
  ['pPass','pFail'].forEach(id=>$(id).addEventListener('input',updatePTotal));

  $('rCustomer').addEventListener('change',refreshResortWeights);
  $('rWeight').addEventListener('change',updateResortCheck);
  ['rBags','rActualOutput'].forEach(id=>$(id).addEventListener('input',updateResortCheck));
  $('cancelResort').onclick=resetResort;

  $('resortForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!currentProfile||!['admin','supervisor','production'].includes(currentProfile.role)){
      return alert('No permission.');
    }

    const id=$('resortId').value;
    const customer_id=$('rCustomer').value;
    const weight_id=$('rWeight').value;
    const bags=n($('rBags').value);
    const actual_output_bags=n($('rActualOutput').value);
    const remark=$('rRemark').value.trim()||null;
    const row=inventoryRows().find(x=>x.customerId===customer_id&&x.weightId===weight_id);
    const old=state.resorts.find(x=>x.id===id&&!x.deleted_at);
    const sameOld=old&&old.customer_id===customer_id&&old.weight_id===weight_id;
    const before=(row?.remainingFail||0)+(sameOld?n(old.bags):0);

    if(!customer_id||!weight_id||bags<=0||bags>before||actual_output_bags<=0||actual_output_bags>bags){
      return updateResortCheck();
    }

    const btn=$('resortSubmit');
    btn.disabled=true;
    btn.textContent='Saving…';

    const payload={
      customer_id,
      weight_id,
      bags,
      actual_output_bags,
      remark,
      updated_at:new Date().toISOString()
    };

    const q=id
      ?cloud.from('resort_transactions').update(payload).eq('id',id)
      :cloud.from('resort_transactions').insert({...payload,created_by:currentProfile.id});

    const {error}=await q;
    if(error){
      btn.disabled=false;
      btn.textContent=id?'Save Re-sort Changes':'Confirm Re-sort';
      return alert(error.message);
    }

    await loadCloudData();
    const after=Math.max(0,before-bags);
    const difference=Math.max(0,bags-actual_output_bags);

    resetResort();
    $('resortSuccess').innerHTML=
      `<div class="success-inline">✓ Re-sort ${id?'updated':'completed'}. ${fmt(bags)} fail bags deducted; ${fmt(actual_output_bags)} actual Pass bags added to Finished Goods; difference ${fmt(difference)} bags. Remaining fail: ${fmt(after)} bags.</div>`;
    setTimeout(()=>{$('resortSuccess').innerHTML=''},4000);

    if(currentProfile.role==='admin')loadAudit();
  });

  ['prodFilterDate','prodFilterCustomer'].forEach(id=>$(id).addEventListener('input',renderProduction));
}
