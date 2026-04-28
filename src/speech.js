/**
 * Web Speech API による読み上げ
 */

let utterance = null;

export function speak(text) {
  if (!('speechSynthesis' in window)) {
    alert('お使いのブラウザは読み上げに対応していません');
    return;
  }
  // 既に再生中なら停止
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }
  utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
