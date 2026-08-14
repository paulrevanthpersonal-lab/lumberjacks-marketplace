(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.LumberjackCore=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const money=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value)||0);
  const normalizeLines=lines=>Object.entries(lines).filter(([,quantity])=>quantity>0).map(([productId,quantity])=>({productId,quantity}));
  const totals=(lines,products)=>{const subtotal=lines.reduce((sum,line)=>sum+(products.find(item=>item.id===line.productId)?.price||0)*line.quantity,0);const delivery=subtotal>=50||subtotal===0?0:5.99;const tax=Math.round(subtotal*.081*100)/100;return{subtotal,delivery,tax,total:Math.round((subtotal+delivery+tax)*100)/100};};
  const filter=(products,{query="",category="All",sort="featured"}={})=>{const q=query.trim().toLowerCase();const result=products.filter(item=>(category==="All"||item.category===category)&&(!q||`${item.name} ${item.category} ${(item.tags||[]).join(" ")} ${item.origin}`.toLowerCase().includes(q)));return [...result].sort((a,b)=>sort==="price-asc"?a.price-b.price:sort==="price-desc"?b.price-a.price:sort==="rating"?b.rating-a.rating:a.sku.localeCompare(b.sku));};
  return{money,normalizeLines,totals,filter};
});
