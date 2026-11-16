// Procedural sound only: every effect is an oscillator or filtered noise built by WebAudio,
// so the game ships no audio files and loads nothing over the network. The context is created
// on the first user gesture (browsers block audio before one) and every call is a no-op until
// then. M toggles the master gain.

export function createAudio() {
  let context = null;
  let master = null;
  let sprayNodes = null;
  let muted = false;
  let drone = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, slideTo, delay) {
    if (!ensure()) return;
    const t0 = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain || 0.2, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, filterFreq, gain, type, delay) {
    if (!ensure()) return;
    const t0 = context.currentTime + (delay || 0);
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type || 'bandpass';
    filter.frequency.value = filterFreq || 1200;
    filter.Q.value = 0.8;
    const amp = context.createGain();
    amp.gain.setValueAtTime(gain || 0.2, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(t0);
    source.stop(t0 + dur + 0.05);
  }

  return {
    /** Call on the first gesture so later sounds are allowed. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** A soft wind drone under play; started once, kept quiet. */
    startDrone() {
      if (!ensure() || drone) return;
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const amp = context.createGain();
      amp.gain.value = 0.035;
      const lfo = context.createOscillator();
      lfo.frequency.value = 0.11;
      const lfoAmp = context.createGain();
      lfoAmp.gain.value = 0.015;
      lfo.connect(lfoAmp);
      lfoAmp.connect(amp.gain);
      osc.connect(amp);
      amp.connect(master);
      osc.start();
      lfo.start();
      drone = { osc, lfo };
    },
    sprayStart() {
      if (!ensure() || sprayNodes) return;
      const length = context.sampleRate;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2400;
      const amp = context.createGain();
      amp.gain.setValueAtTime(0, context.currentTime);
      amp.gain.linearRampToValueAtTime(0.09, context.currentTime + 0.08);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      source.start();
      sprayNodes = { source, amp };
    },
    sprayStop() {
      if (!sprayNodes) return;
      const nodes = sprayNodes;
      sprayNodes = null;
      nodes.amp.gain.linearRampToValueAtTime(0, context.currentTime + 0.08);
      nodes.source.stop(context.currentTime + 0.12);
    },
    /** A window came clean; the pitch climbs with the combo. */
    ding(combo) {
      const step = Math.min(combo || 0, 12);
      tone(660 * 2 ** (step / 12), 0.22, 'sine', 0.22);
      tone(990 * 2 ** (step / 12), 0.3, 'sine', 0.12, null, 0.03);
    },
    /** A hit on the gondola: low thud plus a dull knock. */
    hit() {
      tone(90, 0.25, 'sine', 0.5, 45);
      noise(0.18, 300, 0.35, 'lowpass');
    },
    refill() {
      tone(420, 0.12, 'sine', 0.14, 840);
    },
    pigeon() {
      tone(520, 0.09, 'triangle', 0.12, 380);
      tone(430, 0.12, 'triangle', 0.1, 330, 0.11);
    },
    warn() {
      tone(1180, 0.09, 'square', 0.07);
      tone(1180, 0.09, 'square', 0.07, null, 0.13);
    },
    gust() {
      noise(0.9, 500, 0.12, 'bandpass');
    },
    click() {
      tone(700, 0.06, 'square', 0.08);
    },
    levelClear() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.25, 'triangle', 0.2, null, i * 0.09));
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, 0.35, 'triangle', 0.22, null, i * 0.11));
      noise(0.5, 4000, 0.05, 'highpass', 0.4);
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.3, 'triangle', 0.18, null, i * 0.13));
    },
  };
}
