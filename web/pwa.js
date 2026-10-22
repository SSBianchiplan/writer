// GPlanSiS|Writer — PWA (registro do service worker) e faixa de ferramentas recolhível no celular.
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (e) { console.warn('service worker não registrado:', e && e.message); });
    });
  }

  // faixa de ferramentas: botão de recolher (só aparece no layout de celular, ver writer.css [celular])
  var CH = 'gpw:rbmin', rb = document.getElementById('ribbon');
  if (!rb) return;
  var bt = document.createElement('button');
  bt.id = 'rbFold'; bt.type = 'button';
  bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  rb.appendChild(bt);
  function set(min, salva) {
    document.body.classList.toggle('rb-min', min);
    bt.setAttribute('aria-expanded', String(!min));
    bt.setAttribute('aria-label', min ? 'Mostrar ferramentas' : 'Recolher ferramentas');
    bt.title = bt.getAttribute('aria-label');
    if (salva) try { localStorage.setItem(CH, min ? '1' : '0'); } catch (e) {}
  }
  var salvo = null; try { salvo = localStorage.getItem(CH); } catch (e) {}
  // sem preferência salva: recolhida no celular deitado (pouca altura)
  set(salvo ? salvo === '1' : (innerHeight <= 500 && matchMedia('(pointer: coarse)').matches), false);
  bt.addEventListener('click', function () { set(!document.body.classList.contains('rb-min'), true); });
  // tocar numa aba com a faixa recolhida abre as ferramentas dessa aba
  document.getElementById('tabs').addEventListener('click', function (e) {
    if (e.target.closest('[data-tab]') && document.body.classList.contains('rb-min')) set(false, true);
  });
})();
