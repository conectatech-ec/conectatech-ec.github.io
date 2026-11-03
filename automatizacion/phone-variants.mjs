// Read-only phone identity/variant view. Availability, price freshness and media authorization
// remain responsibilities of the existing commercial source and Alex renderer.
const BRANDS=new Map([
 ['samsung','Samsung'],['xiaomi','Xiaomi'],['redmi','Redmi'],['poco','POCO'],['honor','HONOR'],
 ['tecno','TECNO'],['infinix','Infinix'],['zte','ZTE'],['nubia','Nubia'],['dialn','Dialn'],
 ['realme','realme'],['motorola','Motorola'],['nokia','Nokia'],['apple','Apple'],['iphone','Apple'],
 ['oppo','OPPO'],['vivo','vivo'],['itel','itel'],['tcl','TCL'],['alcatel','Alcatel'],['oneplus','OnePlus'],
 ['huawei','Huawei'],['google','Google'],['lg','LG'],['blackview','Blackview'],['ulefone','Ulefone']
]);
const QUALIFIERS=['pro','plus','max','ultra','lite','neo','mini','fe','se'];
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const text=s=>fold(s).replace(/\bproplus\b/g,'pro plus').replace(/(\d)(proplus|pro|plus|max|ultra|lite)\b/g,'$1 $2')
 .replace(/\b(samsung|redmi|xiaomi|honor|tecno|infinix|zte|poco)(?=[a-z]*\d)/g,'$1 ')
 .replace(/\b(\d+)\s+([a-z])\b/g,'$1$2').replace(/\s+/g,' ').trim();
const positiveNumber=value=>{const m=String(value??'').match(/\b(\d{1,4})\s*(?:gb)?\b/i);const n=m?Number(m[1]):null;return n>0&&n<=4096?n:null;};
const field=(obj,keys)=>{for(const key of keys)if(obj?.[key]!==undefined)return obj[key];return null;};
function brandOf(value,explicit){
 const q=text(value);
 // Redmi/POCO are the narrower identity when an official label names Xiaomi too.
 for(const key of ['redmi','poco'])if(new RegExp('\\b'+key+'\\b').test(q))return {brand:BRANDS.get(key),token:key};
 for(const [token,brand]of BRANDS)if(new RegExp('\\b'+escape(token)+'\\b').test(q))return {brand,token};
 if(typeof explicit==='string'&&/^[a-z][a-z .-]{1,35}$/i.test(explicit))return {brand:explicit.trim(),token:fold(explicit.trim())};
 return null;
}
function connectionOf(value){const m=text(value).match(/\b([45])\s*g\b/);return m?m[1]+'G':null;}
function memoryOf(value){
 const q=text(value),issues=[];
 const values=[...q.matchAll(/\b(\d{1,4})\s*gb\b/g)].map(m=>({n:Number(m[1]),index:m.index}));
 const storageLabel=q.match(/(?:almacenamiento|rom|storage)\s*(?:de|:)?\s*(\d{1,4})\s*gb\b|\b(\d{1,4})\s*gb\s*(?:de\s+)?(?:almacenamiento|rom|storage)\b/);
 let storage=storageLabel?Number(storageLabel[1]||storageLabel[2]):null;
 const large=[...new Set(values.filter(v=>v.n>=32).map(v=>v.n))];
 if(storage===null&&large.length===1)storage=large[0];
 if(storage===null&&large.length>1)issues.push('STORAGE_AMBIGUOUS');
 const physicalLabel=q.match(/ram\s*fisica\s*(?:de|:)?\s*(\d{1,2})\s*(?:gb)?\b|\b(\d{1,2})\s*gb\s*(?:de\s+ram\s*)?fisic(?:a|o)s?\b/);
 const virtualLabel=q.match(/(?:ram\s*)?(?:virtual|extension|expandida)\s*(?:de|:)?\s*(\d{1,2})\s*(?:gb)?\b|\b(\d{1,2})\s*gb\s*(?:de\s+ram\s*)?virtual(?:es)?\b/);
 let physical=physicalLabel?Number(physicalLabel[1]||physicalLabel[2]):null;
 let virtual=virtualLabel?Number(virtualLabel[1]||virtualLabel[2]):null;
 const small=values.filter(v=>v.n<32&&v.n>0);
 const pair=q.match(/\b(\d{1,2})\s*(?:gb)?\s*\+\s*(\d{1,2})\s*gb\b/);
 const totalClaim=/ram\s*(?:total|extendida)|(?:total|extendida)\s*(?:de\s*)?\d+\s*gb|\b\d+\s*gb\s*(?:de\s*)?ram\s*total/.test(q);
 if(pair&&Number(pair[1])<32&&Number(pair[2])<32){
  if(physical===null)physical=Number(pair[1]);if(virtual===null)virtual=Number(pair[2]);
 }else if(physical===null&&!totalClaim&&small.length===1&&!/\bvirtual|expandida|extension\b/.test(q))physical=small[0].n;
 if(totalClaim&&physical===null)issues.push('RAM_TOTAL_NOT_PHYSICAL');
 if(/\b\d{2,4}\s*b\b/.test(q))issues.push('MALFORMED_STORAGE_UNIT');
 return {storage_gb:storage,ram_physical_gb:physical,ram_virtual_gb:virtual,issues};
}
export function phoneVariant(product){
 if(!product||typeof product!=='object')return null;
 const official=product.source_name||product.catalog_identity;
 const label=official||product.nombre||product.name;
 if(typeof label!=='string'||!label.trim()||label.length>600)return null;
 const category=fold(product.category||product.categoria||'');
 if(!/^TELF[A-Z0-9_-]*$/i.test(product.sku||'')&&!/telefon|celular|smartphone/.test(category)&&!/^\s*(?:telefono|celular|smartphone)\b/i.test(fold(label)))return null;
 const specs=product.caracteristicas||product.specifications||{};
 const brand=brandOf(label,product.brand||field(specs,['Marca','marca','Brand']));if(!brand)return null;
 let raw=text(label).replace(/^\s*(?:telefono|celular|smartphone|movil)\s+/,'');
 // Do not infer a missing brand from a model code: a label like NOTE 50s remains unknown.
 const at=raw.search(new RegExp('\\b'+escape(brand.token)+'\\b'));if(at>=0)raw=raw.slice(at+brand.token.length);
 else if(!product.brand&&!field(specs,['Marca','marca','Brand']))return null;
 raw=raw.replace(/^[\s:.-]+/,'');
 if(brand.brand==='Samsung')raw=raw.replace(/^galaxy\s*/,'');
 if(brand.brand==='Apple'&&brand.token!=='iphone')raw=raw.replace(/^iphone\s*/,'');
 const memory=memoryOf(label),issues=[...memory.issues];
 const stop=raw.search(/\b\d{1,4}\s*gb\b|\b\d{2,4}\s*b\b|\b(?:ram|rom|almacenamiento|storage)\b/);
 let model=stop>=0?raw.slice(0,stop):raw;
 model=model.replace(/\b[45]\s*g\b/g,' ').replace(/[()[\]+,;:]/g,' ').replace(/\s+/g,' ').trim();
 const qualifiers=QUALIFIERS.filter(q=>new RegExp('\\b'+q+'\\b').test(model));
 const baseModel=model.replace(new RegExp('\\b(?:'+QUALIFIERS.join('|')+')\\b','g'),' ').replace(/\s+/g,' ').trim();
 if(!baseModel||baseModel.length>80||!/[a-z0-9]/.test(baseModel)||/para|compatible|funda|protector|estuche|cable|cargador/.test(baseModel))return null;
 const officialStorage=memory.storage_gb,officialPhysical=memory.ram_physical_gb;
 const specStorage=positiveNumber(field(specs,['Almacenamiento','storage_gb','Storage']));
 const specPhysical=positiveNumber(field(specs,['RAM física','RAM fisica','ram_physical_gb']));
 if(officialStorage&&specStorage&&officialStorage!==specStorage)issues.push('STORAGE_CONFLICT');
 if(officialPhysical&&specPhysical&&officialPhysical!==specPhysical)issues.push('RAM_PHYSICAL_CONFLICT');
 const namedConnection=connectionOf(label),specConnection=connectionOf(field(specs,['Red móvil','Red movil','Conectividad','Network']));
 if(namedConnection&&specConnection&&namedConnection!==specConnection)issues.push('CONNECTIVITY_CONFLICT');
 const connectivity=namedConnection||specConnection;
 const baseKey=fold(brand.brand)+':'+baseModel.replace(/\s/g,'')+':'+qualifiers.join('+');
 return {brand:brand.brand,model:(baseModel+(qualifiers.length?' '+qualifiers.join(' '):'')).toUpperCase(),base_model:baseModel.toUpperCase(),
  base_family_key:baseKey,family_key:baseKey+':'+(connectivity||'unknown-network'),
  storage_gb:officialStorage||specStorage,ram_physical_gb:officialPhysical||specPhysical,
  ram_virtual_gb:memory.ram_virtual_gb,connectivity,qualifiers,verified_identity:!!official&&!issues.some(i=>/CONFLICT|MALFORMED|AMBIGUOUS/.test(i)),issues};
}
function matchesModel(q,identity){
 const parts=fold(identity.base_model).match(/[a-z]+|\d+[a-z]*/g)||[];
 if(!parts.length)return false;
 const pattern='\\b'+parts.map(escape).join('\\s*')+'\\b';
 return new RegExp(pattern,'i').test(q);
}
const brandMatches=(request,actual)=>!request||request===actual||request==='Xiaomi'&&['Xiaomi','Redmi','POCO'].includes(actual);
export function phoneFamily(input,products,{focus=[]}={}){
 if(!Array.isArray(products)||typeof input!=='string'||input.length>2000)return null;
 const q=text(input),rows=products.map(product=>({product,identity:phoneVariant(product)})).filter(r=>r.identity);
 if(!rows.length)return null;
 const skuRows=rows.filter(r=>new RegExp('\\b'+escape(fold(r.product.sku))+'\\b').test(q));
 const requestedBrand=brandOf(q)?.brand||(/\bgalaxy\b/.test(q)?'Samsung':null);
 const queryQualifiers=QUALIFIERS.filter(w=>new RegExp('\\b'+w+'\\b').test(q));
 // A mixed-model comparison belongs to the existing comparison resolver. A
 // preferred sub-brand token must not erase another explicitly named model.
 const namedModels=new Set(rows.filter(r=>matchesModel(q,r.identity)&&JSON.stringify(r.identity.qualifiers)===JSON.stringify(queryQualifiers)).map(r=>fold(r.identity.base_model).replace(/\s/g,'')));
 if(!skuRows.length&&namedModels.size>1)return null;
 const memory=memoryOf(input),requestedNetwork=connectionOf(input);
 const prior=rows.filter(r=>focus.includes(r.product.sku));
 let candidates=skuRows;
 let named=false;
 if(!candidates.length){
  candidates=rows.filter(r=>brandMatches(requestedBrand,r.identity.brand)&&matchesModel(q,r.identity)&&JSON.stringify(r.identity.qualifiers)===JSON.stringify(queryQualifiers));
  named=candidates.length>0;
 }
 if(!candidates.length&&queryQualifiers.length){
  const known=rows.find(r=>brandMatches(requestedBrand,r.identity.brand)&&matchesModel(q,r.identity));
  if(known)return {variants:[],exact:[],identity:{...known.identity,model:known.identity.base_model+' '+queryQualifiers.join(' ').toUpperCase()},
   is_family_query:false,has_named_model:true,explicit_variant:true,requested:{storage_gb:memory.storage_gb,ram_physical_gb:memory.ram_physical_gb,connectivity:requestedNetwork},all_identities:[]};
 }
 if(!candidates.length){
  const follow=memory.storage_gb!==null||memory.ram_physical_gb!==null||requestedNetwork||/\b(?:variantes|versiones|otra|otro|alternativas)\b/.test(q);
  if(!follow||!prior.length||new Set(prior.map(r=>r.identity.base_family_key)).size!==1)return null;
  candidates=prior;
 }
 const families=new Set(candidates.map(r=>r.identity.base_family_key));if(families.size!==1)return null;
 const key=candidates[0].identity.base_family_key;
 const variants=rows.filter(r=>r.identity.base_family_key===key&&(!requestedNetwork||r.identity.connectivity===requestedNetwork));
 if(!variants.length)return {variants:[],exact:[],identity:candidates[0].identity,is_family_query:false,has_named_model:named,explicit_variant:true,
  requested:{storage_gb:memory.storage_gb,ram_physical_gb:memory.ram_physical_gb,connectivity:requestedNetwork},all_identities:[]};
 const explicit=skuRows.length>0||memory.storage_gb!==null||memory.ram_physical_gb!==null||requestedNetwork!==null;
 let exact=skuRows.length?variants.filter(r=>skuRows.some(x=>x.product.sku===r.product.sku)):variants.filter(r=>
  (memory.storage_gb===null||r.identity.storage_gb===memory.storage_gb)&&
  (memory.ram_physical_gb===null||r.identity.ram_physical_gb===memory.ram_physical_gb));
 // Repeating selected storage in a follow-up does not discard its chosen RAM.
 // An explicit request for other versions deliberately reopens the family.
 if(!named&&!skuRows.length&&prior.length===1&&memory.storage_gb!==null&&memory.ram_physical_gb===null&&!requestedNetwork&&
    prior[0].identity.storage_gb===memory.storage_gb&&!/\b(?:otras?|otros?|variantes|versiones|opciones|alternativas)\b/.test(q))exact=exact.filter(r=>r.product.sku===prior[0].product.sku);
 if(!named&&!explicit&&/\botr[oa]\b/.test(q))exact=exact.filter(r=>!focus.includes(r.product.sku));
 return {variants:variants.map(r=>r.product),exact:exact.map(r=>r.product),identity:candidates[0].identity,
  is_family_query:named&&!explicit||/\b(?:variantes|versiones|alternativas)\b/.test(q),has_named_model:named,
  explicit_variant:explicit,requested:{storage_gb:memory.storage_gb,ram_physical_gb:memory.ram_physical_gb,connectivity:requestedNetwork},
  all_identities:variants.map(r=>({sku:r.product.sku,...r.identity}))};
}
