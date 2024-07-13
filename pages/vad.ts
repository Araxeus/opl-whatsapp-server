import { MicVAD } from '@ricky0123/vad-web';
import {
    encodeWAV,
    //arrayBufferToBase64,
} from '@ricky0123/vad-web/dist/_common/utils';

console.log('VAD loaded');

export const listen = async () => {
    return new Promise((resolve, reject) => {
        MicVAD.new({
            // submitUserSpeechOnPause: true,
            workletURL: '/vad.worklet.bundle.min.js',
            modelURL: '/silero_vad.onnx',
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
                fetch('/speech-v2', {
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
                // const base64 = arrayBufferToBase64(wavBuffer);
                // const url = `data:audio/wav;base64,${base64}`;
            },
        })
            .then((vad) => {
                vad.start();
            })
            .catch(reject);
    });
};
