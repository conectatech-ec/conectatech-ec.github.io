/** CONECTATECH 593 - observador reconstruido, sin parser ni publicador nuevo. */
var CT593_VERSION = 'CT593_OBSERVER_V1';
var CT593_BASE = 'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
var CT593_OWNER = 'conectatech.ecu@gmail.com';

function ct593Fingerprint(file) {
  return [file.id, file.version, file.modifiedTime, file.size, file.md5Checksum || ''].join('|');
}
function ct593Candidate(file, folder) {
  return !file.trashed && file.parents && file.parents.indexOf(folder) >= 0 &&
    file.owners && file.owners.some(function(o) { return o.emailAddress === CT593_OWNER; }) &&
    file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
    /^Reporte-Inventario(?: (?:al )?\d{2}-\d{2}-\d{4})?\.xlsx$/.test(file.name) &&
    /^[0-9]+$/.test(String(file.version || '')) &&
    Number(file.size) >= 100 && Number(file.size) <= 1000000 &&
    Number.isFinite(Date.parse(file.modifiedTime));
}
function ct593Terminal(receipt) {
  return receipt && (receipt.status === 'rejected' ||
    (receipt.status === 'processed' && /^[a-f0-9]{40}$/.test(receipt.published_commit || '')));
}

/** Pure orchestration with injected IO. Tests use synthetic bytes; never calls a parser. */
function ct593Scan(io) {
  var start = io.now(), result = {contract: CT593_VERSION, started_at: new Date(start).toISOString(),
    mode: io.mode, candidates: 0, downloaded: 0, submitted: 0, unchanged: 0, events: []};
  var files = io.list().filter(function(f) { return ct593Candidate(f, io.folder); });
  result.candidates = files.length;
  files.sort(function(a,b) { return Date.parse(a.modifiedTime)-Date.parse(b.modifiedTime) || a.id.localeCompare(b.id); });
  var published = io.publishedSha();
  if (!/^[a-f0-9]{64}$/.test(published || '')) throw Error('CANONICAL_SHA_REQUIRED');
  for (var i=0; i<files.length; i++) {
    if (io.now()-start > 45000 || result.downloaded>=2) { result.deferred = true; break; }
    var f=files[i], fp=ct593Fingerprint(f), cache=io.get(f.id), sha;
    if (cache && cache.fingerprint === fp) {
      sha=cache.sha256;
      if (cache.terminal || sha === published) { result.unchanged++; continue; }
      if (io.mode === 'OBSERVE') { result.unchanged++; continue; }
      var existing=io.receipt(sha);
      if (ct593Terminal(existing)) { io.put(f.id,{fingerprint:fp,sha256:sha,terminal:true}); result.unchanged++; continue; }
      if (existing && existing.lease_active) { result.events.push({sha256:sha,stage:'reserved'}); continue; }
      if (existing && existing.status === 'received') { io.retry(sha); result.events.push({sha256:sha,stage:'retry_requested'}); break; }
      // Unknown or expired receipt: safely read and resubmit the same immutable bytes.
    }
    var detected=io.now(), bytes=io.download(f.id);
    result.downloaded++;
    var after=io.metadata(f.id);
    if (!ct593Candidate(after,io.folder) || ct593Fingerprint(after)!==fp || bytes.length!==Number(f.size)) {
      result.events.push({stage:'source_changed'}); break;
    }
    sha=io.sha256(bytes);
    if (!/^[a-f0-9]{64}$/.test(sha)) throw Error('SOURCE_HASH_INVALID');
    if (f.md5Checksum && io.md5(bytes)!==f.md5Checksum) throw Error('SOURCE_CHECKSUM_MISMATCH');
    var event={sha256:sha,detected_at:new Date(detected).toISOString(),download_ms:io.now()-detected};
    if (sha===published) {
      io.put(f.id,{fingerprint:fp,sha256:sha,terminal:true});
      event.stage='already_published';result.events.push(event);continue;
    }
    if (io.mode==='OBSERVE') {
      io.put(f.id,{fingerprint:fp,sha256:sha,terminal:false});
      event.stage='observed_only';result.events.push(event);break;
    }
    var receipt=io.receipt(sha);
    if (ct593Terminal(receipt)) {
      io.put(f.id,{fingerprint:fp,sha256:sha,terminal:true});
      event.stage='known_receipt';result.events.push(event);continue;
    }
    var beforeSend=io.now(), response=io.upload(f,bytes,sha,event.detected_at);
    event.reception_ms=io.now()-beforeSend;
    if (response.busy) { event.stage='receiver_busy';result.events.push(event);break; }
    if (response.sha256!==sha || response.received!==true) throw Error('RECEIPT_IDENTITY_MISMATCH');
    io.put(f.id,{fingerprint:fp,sha256:sha,terminal:ct593Terminal(response)});
    event.stage='received';event.trigger=response.trigger||null;
    result.events.push(event);result.submitted++;
    break; // Existing single-file inbox. Leave remaining files in Drive.
  }
  result.finished_at=new Date(io.now()).toISOString();result.duration_ms=io.now()-start;
  return result;
}

function ct593Properties() { return PropertiesService.getScriptProperties(); }
function ct593Config() {
  var p=ct593Properties(), folder=p.getProperty('CT593_FOLDER_ID');
  if (!folder || !/^[A-Za-z0-9_-]{20,100}$/.test(folder)) throw Error('ENTERPRISE_FOLDER_REQUIRED');
  if (Session.getEffectiveUser().getEmail()!==CT593_OWNER) throw Error('ENTERPRISE_ACCOUNT_REQUIRED');
  var mode=p.getProperty('CT593_MODE')||'OBSERVE';
  if (['OBSERVE','LIVE'].indexOf(mode)<0) throw Error('OBSERVER_DISABLED');
  if (mode==='LIVE' && p.getProperty('CT593_ACTIVATION_READY')!==CT593_VERSION) throw Error('ACTIVATION_NOT_VERIFIED');
  return {folder:folder,mode:mode,p:p};
}
function ct593Identity() {
  var token=ScriptApp.getIdentityToken();
  if (!token) throw Error('IDENTITY_PERMISSION_REQUIRED');
  var claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());
  if (claims.email!==CT593_OWNER || claims.email_verified!==true) throw Error('ENTERPRISE_IDENTITY_REQUIRED');
  return {token:token,claims:claims};
}
function ct593Http(path, method, bytes, headers) {
  if (!/^\/commercial\/(status(?:\?sha256=[a-f0-9]{64})?|report|complete)$/.test(path)) throw Error('RECEIVER_PATH_DENIED');
  var options={method:method||'get',muteHttpExceptions:true,followRedirects:false,
    headers:Object.assign({'Authorization':'Bearer '+ct593Identity().token},headers||{})};
  if (bytes!==undefined) options.payload=bytes;
  var r=UrlFetchApp.fetch(CT593_BASE+path,options), status=r.getResponseCode(), body;
  try { body=JSON.parse(r.getContentText()); } catch(e) { throw Error('RECEIVER_RESPONSE_INVALID'); }
  if (status===404 && /^\/commercial\/status\?/.test(path)) return null;
  if (status===409 && body.error==='PREVIOUS_REPORT_PENDING') return {busy:true};
  if (status===401 && ['IDENTITY','KEY_FETCH','KEY_MISSING','KEY_IMPORT','SIGNATURE'].indexOf(body.observer_auth)>=0) throw Error('RECEIVER_AUTH_'+body.observer_auth);
  if (status<200 || status>=300) throw Error('RECEIVER_HTTP_'+status);
  return body;
}
function ct593Metadata(id) {
  return Drive.Files.get(id,{fields:'id,name,version,modifiedTime,size,md5Checksum,mimeType,trashed,parents,owners(emailAddress)'});
}
function ct593IO(config) {
  return {
    folder:config.folder,mode:config.mode,now:function(){return Date.now();},
    list:function(){
      var files=[],page;
      do {
        var args={q:"'"+config.folder+"' in parents and trashed = false",pageSize:1000,
          fields:'nextPageToken,files(id,name,version,modifiedTime,size,md5Checksum,mimeType,trashed,parents,owners(emailAddress))'};
        if(page)args.pageToken=page;
        var r=Drive.Files.list(args);files=files.concat(r.files||[]);page=r.nextPageToken;
        if(files.length>2000)throw Error('FOLDER_SCAN_LIMIT');
      } while(page);
      return files;
    },
    publishedSha:function(){
      var r=UrlFetchApp.fetch('https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/main/datos-593/estado-ultimo-corte.json?observer='+Date.now(),{muteHttpExceptions:true,followRedirects:false});
      if(r.getResponseCode()!==200)throw Error('CANONICAL_UNAVAILABLE');
      return JSON.parse(r.getContentText()).origen_sha256;
    },
    get:function(id){var v=config.p.getProperty('ct593.file.'+id);return v?JSON.parse(v):null;},
    put:function(id,v){config.p.setProperty('ct593.file.'+id,JSON.stringify(v));},
    download:function(id){return DriveApp.getFileById(id).getBlob().getBytes();},
    metadata:ct593Metadata,
    sha256:function(bytes){return ct593Digest(Utilities.DigestAlgorithm.SHA_256,bytes);},
    md5:function(bytes){return ct593Digest(Utilities.DigestAlgorithm.MD5,bytes);},
    receipt:function(sha){return ct593Http('/commercial/status?sha256='+sha);},
    retry:function(sha){return ct593Http('/commercial/complete','post',JSON.stringify({status:'retry',sha256:sha}),{'Content-Type':'application/json'});},
    upload:function(file,bytes,sha,detected){return ct593Http('/commercial/report','post',bytes,
      {'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','X-Report-Filename':encodeURIComponent(file.name),'X-Report-SHA256':sha,'X-Report-Detected-At':detected});}
  };
}
function ct593Digest(algorithm,bytes) {
  return Utilities.computeDigest(algorithm,bytes).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function observar593(event) {
  var lock=LockService.getScriptLock();
  if (!lock.tryLock(1000)) { console.log(JSON.stringify({stage:'observer_busy',at:new Date().toISOString()}));return; }
  var start=Date.now(), p=ct593Properties(), history=JSON.parse(p.getProperty('CT593_RUNTIME_24H')||'[]');
  history=history.filter(function(x){return x[0]>start-86400000;});
  var result;
  try {
    var config=ct593Config();
    if (event && event.triggerUid && event.triggerUid!==p.getProperty('CT593_TRIGGER_ID')) throw Error('UNKNOWN_TRIGGER');
    if(history.length>=320 || history.reduce(function(s,x){return s+x[1];},0)>1800000)throw Error('OBSERVER_DAILY_BUDGET');
    if(config.mode==='LIVE') {
      var status=ct593Http('/commercial/status');
      if(status.observer_contract!==CT593_VERSION || status.automatic_trigger_configured!==true)throw Error('RECEIVER_NOT_READY');
    }
    result=ct593Scan(ct593IO(config));
    result.automatic=!!(event && event.triggerUid);
    p.setProperty('CT593_LAST_RESULT',JSON.stringify(result));
    console.log(JSON.stringify(result));return result;
  } catch(e) {
    // Never log response bodies or identity tokens.
    var code=/^[A-Z0-9_]{1,80}$/.test(e.message||'')?e.message:'OBSERVER_IO_ERROR';
    p.setProperty('CT593_LAST_ERROR',JSON.stringify({code:code,at:new Date().toISOString()}));
    console.error(code);throw Error(code);
  } finally {
    if(history.length<320)history.push([start,Date.now()-start]);
    p.setProperty('CT593_RUNTIME_24H',JSON.stringify(history));
    lock.releaseLock();
  }
}
function comprobar593() {
  var config=ct593Config(), identity=ct593Identity(), folder=ct593Metadata(config.folder);
  if(folder.mimeType!=='application/vnd.google-apps.folder' || folder.trashed ||
     !folder.owners.some(function(o){return o.emailAddress===CT593_OWNER;}))throw Error('ENTERPRISE_FOLDER_IDENTITY');
  var result={contract:CT593_VERSION,mode:config.mode,owner:identity.claims.email,
    audience:identity.claims.aud,subject:identity.claims.sub,script_id:ScriptApp.getScriptId(),
    own_triggers:ScriptApp.getProjectTriggers().map(function(t){return {handler:t.getHandlerFunction(),id:t.getUniqueId()};})};
  console.log(JSON.stringify(result));return result;
}
function comprobarReceptor593() {
  ct593Config();
  var started=Date.now(), status=ct593Http('/commercial/status');
  if(status.observer_contract!==CT593_VERSION)throw Error('RECEIVER_CONTRACT_MISMATCH');
  var result={stage:'receiver_identity_verified',at:new Date().toISOString(),
    duration_ms:Date.now()-started,contract:status.observer_contract,
    automatic_trigger_configured:status.automatic_trigger_configured===true,
    pending:status.pending===true};
  console.log(JSON.stringify(result));return result;
}
function activar593() {
  var c=ct593Config();
  if(c.mode!=='LIVE')throw Error('LIVE_VERIFICATION_REQUIRED');
  var result=observar593();
  if(!result || result.mode!=='LIVE')throw Error('LIVE_PROBE_FAILED');
  var installLock=LockService.getScriptLock();
  if(!installLock.tryLock(1000))throw Error('INSTALL_BUSY');
  try {
  var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='observar593';});
  if(triggers.length>1)throw Error('DUPLICATE_TRIGGERS_REQUIRE_RECONCILIATION');
  if(triggers.length===1) {
    if(triggers[0].getUniqueId()!==c.p.getProperty('CT593_TRIGGER_ID'))throw Error('UNKNOWN_EXISTING_TRIGGER');
    return; // Never blindly add or replace another trigger.
  }
  var trigger=ScriptApp.newTrigger('observar593').timeBased().everyMinutes(5).create();
  c.p.setProperty('CT593_TRIGGER_ID',trigger.getUniqueId());
  console.log(JSON.stringify({stage:'trigger_created',id:trigger.getUniqueId(),minutes:5,at:new Date().toISOString()}));
  } finally { installLock.releaseLock(); }
}
function pausar593() { ct593Properties().setProperty('CT593_MODE','PAUSED'); }

if(typeof module!=='undefined')module.exports={ct593Scan:ct593Scan,ct593Fingerprint:ct593Fingerprint,ct593Candidate:ct593Candidate,ct593Terminal:ct593Terminal};
