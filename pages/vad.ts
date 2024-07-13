import { MicVAD } from '@ricky0123/vad-web';
import {
    encodeWAV,
    //arrayBufferToBase64,
} from '@ricky0123/vad-web/dist/_common/utils';

console.log('VAD loaded');

// function encodeWAV(floatArray: Float32Array, sampleRate = 16000) {
//     const buffer = new ArrayBuffer(44 + floatArray.length * 2);
//     const view = new DataView(buffer);
//     const writeString = (offset: number, string: string) => {
//         for (let i = 0; i < string.length; i++) {
//             view.setUint8(offset + i, string.charCodeAt(i));
//         }
//     };

//     // Set up the RIFF chunk descriptor
//     writeString(0, 'RIFF');
//     view.setUint32(4, 36 + floatArray.length * 2, true);
//     writeString(8, 'WAVE');

//     // Set up the fmt sub-chunk
//     writeString(12, 'fmt ');
//     view.setUint32(16, 16, true);
//     view.setUint16(20, 1, true);
//     view.setUint16(22, 1, true);
//     view.setUint32(24, sampleRate, true);
//     view.setUint32(28, sampleRate * 2, true);
//     view.setUint16(32, 2, true);
//     view.setUint16(34, 16, true);

//     // Set up the data sub-chunk
//     writeString(36, 'data');
//     view.setUint32(40, floatArray.length * 2, true);

//     // Convert floatArray to Int16Array
//     const intArray = new Int16Array(floatArray.length);
//     for (let i = 0; i < floatArray.length; i++) {
//         const floatValue = Math.max(-1, Math.min(1, floatArray[i]));
//         intArray[i] =
//             floatValue < 0 ? floatValue * 0x8000 : floatValue * 0x7fff;
//     }

//     // Write audio data
//     const dataView = new DataView(buffer, 44);
//     for (let i = 0; i < intArray.length; i++) {
//         dataView.setInt16(i * 2, intArray[i], true);
//     }

//     return buffer;
// }

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
