import {test} from 'node:test';import assert from 'node:assert/strict';
import {catalogMatches} from '../alex-catalog.mjs';
const products=[
 {sku:'TELF011',nombre:'Samsung Galaxy A17 128GB 4GB RAM'},
 {sku:'TELF012',nombre:'Samsung Galaxy A17 256GB 8GB RAM'},
 {sku:'TELF017',nombre:'TELEFONO REDMI 15C 128GB 4GB+4GB'},
 {sku:'TELF018',nombre:'TELEFONO REDMI 15C 256GB 4GB+4GB'},
 {sku:'TELF019',nombre:'TELEFONO REDMI 15C 256GB 8GB+8GB'},
 {sku:'CARG061',nombre:'CABLE CARGADOR PARA INFINIX H4'},
 {sku:'REL046',nombre:'RELOJ INFINIX XWATCH H4'}
];
const ids=(query,options)=>catalogMatches(query,products,options).map(p=>p.sku);
test('Mixed comparisons bind each capacity to the named model and clarify unknown RAM before comparing',()=>{
 assert.deepEqual(ids('Compara Samsung A17 128 GB con Redmi 15C 256 GB de 4 GB RAM'),['TELF011','TELF018']);
 assert.deepEqual(ids('Samsung A17 128GB vs Redmi 15C 256/4GB'),['TELF011','TELF018']);
 assert.deepEqual(ids('Compara Samsung A17 128GB y Redmi 15C 256GB'),['TELF018','TELF019']);
 assert.deepEqual(ids('Samsung A17 256GB frente a Redmi 15C 128GB'),['TELF012','TELF017']);
});
test('A capacity follow-up keeps the focused family without silently choosing a RAM variant',()=>{
 assert.deepEqual(ids('¿Y el de 256 GB?',{focus:['TELF017']}),['TELF018','TELF019']);
 assert.deepEqual(ids('¿Y el de 256 GB?',{focus:['TELF011']}),['TELF012']);
 assert.deepEqual(ids('¿Y el de 128 GB?',{focus:['TELF018','TELF019']}),['TELF017']);
 assert.deepEqual(ids('¿Y el de 256 GB?',{focus:['TELF011','TELF017']}),[]);
 assert.deepEqual(ids('¿Y el de 256 GB?'),[]);
 assert.deepEqual(ids('Prefiero el Redmi 15C de 256 GB con 4 GB de RAM'),['TELF018']);
});
test('Model matching preserves exact accessories and explicit SKU compatibility',()=>{
 assert.deepEqual(ids('Quiero el Infinix XWATCH H4'),['REL046']);
 assert.deepEqual(ids('Quiero un cable de carga para Infinix H4'),['CARG061']);
 assert.deepEqual(ids('Elijo TELF018'),['TELF018']);
 assert.deepEqual(ids('Busco Samsung Galaxy A17'),['TELF011','TELF012']);
});
