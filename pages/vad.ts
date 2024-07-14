import { MicVAD } from '@ricky0123/vad-web';
import {
    encodeWAV,
    //arrayBufferToBase64,
} from '@ricky0123/vad-web/dist/_common/utils';

console.log('VAD loaded');

export const listen = async (speechEndCallback = () => {}) => {
    return new Promise((resolve, reject) => {
        let vad: MicVAD;
        MicVAD.new({
            // submitUserSpeechOnPause: true,
            workletURL: '/vad.worklet.bundle.min.js',
            modelURL: '/silero_vad.onnx',
            redemptionFrames: 16, // default is 8
            ortConfig: (ort) => {
                ort.env.wasm.wasmPaths = '/';
            },
            onSpeechStart: () => {
                console.log('Speech start');
            },
            onSpeechEnd: async (arr) => {
                console.log('Speech end');
                const wavBuffer = encodeWAV(arr);
                const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                console.log(blob);
                vad?.destroy();
                speechEndCallback();
                fetch('/speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'audio/wav',
                    },
                    body: blob,
                })
                    .then(async (res) => {
                        if (!res.ok) {
                            reject(
                                new Error(
                                    `Failed to send audio: ${res.statusText}`,
                                ),
                            );
                        }
                        resolve(await res.json());
                    })
                    .catch(reject);
            },
        })
            .then((_vad) => {
                vad = _vad;
                vad.start();
                return vad;
            })
            .catch(reject);
    });
};
