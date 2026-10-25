'use strict';

const $ = (id) => document.getElementById(id);

chrome.storage.local.get('proxyUrl', (o) => {
  $('proxy').value = o.proxyUrl || '';
});

$('save').addEventListener('click', () => {
  const v = $('proxy').value.trim();
  chrome.storage.local.set({ proxyUrl: v }, () => {
    $('status').textContent = v ? 'Tersimpan' : 'Dimatikan (lokal saja)';
    setTimeout(() => { $('status').textContent = ''; }, 2200);
  });
});

$('clear').addEventListener('click', () => {
  chrome.storage.local.remove('verdict_cache_v1', () => {
    $('status').textContent = 'Cache dihapus';
    setTimeout(() => { $('status').textContent = ''; }, 2200);
  });
});
