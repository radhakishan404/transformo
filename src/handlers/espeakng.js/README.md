# espeakng.js

Browser-based text-to-speech using eSpeak-ng. No servers, no APIs, pure JavaScript.

## Features

- 🎯 **Vanilla JavaScript** - No frameworks or dependencies
- 🔊 **Basic Audio Processing** - Simple enhancements for clearer speech
- 🌍 **100+ Languages** - All eSpeak-ng voices included
- ⚡ **Runs Offline** - Everything works in the browser
- 📦 **~3 MB Total** - Includes all voice data

## Audio Processing

The library includes basic audio enhancements:

- **High-frequency boost** - Gentle emphasis for slightly clearer speech
- **Noise gate** - Simple threshold-based silence removal
- **Volume control** - Adjustable output level

## Quick Start

```javascript
// Initialize TTS
const tts = new SimpleTTS();

// Generate and play speech
tts.onReady(() => {
  tts.speak('Hello world!', (audioData, sampleRate) => {
    SimpleTTS.playAudioData(audioData, sampleRate);
  });
});
```

## Installation

Download these files:
1. `espeakng-simple.js` - Simple wrapper API
2. `espeakng.worker.js` - Web Worker
3. `espeakng.worker.data` - Voice data (must be in same folder as worker)

Or use the minified version:
1. `espeakng.min.js` - Minified API
2. `espeakng.worker.js` and `espeakng.worker.data`

## API

### new SimpleTTS(options)
- `options.workerPath` - Path to worker (default: 'js/espeakng.worker.js')
- `options.defaultVoice` - Default voice (default: 'en')
- `options.defaultRate` - Default speech rate (default: 175)
- `options.defaultPitch` - Default pitch (default: 50)
- `options.defaultVolume` - Default volume (default: 1.0)
- `options.enhanceAudio` - Enable basic audio enhancement (default: false)

### tts.speak(text, [options], callback)
```javascript
tts.speak('Hello', {
  voice: 'en',      // Voice ID (see tts.getVoices())
  rate: 175,        // Speech rate (80-450)
  pitch: 50,        // Pitch (0-100)
  volume: 1.0,      // Volume (0-2.0)
  enhance: false    // Apply basic audio enhancement (default: false)
}, (audioData, sampleRate) => {
  // audioData: Float32Array with audio samples
  // sampleRate: Sample rate (currently 11025 Hz)
});
```

### tts.getVoices(callback)
```javascript
tts.getVoices(voices => {
  // Array of voice objects with identifier, name, and languages
  console.log(voices);
});
```

### Helper Functions

```javascript
// Play audio data directly
SimpleTTS.playAudioData(audioData, sampleRate);

// Create Web Audio API AudioBuffer
const buffer = SimpleTTS.createAudioBuffer(audioData, sampleRate);
```

## Known Issues

- **Sample Rate**: The worker reports 22050 Hz but audio is actually 11025 Hz. The wrapper handles this automatically.
- **Voice Names**: Use simple voice codes like 'en' instead of 'en-us' for better compatibility.

## Example

```javascript
const tts = new SimpleTTS();

tts.onReady(() => {
  // List available voices
  tts.getVoices(voices => {
    console.log('Available voices:', voices);
  });
  
  // Simple speech
  tts.speak('Hello world!', (audioData, sampleRate) => {
    SimpleTTS.playAudioData(audioData, sampleRate);
  });
  
  // Speech with options
  tts.speak('Hello world!', {
    voice: 'en',
    rate: 200,
    pitch: 75,
    volume: 1.2
  }, (audioData, sampleRate) => {
    SimpleTTS.playAudioData(audioData, sampleRate);
  });
});
```

## Demos

- `simple-demo.html` - Interactive demo with voice selection and controls
- `demo.min.html` - Minimal demo using minified version
- `compare-demo.html` - Compare with/without basic audio enhancement

## Original API

For direct access to the eSpeak-ng worker, use `espeakng.js`:

```javascript
const espeak = new eSpeakNG('js/espeakng.worker.js', () => {
  espeak.list_voices(voices => console.log(voices));
  espeak.set_voice('en');
  espeak.synthesize('Hello world', (samples, events) => {
    // Raw PCM samples
  });
});
```

## License

GPLv3 - Based on [eSpeak-ng](https://github.com/espeak-ng/espeak-ng)
