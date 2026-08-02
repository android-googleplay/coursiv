export function playSuccessTone(){
  if(typeof window==="undefined")return;
  const AudioContextClass=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!AudioContextClass)return;
  const context=new AudioContextClass();
  const oscillator=context.createOscillator();
  const gain=context.createGain();
  oscillator.type="sine";oscillator.frequency.setValueAtTime(523.25,context.currentTime);oscillator.frequency.setValueAtTime(659.25,context.currentTime+0.09);
  gain.gain.setValueAtTime(0.0001,context.currentTime);gain.gain.exponentialRampToValueAtTime(0.12,context.currentTime+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime+0.22);
  oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+0.23);oscillator.addEventListener("ended",()=>void context.close());
}
