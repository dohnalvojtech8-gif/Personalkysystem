(() => {
  'use strict';
  const running = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  if (running()) return;
  let pending;
  const launcher = document.createElement('button');
  launcher.className = 'pwa-launcher'; launcher.type = 'button';
  launcher.textContent = '↓ Instalovat aplikaci';
  launcher.setAttribute('aria-haspopup', 'dialog');
  const dialog = document.createElement('dialog');
  dialog.className = 'pwa-dialog';
  dialog.setAttribute('aria-labelledby', 'pwa-title');
  dialog.innerHTML = `<h2 id="pwa-title">Aplikace na ploše</h2>
    <p>Otevírejte aplikaci přímo z plochy s vlastní ikonou. Pro přihlášení a práci s daty potřebujete internet.</p>
    <button type="button" class="pwa-install" hidden>Instalovat</button>
    <h3>Android · Chrome</h3>
    <ol><li>Otevřete tuto stránku v prohlížeči Chrome.</li><li>Klepněte na nabídku ⋮ vpravo nahoře.</li><li>Vyberte „Přidat na plochu“ nebo „Instalovat aplikaci“ a potvrďte instalaci.</li></ol>
    <h3>iPhone a iPad · Safari</h3>
    <ol><li>Otevřete tuto stránku v Safari.</li><li>Klepněte na Sdílet (čtvereček se šipkou nahoru).</li><li>Zvolte „Přidat na plochu“, případně zapněte „Otevřít jako webovou aplikaci“ a klepněte na „Přidat“.</li></ol>
    <h3>Počítač · Chrome nebo Edge</h3>
    <p>Klikněte na ikonu instalace v adresním řádku nebo vyberte instalaci aplikace v nabídce prohlížeče.</p>
    <p>Pokud stránku prohlížíte uvnitř jiné aplikace, otevřete ji nejprve v Chrome nebo Safari. Názvy voleb se mohou podle verze prohlížeče lišit.</p>
    <form method="dialog"><button class="pwa-close">Zavřít</button></form>`;
  document.body.append(launcher, dialog);
  const install = dialog.querySelector('.pwa-install');
  const close = () => { dialog.close(); launcher.focus(); };
  launcher.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) close(); } });
  dialog.addEventListener('close', () => launcher.focus());
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); pending=event; install.hidden=false;
  });
  install.addEventListener('click', async () => {
    if (!pending) return;
    const prompt = pending; pending=null; install.hidden=true;
    try { await prompt.prompt(); const choice=await prompt.userChoice; if(choice.outcome==='accepted') close(); } catch {}
  });
  window.addEventListener('appinstalled', () => { pending=null; dialog.close(); launcher.remove(); dialog.remove(); });
  matchMedia('(display-mode: standalone)').addEventListener('change', event => { if(event.matches) { dialog.close(); launcher.remove(); dialog.remove(); } });
})();
