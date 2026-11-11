// Ajustes.
import { Content } from '../content.js';
import { Store } from '../store.js';
import { Speech, Practice } from '../speech.js';
import { h, button, infoBox, section, toast } from '../ui.js';
import { page, title } from './common.js';
import { Backup, REMIND_AFTER_DAYS } from '../backup.js';
import { VERSION } from '../arquivos.js';
import { App } from '../app.js';

export function SettingsView() {
  const s = Store.settings;
  const toggle = (label, key, note) => {
    const input = h('input', { type: 'checkbox', checked: !!s[key] });
    input.onchange = () => { s[key] = input.checked; Store.save(); };
    return h('label.toggle', h('span', label, note ? h('small', note) : null), input, h('span.switch'));
  };
  const number = (label, key, min, max, stepv) => {
    const input = h('input.num', { type: 'number', min, max, step: stepv, value: String(s[key]), inputmode: 'numeric' });
    input.onchange = () => { s[key] = Math.min(max, Math.max(min, parseInt(input.value, 10) || min)); input.value = s[key]; Store.save(); };
    return h('label.field', h('span', label), input);
  };

  const ja = Speech.japaneseVoices;
  const voiceSelect = h('select.select', { 'aria-label': 'Voz' },
    h('option', { value: '' }, '(automática)'),
    ja.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === Speech.currentVoiceUri }, `${v.name}${v.localService ? '' : ' (online)'}`)));
  voiceSelect.onchange = () => { Speech.selectVoice(voiceSelect.value || null); Speech.speak('こんにちは。わたしの こえは どうですか。'); };
  const speedLabel = h('span', `Velocidade: ${Speech.speed.toFixed(2)}×`);
  const speed = h('input.range', { type: 'range', min: '50', max: '150', step: '5', value: String(Math.round(Speech.speed * 100)) });
  speed.oninput = () => { s.SpeechSpeed = +speed.value / 100; speedLabel.textContent = `Velocidade: ${s.SpeechSpeed.toFixed(2)}×`; };
  speed.onchange = () => Store.save();

  const fileInput = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true });
  fileInput.onchange = async () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      if (!confirm('Substituir o progresso deste aparelho pelo do arquivo?')) return;
      Store.importJson(text);
      toast('Progresso importado!');
      App.render();
    } catch (e) {
      alert('Arquivo inválido: ' + e.message);
    }
  };
  const exportProgress = async () => {
    const r = await Backup.export();
    if (r === 'cancelled') return;
    toast(r === 'shared' ? 'Backup feito!' : 'Arquivo salvo em Downloads.');
    App.render();
  };
  const last = Backup.lastBackup;
  const backupInfo = [
    last ? `Último backup: ${last.toLocaleDateString('pt-BR')}.` : 'Você ainda não fez backup neste aparelho.',
    Backup.persisted === true ? 'Armazenamento protegido: o navegador não apaga os dados sozinho.'
      : Backup.persisted === false ? 'Armazenamento não protegido: o sistema pode apagar os dados se faltar espaço. Instalar o app ajuda.'
        : null,
    `O app lembra de fazer backup a cada ${REMIND_AFTER_DAYS} dias.`,
  ].filter(Boolean).join('\n');

  return page(
    ...title('Ajustes'),
    section('Exibição'),
    h('div.card.settings',
      toggle('Mostrar romaji junto do japonês', 'ShowRomaji', 'Recomendado: desligue depois do Nível 0 — o romaji vira muleta.'),
      toggle('Mostrar leitura em kana (furigana)', 'ShowReading'),
      toggle('Tocar áudio automaticamente', 'AutoPlayAudio')),
    section('Metas'),
    h('div.card.settings',
      number('Meta diária de XP', 'DailyGoalXp', 10, 500, 10),
      number('Máx. de cartões por revisão', 'MaxReviewsPerSession', 10, 300, 10)),
    section('Voz (áudio em japonês)'),
    h('div.card.settings',
      Speech.hasJapaneseVoice
        ? infoBox(`✓ ${ja.length} voz(es) japonesa(s). Em uso: ${Speech.voiceName}`, 'success')
        : infoBox('Nenhuma voz japonesa listada. O app tenta usar a voz padrão do sistema para japonês.\n' +
          'Android: Configurações → Sistema → Idiomas → Saída de conversão de texto em voz → Serviços de fala do Google → Instalar dados de voz → Japonês.\n' +
          'iPhone: Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Japonês.', 'warn'),
      ja.length ? h('label.field', h('span', 'Voz'), voiceSelect) : null,
      h('label.field.col', speedLabel, speed),
      button('🔊 Testar', () => Speech.speak('こんにちは。いっしょに日本語を勉強しましょう。')),
      h('p.muted.small', 'Dica: comece em 0,8× para aprender e suba até 1,1× para treinar o ouvido para a velocidade real.')),
    section('Diagnóstico'),
    infoBox(
      'Vozes japonesas: ' + (ja.length ? ja.map((v) => v.name).join(', ') : 'nenhuma') + '\n' +
      'Gravação pelo microfone: ' + (Practice.canRecord ? '✓ disponível' : '✗ indisponível') + '\n' +
      'Reconhecimento de fala: ' + (Practice.canRecognize ? '✓ disponível (precisa de internet)' : '✗ indisponível neste navegador') + '\n' +
      `Conteúdo: ${Content.allLessons.length} lições · ${Content.kanji.length} kanji · ${Content.phrases.reduce((n, c) => n + c.phrases.length, 0)} frases`, 'neutral'),
    section('Seu progresso'),
    h('p.muted.small', 'O progresso fica salvo neste aparelho. Faça backup para não perder nada ou para levar a outro aparelho. ' +
      'O arquivo também serve no app de PC: renomeie para progress.json e coloque em %APPDATA%\\JapHelp\\ (e o contrário: importe aqui o progress.json do PC).'),
    infoBox(backupInfo, last ? 'neutral' : 'warn'),
    h('div.stack',
      button('💾 Fazer backup (exportar)', exportProgress),
      button('⬆ Importar progresso', () => fileInput.click()),
      fileInput,
      App.installPrompt ? button('📲 Instalar o app', () => App.install()) : null,
      h('button.btn.danger', {
        type: 'button',
        onclick: () => {
          if (confirm('Isso apaga lições concluídas, XP, sequência e toda a revisão (SRS). Não dá para desfazer. Continuar?')) {
            Store.reset();
            App.go('home');
          }
        },
      }, '🗑 Zerar todo o progresso')),
    h('p.muted.small.center', `JapHelp · versão ${VERSION} · funciona offline depois do primeiro acesso.`),
    h('p.muted.small.center', 'Ordem dos traços: ',
      h('a', { href: 'https://kanjivg.tagaini.net', target: '_blank', rel: 'noopener' }, 'KanjiVG'),
      ' © Ulrich Apel, licença ',
      h('a', { href: 'https://creativecommons.org/licenses/by-sa/3.0/', target: '_blank', rel: 'noopener' }, 'CC BY-SA 3.0'), '.'),
  );
}
