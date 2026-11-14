/* Accessible responsive navigation; desktop links are present in HTML without JavaScript. */
(() => {
 const nav=document.querySelector('header nav.talvoryn-nav');
 if(!nav)return;
 const links=nav.querySelector('.primary-links'),toggle=nav.querySelector('.mobile-menu-toggle');
 if(!links||!toggle)return;
 const soon=nav.querySelector('.header-coming-soon');
 if(soon&&!links.querySelector('.drawer-actions')){
  const drawerActions=document.createElement('div');drawerActions.className='drawer-actions';drawerActions.setAttribute('aria-label','Upcoming features');
  for(const button of soon.querySelectorAll('button'))drawerActions.append(button.cloneNode(true));
  links.append(drawerActions);
 }
 const backdrop=document.createElement('div');backdrop.className='mobile-navigation-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);
 const setOpen=(open,restoreFocus=true)=>{
  links.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);
  toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');
  toggle.textContent=open?'✕ Close':'☰ Menu';document.body.classList.toggle('mobile-navigation-open',open);
  if(open)links.querySelector('a,button')?.focus();else if(restoreFocus)toggle.focus();
 };
 toggle.addEventListener('click',()=>setOpen(!links.classList.contains('is-open')));
 backdrop.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&links.classList.contains('is-open'))setOpen(false)});
 links.querySelector('.about-trigger')?.addEventListener('click',()=>{if(links.classList.contains('is-open'))setOpen(false,false)});
 window.matchMedia('(min-width:951px)').addEventListener('change',e=>{if(e.matches&&links.classList.contains('is-open'))setOpen(false,false)});
})();