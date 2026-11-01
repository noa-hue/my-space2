(function(root){
 'use strict';
 const enc=new TextEncoder(),xml=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const cleanName=s=>String(s||'ללא נושא').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').replace(/^[ .]+|[ .]+$/g,'').slice(0,90)||'ללא שם';
 function tags(s){return [...new Set((Array.isArray(s)?s:String(s||'').split(/[,;،\n]/)).map(x=>String(x).trim()).filter(Boolean))].slice(0,30);}
 const normalize=s=>String(s||'').normalize('NFC').toLowerCase().replace(/[\u0591-\u05c7]/g,'').trim();
 const stop=new Set('אפשר צריך צריכה רוצה משהו להיות יהיה שהיו יותר מאוד אותי אותה הזה הזאת שלהם שלנו מתוך כאשר אחרי לפני בגלל אבל וגם אני אתה היא הוא אנחנו אתם אלה זאת שזה שלך שלי אולי עדיין תמיד לפעמים באמת עכשיו כבר כאן ולא שלה שלו'.split(' '));
 function tokens(d){return new Set(normalize([d.title,d.body].join(' ')).match(/[\p{L}]{4,}/gu)?.filter(w=>!stop.has(w))||[]);}
 function linked(a,b){return a.id!==b.id&&(a.sourceId===b.id||b.sourceId===a.id||(a.relatedIds||[]).includes(b.id)||(b.relatedIds||[]).includes(a.id));}
 function suggestions(d,all){const a=tokens(d),ownTags=tags(d.tags).map(normalize);return all.filter(x=>x.id!==d.id&&!x.archived&&!linked(d,x)).map(x=>{
  const sharedTags=tags(x.tags).filter(t=>ownTags.includes(normalize(t))),topic=normalize(d.topic)&&normalize(d.topic)===normalize(x.topic),words=[...tokens(x)].filter(w=>a.has(w));
  const score=(topic?5:0)+sharedTags.length*3+(words.length>=2?Math.min(words.length,4):0);
  return {id:x.id,score,reason:[topic?'אותו נושא: '+d.topic:'',sharedTags.length?'תגיות: '+sharedTags.join('، '):'',words.length>=2?'מילים משותפות: '+words.slice(0,3).join('، '):''].filter(Boolean).join(' · ')};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,5);}
 const type=d=>d.materialType||(d.stage==='idea'?'idea':'text'),labels={source:'חומרי מקור',idea:'רעיונות',text:'טיוטות וטקסטים'};
 function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 function concat(parts){const out=new Uint8Array(parts.reduce((n,x)=>n+x.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
 function header(n,fields){const b=new Uint8Array(n),v=new DataView(b.buffer);for(const [offset,val,size] of fields)size===2?v.setUint16(offset,val,true):v.setUint32(offset,val,true);return b;}
 // Stored ZIP entries keep exports self-contained and usable offline, including UTF-8 filenames.
 function zip(entries){if(entries.length>65535)throw Error('יותר מדי קבצים לייצוא אחד');const local=[],central=[];let offset=0;const seen=new Set();
  for(const entry of entries){if(seen.has(entry.name)||entry.name.split('/').some(x=>x==='..'||x==='.')||entry.name.startsWith('/'))throw Error('שם קובץ לא תקין');seen.add(entry.name);
   const name=enc.encode(entry.name),data=typeof entry.data==='string'?enc.encode(entry.data):entry.data,crc=crc32(data);if(name.length>65535||offset+data.length>0xffffffff)throw Error('הייצוא גדול מדי');
   const h=header(30,[[0,0x04034b50],[4,20,2],[6,0x800,2],[12,33,2],[14,crc],[18,data.length],[22,data.length],[26,name.length,2]]);
   local.push(h,name,data);central.push(header(46,[[0,0x02014b50],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,crc],[20,data.length],[24,data.length],[28,name.length,2],[42,offset]]),name);offset+=h.length+name.length+data.length;
  }
  const cd=concat(central);return concat([...local,cd,header(22,[[0,0x06054b50],[8,entries.length,2],[10,entries.length,2],[12,cd.length],[16,offset]])]);
 }
 const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main',decl='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const rtl='<w:rtl/><w:lang w:val="he-IL" w:bidi="he-IL"/>';
 function para(text,style='Normal'){const runs=String(text??'').split('\t').map((s,i)=>(i?'<w:r><w:rPr>'+rtl+'</w:rPr><w:tab/></w:r>':'')+'<w:r><w:rPr>'+rtl+'</w:rPr><w:t xml:space="preserve">'+xml(s)+'</w:t></w:r>').join('');return '<w:p><w:pPr><w:pStyle w:val="'+style+'"/><w:bidi/><w:jc w:val="start"/></w:pPr>'+runs+'</w:p>';}
 function docx(title,sections){const styles=decl+`<w:styles xmlns:w="${ns}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/>${rtl}</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="start"/><w:spacing w:after="140" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`+[['Normal','Normal',24],['Title','Title',36],['Heading1','heading 1',28]].map(([id,name,size])=>`<w:style w:type="paragraph" ${id==='Normal'?'w:default="1"':''} w:styleId="${id}"><w:name w:val="${name}"/>${id!=='Normal'?'<w:basedOn w:val="Normal"/>':''}<w:pPr><w:bidi/><w:jc w:val="start"/>${id!=='Normal'?'<w:keepNext/><w:spacing w:before="240" w:after="180"/>':''}</w:pPr><w:rPr>${rtl}<w:color w:val="000000"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${id!=='Normal'?'<w:b/><w:bCs/>':''}</w:rPr></w:style>`).join('')+'</w:styles>';
  const content=para(title,'Title')+sections.map(s=>(s.heading?para(s.heading,'Heading1'):'')+String(s.text??'').split(/\r\n|\r|\n/).map(t=>para(t)).join('')).join('');
  return zip([{name:'[Content_Types].xml',data:decl+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'},
   {name:'_rels/.rels',data:decl+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
   {name:'word/_rels/document.xml.rels',data:decl+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>'},
   {name:'word/document.xml',data:decl+`<w:document xmlns:w="${ns}"><w:body>${content}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/><w:bidi/><w:rtlGutter/></w:sectPr></w:body></w:document>`},
   {name:'word/styles.xml',data:styles},{name:'word/settings.xml',data:decl+`<w:settings xmlns:w="${ns}"><w:themeFontLang w:val="he-IL" w:bidi="he-IL"/></w:settings>`}]);
 }
 function materialDocx(d,all){const related=all.filter(x=>linked(d,x));const sections=[{text:[labels[type(d)],d.topic?'נושא: '+d.topic:'',tags(d.tags).length?'תגיות: '+tags(d.tags).join('، '):'',d.sourceUrl?'קישור למקור: '+d.sourceUrl:'',d.updatedAt&&!Number.isNaN(Date.parse(d.updatedAt))?'עודכן: '+new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Jerusalem'}).format(new Date(d.updatedAt)):''].filter(Boolean).join('\n')},{heading:'הטקסט שלי',text:d.body||''}];
  if(typeof d.capturedBody==='string'&&d.capturedBody!==d.body)sections.push({heading:'הטקסט כפי שנקלט',text:d.capturedBody});
  if(d.pause)sections.push({heading:'איפה עצרנו',text:d.pause});if(d.nextStep)sections.push({heading:'הצעד הבא',text:d.nextStep});
  if(related.length)sections.push({heading:'חומרים קשורים',text:related.map(x=>x.title+(x.topic?' | '+x.topic:'')).join('\n')});return docx(d.title||'חומר ללא כותרת',sections);
 }
 function archiveEntries(all){const entries=[],used=new Set(),paths=new Map();for(const d of all){const folder='הקול שלי/'+cleanName(d.topic||'ללא נושא')+'/'+(d.archived?'ארכיון':d.inbox?'סל קליטה':labels[type(d)]||labels.text);const base=folder+'/'+cleanName(d.title||'חומר ללא כותרת');let name=base+'.docx',n=2;while(used.has(name.toLocaleLowerCase())){name=base+' '+n+'.docx';n++;}used.add(name.toLocaleLowerCase());paths.set(d.id,name);entries.push({name,data:materialDocx(d,all)});}
  const map=all.map(d=>({heading:d.title||'חומר ללא כותרת',text:[paths.get(d.id),'חומרים קשורים: '+(all.filter(x=>linked(d,x)).map(x=>x.title).join('، ')||'ללא קישורים שמורים')].join('\n')}));
  entries.unshift({name:'הקול שלי/מפת החומרים.docx',data:docx('מפת החומרים שלי',[{text:'כל חומר נשמר בקובץ נפרד לפי נושא וסוג. המפה מציגה את הקשרים ששמרת בין החומרים. זוהי תמונת מצב בזמן ההורדה; שינויים בקבצים במחשב אינם מתעדכנים באפליקציה.'},...map])});return entries;
 }
 const api={tags,linked,suggestions,cleanName,zip,docx,materialDocx,archiveEntries};if(typeof module==='object'&&module.exports)module.exports=api;else root.NoaMaterials=api;
})(typeof globalThis!=='undefined'?globalThis:this);
