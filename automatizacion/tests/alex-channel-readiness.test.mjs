import {test} from 'node:test';import assert from 'node:assert/strict';
import {assessChannel,referrals,conversationScope} from '../alex-channel-readiness.mjs';
test('Even complete evidence cannot activate external sends or accredit a personal inbox API',()=>{
 const e={identity_verified:true,messaging_permission:true,subscription_verified:true,registered_tester:true,transport_implemented_and_tested:true,zero_cost_service_only_verified:true,advanced_access_verified:true,app_live_verified:true,current_commercial_source:true,real_channel_delivery_verified:true};
 for(const ch of ['messenger_page','instagram_professional','whatsapp_business']){const d=assessChannel(ch,e);assert.equal(d.tester_ready,true);assert.equal(d.external_send_enabled,false);}
 assert.equal(assessChannel('marketplace_personal',e).official_Alex_inbox_API_accredited,false);
 assert.ok(assessChannel('whatsapp_business').blocked_by.includes('ZERO_COST_ACCOUNT_AND_SERVICE_WINDOW_NOT_VERIFIED'));
 assert.ok(assessChannel('instagram_professional').blocked_by.includes('CHANNEL_TRANSPORT_NOT_IMPLEMENTED_AND_TESTED'));
});
test('Ten legitimate sources can share referrals without accessing their inboxes; only Rafa is actually registered',()=>{
 const real=referrals();assert.equal(real.length,1);assert.equal(real[0].sku,'TELF017');
 const fixtures=Array.from({length:10},(_,i)=>({key:'synthetic-'+i,sku:'TELF017',owner_authorized:true,listing_url:'https://www.facebook.com/marketplace/item/'+(10000+i)+'/'}));
 const list=referrals(fixtures);assert.equal(list.length,10);
 for(const r of list){assert.equal(r.personal_inbox_access,false);assert.equal(r.requires_customer_send,true);assert.equal(r.attribution_grants_sender_authorization,false);assert.equal(r.whatsapp_Alex_connected,false);assert.ok(!r.whatsapp_url.includes('$'));}
 assert.throws(()=>referrals([...fixtures,fixtures[0]]));assert.throws(()=>referrals([{...fixtures[0],owner_authorized:false}]));
 assert.throws(()=>referrals([{...fixtures[0],listing_url:'https://www.facebook.com.evil.test/share/foo/'}]));
});
test('The same person identifier cannot merge conversations across channels or business assets',async()=>{
 const s='synthetic-private-operator-secret-for-tests';
 const scopes=await Promise.all(['messenger_page','instagram_professional','whatsapp_business'].map(ch=>conversationScope(ch,'123456','987654',s)));
 scopes.push(await conversationScope('messenger_page','222222','987654',s));assert.equal(new Set(scopes).size,4);
 assert.equal(scopes[0],await conversationScope('messenger_page','123456','987654',s));assert.ok(scopes.every(x=>!x.includes('987654')));
 await assert.rejects(conversationScope('marketplace_personal','123456','987654',s));
});
