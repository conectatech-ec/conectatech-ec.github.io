import {test} from 'node:test';import assert from 'node:assert/strict';
import {association,handoff,resolveLead} from './lead.mjs';import {prepare} from './prepare.mjs';
import candidate from './candidate.json' with {type:'json'};import library from './library-evidence.json' with {type:'json'};
import {verifyMetaSignature,normalizeEvents,prepareOfficialReply} from '../channels.mjs';
test('Published listing maps to its exact SKU without private profile access or a guessed item ID',()=>{
 assert.equal(association.sku,'TELF017');assert.equal(association.canonical_listing_id,null);assert.equal(association.personal_inbox_access_authorized,false);
 const ref=resolveLead(new URL(handoff().url).searchParams.get('text'));assert.equal(ref.requested_sku,'TELF017');assert.equal(ref.grants_sender_authorization,false);
 for(const bad of ['https://www.facebook.com/share/unknown/','https://evil.invalid/share/1H2BLNTXjW/','https://www.facebook.com/share/1H2BLNTXjW/extra'])assert.equal(resolveLead(bad),null);
 const changed=resolveLead('Quiero 256 GB. '+association.listing_url);assert.equal(changed.requested_sku,null);assert.equal(changed.needs_variant_clarification,true);
});
test('Prepared response uses the same validated central facts; stale or unavailable candidates never quote',()=>{
 const r=prepare(candidate,library);assert.equal(r.source.sha256,candidate.source.sha256);assert.equal(r.reply.banner_attachment,null);assert.equal(r.banner.delivery_enabled,false);assert.ok(r.banner.block_reasons.includes('LIBRARY_DELIVERY_NOT_RELEASED'));
 const expired=prepare(candidate,library,Date.parse(candidate.expires_at)+1);assert.equal(expired.source.fresh,false);assert.ok(!expired.reply.text.includes('$'));assert.equal(expired.banner.regeneration_required_by_price,null);
 const zero=structuredClone(candidate);zero.products[0].availability='out_of_stock';assert.ok(!prepare(zero,library).reply.text.includes('$'));
});
test('Prepared WhatsApp chain validates HMAC, correct business number, referral and 24h window; no external sender exists',async()=>{
 const now=Date.now(),body={object:'whatsapp_business_account',entry:[{id:'synthetic_WABA',changes:[{value:{metadata:{phone_number_id:'synthetic_phone'},messages:[{id:'wamid.synthetic.only',from:'synthetic_sender',timestamp:String(Math.floor(now/1000)),type:'text',text:{body:handoff().message}}]}}]}]};
 const raw=JSON.stringify(body),secret='synthetic-test-secret-not-a-real-credential',key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature='sha256='+[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 assert.equal(await verifyMetaSignature(raw,signature,secret),true);assert.equal(await verifyMetaSignature(raw+' ',signature,secret),false);
 const env={META_WABA_ID:'synthetic_WABA',META_PHONE_NUMBER_ID:'synthetic_phone'},events=normalizeEvents(body,env);assert.equal(events.length,1);assert.equal(resolveLead(events[0].text).requested_sku,'TELF017');assert.equal(normalizeEvents(body,{...env,META_PHONE_NUMBER_ID:'wrong'}).length,0);
 const response=prepare(candidate,library).reply;const out=prepareOfficialReply(events[0],response,now);assert.equal(out.send_enabled,false);assert.equal(out.canal,'whatsapp');assert.throws(()=>prepareOfficialReply({...events[0],timestamp:now-86400001},response,now));
});
