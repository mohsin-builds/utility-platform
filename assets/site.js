import {svg} from './icons.js';
for(const element of document.querySelectorAll('[data-icon]'))element.innerHTML=svg(element.dataset.icon,Number(element.dataset.size)||24);
const year=document.querySelector('[data-year]');if(year)year.textContent=new Date().getFullYear();
const search=document.querySelector('#tool-search');if(search){search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let n=0;for(const card of document.querySelectorAll('[data-tool-card]')){const match=card.textContent.toLowerCase().includes(q);card.hidden=!match;if(match)n++;}const empty=document.querySelector('#empty-tools');if(empty)empty.style.display=n?'none':'block';});}

// Keyboard shortcut is intentionally inactive while editing input fields.
document.addEventListener('keydown',e=>{const field=document.querySelector('#tool-search');if(!field)return;const target=e.target;if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)){e.preventDefault();field.focus();}});

// The directory retains all tools in DOM for indexability and works without JS.
const filterBtns=[...document.querySelectorAll('[data-category]')].filter(e=>e.matches('button.filter-chip'));
let activeCategory='all';
const toolSearch=document.querySelector('#tool-search');
const applyDirectory=()=>{const q=(toolSearch?.value||'').trim().toLocaleLowerCase();let matches=0;for(const card of document.querySelectorAll('[data-tool-card]')){const okCat=activeCategory==='all'||card.dataset.category===activeCategory;const okQuery=card.textContent.toLocaleLowerCase().includes(q);card.hidden=!(okCat&&okQuery);if(okCat&&okQuery)matches++;}for(const block of document.querySelectorAll('[data-category-block]'))block.hidden=![...block.querySelectorAll('[data-tool-card]')].some(c=>!c.hidden);const empty=document.querySelector('#empty-tools');if(empty)empty.hidden=matches!==0;const counter=document.querySelector('#tool-count');if(counter)counter.textContent=matches+' tools';};
for(const btn of filterBtns)btn.addEventListener('click',()=>{activeCategory=btn.dataset.category;for(const b of filterBtns){b.classList.toggle('is-active',b===btn);b.setAttribute('aria-pressed',String(b===btn));}applyDirectory();});
toolSearch?.addEventListener('input',applyDirectory);
