'use strict';
// Optional presentation hook only. Does not change catalog, price, stock or schema.
const policy=require('../politicas/enlaces.cjs');
module.exports=function compraEnlaces(html,product,{enabled=false}={}){
  if(!enabled)return html;
  if(!html.includes('data-ct-checkout')&&product?.stock>0){
    const link='<a data-ct-checkout class="cta" style="display:block;background:#075abd;color:white;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;margin:14px 0" href="/compra/?sku='+encodeURIComponent(product.sku)+'">Comprar en la web</a>';
    const anchor=/<a\b[^>]*href="https:\/\/wa\.me\//;
    if(anchor.test(html))html=html.replace(anchor,link+'$&');
  }
  return policy(html);
};
