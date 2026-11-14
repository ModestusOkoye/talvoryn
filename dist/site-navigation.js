/* Shared accessible navigation for Overview, Integrators, Forecast and Methodology. */
(() => {
 const nav=document.querySelector('header nav[aria-label="Main navigation"]');
 if(!nav || nav.classList.contains('talvoryn-nav'))return;
 nav.classList.add('talvoryn-nav');
 const brand=nav.querySelector('.talvoryn-brand');
 const existing=[...nav.children].filter(el=>el.matches('a:not(.brand),button.about-trigger'));
 const links=document.createElement('div');links.className='primary-links';links.id='talvoryn-primary-links';
 const findByText=text=>existing.find(el=>el.textContent.trim()===text);
 for(const text of ['Overview','Forecast','Integrators','About']){
  const el=findByText(text);if(el)links.append(el);
 }
 const methods=document.createElement('a');methods.href='./methodology.html';methods.textContent='Methodology';
 if(location.pathname.includes('methodology'))methods.setAttribute('aria-current','page');
 links.append(methods);
 const soon=nav.querySelector('.header-coming-soon');
 const toggle=document.createElement('button');toggle.type='button';toggle.className='mobile-menu-toggle';
 toggle.setAttribute('aria-controls',links.id);toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open navigation menu');
 toggle.textContent='☰ Menu';
 nav.append(links);
 nav.append(toggle);
 const backdrop=document.createElement('div');backdrop.className='mobile-navigation-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);
 if(soon){
  const drawerActions=document.createElement('div');drawerActions.className='drawer-actions';drawerActions.setAttribute('aria-label','Upcoming features');
  for(const button of soon.querySelectorAll('button'))drawerActions.append(button.cloneNode(true));
  links.append(drawerActions);
 }
 const setOpen=open=>{
  links.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);
  toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');
  toggle.textContent=open?'✕ Close':'☰ Menu';document.body.classList.toggle('mobile-navigation-open',open);
  if(open)links.querySelector('a,button')?.focus();else toggle.focus();
 };
 toggle.addEventListener('click',()=>setOpen(!links.classList.contains('is-open')));
 backdrop.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&links.classList.contains('is-open'))setOpen(false)});
 links.querySelector('.about-trigger')?.addEventListener('click',()=>{if(links.classList.contains('is-open'))setOpen(false)});
 window.matchMedia('(min-width:951px)').addEventListener('change',e=>{if(e.matches&&links.classList.contains('is-open'))setOpen(false)});
})();