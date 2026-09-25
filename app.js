(() => {
'use strict';
const API='https://truthlens-backend-2ix3.onrender.com'; const $=id=>document.getElementById(id); let imageData=''; let claims=[]; let evidence=[];
const show=id=>$(id).classList.remove('hidden'), hide=id=>$(id).classList.add('hidden');
function msg(s){$('error').textContent=s;s?show('error'):hide('error')}
function renderClaims(){const box=$('claims');box.innerHTML='';$('count').textContent=`${claims.length} claim${claims.length===1?'':'s'}`;if(!claims.length){box.innerHTML='<p class="hint">No claims yet.</p>';return}claims.forEach((c,i)=>{const row=document.createElement('div');row.className='claim';const input=document.createElement('input');input.value=c.claim||c;input.addEventListener('input',()=>claims[i]={...(typeof claims[i]==='object'?claims[i]:{}),claim:input.value});const b=document.createElement('button');b.textContent='×';b.onclick=()=>{claims.splice(i,1);renderClaims()};row.append(input,b);box.append(row)})}
function addClaim(){claims.push({claim:'New factual claim to verify',type:'factual'});renderClaims();show('claimsSection')}
function fileSelected(file){msg('');if(!file)return;if(!file.type.startsWith('image/'))return msg('Please select an image.');if(file.size>10*1024*1024)return msg('Image must be smaller than 10 MB.');const r=new FileReader();r.onload=()=>{imageData=r.result;$('preview').src=imageData;$('text').value='';show('workspace');hide('claimsSection');hide('evidenceSection');hide('reportSection')};r.readAsDataURL(file)}
async function health(){try{const r=await fetch(API+'/api/health');const x=await r.json();$('apiStatus').textContent=x.configured?'Live Gemini backend connected':'Backend found · Gemini key missing'}catch{$('apiStatus').textContent='Demo mode · backend optional'}}
async function analyze(){
  if(!imageData)return msg('Upload an image first.');

  msg('');
  $('analyzeBtn').disabled=true;
  $('analyzeBtn').textContent='Analyzing…';

  try{
    const mimeType = imageData.match(/^data:(image\/[^;]+);base64,/)?.[1] || 'image/jpeg';

    const r = await fetch(API+'/api/analyze-image',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        imageData:imageData,
        mimeType:mimeType
      })
    });

    const data = await r.json();

    if(!r.ok){
      throw new Error(data.error || 'API request failed');
    }

    $('text').value = data.text || '';
    claims = (data.claims || []).filter(
      c => c.type !== 'opinion' && c.type !== 'satire'
    );

    renderClaims();
    show('claimsSection');
    $('claimsSection').scrollIntoView({behavior:'smooth'});

  }catch(e){
    msg('Live API unavailable: '+e.message+'. You can still use the page in demo mode.');

    if(!claims.length)addClaim();

  }finally{
    $('analyzeBtn').disabled=false;
    $('analyzeBtn').textContent='Analyze image';
  }
}
async function findEvidence(){
  if(!claims.length)return msg('Add at least one claim first.');

  show('evidenceSection');
  $('evidence').innerHTML='<p class="hint">Searching…</p>';

  const all=[];

  try{
    for(const c of claims.slice(0,5)){
      const q=typeof c==='string'?c:c.claim;

      const r=await fetch(API+'/api/evidence-search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({claim:q})
      });

      const data=await r.json();

      if(!r.ok){
        throw new Error(data.error || 'Search failed');
      }

      (data.evidence || []).forEach(v=>{
        all.push({...v,claim:q});
      });
    }

    evidence=all;
    renderEvidence();

  }catch(e){
    console.error('Evidence search error:',e);

    $('evidence').innerHTML=
      '<div class="notice">Evidence search error: '+
      esc(e.message || 'Unknown error')+
      '</div>';
  }
}
function renderEvidence(){const box=$('evidence');box.innerHTML='';if(!evidence.length){box.innerHTML='<p class="hint">No evidence sources found.</p>';return}evidence.forEach((e,i)=>{const d=document.createElement('div');d.className='evidenceItem';d.innerHTML=`<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title||'Source')}</a><div class="hint">${esc(e.source||'')} · ${esc(e.published||'')}</div><p>${esc(e.snippet||'')}</p>`;box.append(d)})}
async function verify(){
  if(!claims.length){
    return msg('Add at least one claim first.');
  }

  show('reportSection');

  $('report').innerHTML =
    '<p class="hint">Verifying claims…</p>';

  try{
    if(!evidence.length){
      await findEvidence();
    }

    if(!evidence.length){
      $('report').innerHTML =
        '<div class="notice">No evidence was found to verify the claims.</div>';
      return;
    }

    const r = await fetch(API + '/api/verify',{
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        claims,
        evidence,
        language:'English'
      })
    });

    const x = await r.json();

    if(!r.ok){
      throw new Error(
        x?.error ||
        x?.message ||
        'Verification failed.'
      );
    }

    console.log('Verify response:', x);

    if(!Array.isArray(x.results)){
      throw new Error(
        'The verification API returned an unexpected response.'
      );
    }

    renderReport(x.results);

  }catch(e){
    console.error('Verification error:', e);

    $('report').innerHTML =
      '<div class="notice">Verification error: ' +
      esc(e.message || 'Unknown error') +
      '</div>';
  }
}
function renderReport(results){const box=$('report');box.innerHTML='';$('reportMode').textContent='AI analysis of supplied evidence';results.forEach(x=>{const d=document.createElement('div');d.className='result '+x.verdict;d.innerHTML=`<b>${esc(x.verdict)}</b><p>${esc(x.claim)}</p><div>${esc(x.explanation)}</div>${x.limitations?.length?'<p class="hint">Limitations: '+esc(x.limitations.join('; '))+'</p>':''}`;box.append(d)});show('reportSection');$('reportSection').scrollIntoView({behavior:'smooth'})}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
$('chooseBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>fileSelected(e.target.files[0]);$('analyzeBtn').onclick=analyze;$('manualBtn').onclick=addClaim;$('addBtn').onclick=addClaim;$('searchBtn').onclick=findEvidence;$('verifyBtn').onclick=verify;$('clearBtn').onclick=()=>{imageData='';claims=[];evidence=[];$('fileInput').value='';$('preview').removeAttribute('src');$('text').value='';hide('workspace');hide('claimsSection');hide('evidenceSection');hide('reportSection');msg('')};
const dz=$('dropzone');['dragenter','dragover'].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.style.background='#eef2ff'}));['dragleave','drop'].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.style.background=''}));dz.addEventListener('drop',e=>fileSelected(e.dataTransfer.files[0]));health();
})();
