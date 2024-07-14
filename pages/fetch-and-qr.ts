import type { toCanvas } from 'qrcode';
import type { WhatsappLoginResult, WhatsappRoutineResult } from 'whatsapp';
import type { CarParkingInfo } from 'whatsapp/park-car';
import type { ReplaceClientCarInfo } from 'whatsapp/replace-client-car';
// IMPORTANT: can only import types from src folder since this is compiled to js and run in browser

type FetchAndQrData =
    | CarParkingInfo
    | ReplaceClientCarInfo
    | { userID: string };

type OnSuccess = (res: WhatsappRoutineResult) => void;

declare const QRCode: { toCanvas: typeof toCanvas } | undefined;

// declare interface Window {
//     QRCode: typeof QRCode;
// }

const $ = document.querySelector.bind(document) as (
    selector: string,
) => HTMLElement | null;

$('a.back-button')?.addEventListener('click', (e) => {
    if (document.referrer === (e.target as HTMLAnchorElement).href) {
        e.preventDefault();
        history.back();
    }
});

// biome-ignore lint/complexity/noForEach: forEach is better for NodeList
document.querySelectorAll('.carID').forEach((input) => {
    input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const cursorPosition = target.selectionStart ?? 0;
        const originalValue = target.value;
        const x =
            /(\d{0,3})(\d{0,2})(\d{0,3})/.exec(
                target.value.replace(/\D/g, ''),
            ) ?? [];

        target.value = !x[2]
            ? x[1]
            : `${x[1]}-${!x[3] ? x[2] : `${x[2]}-${x[3]}`}`;

        // Calculate the new cursor position
        let newCursorPosition = cursorPosition;
        if (originalValue.length > target.value.length) {
            // If a character was deleted, adjust the cursor position accordingly
            if (cursorPosition === 4 || cursorPosition === 8) {
                newCursorPosition--;
            }
        } else if (originalValue.length < target.value.length) {
            // If a character was added, adjust the cursor position accordingly
            if (cursorPosition === 4 || cursorPosition === 7) {
                newCursorPosition++;
            }
        }

        // Set the cursor position
        target.setSelectionRange(newCursorPosition, newCursorPosition);
    });
});

type FetchAndQrOptions = {
    path: string;
    data: FetchAndQrData;
    mainContainerSelector: string;
    onSuccess: OnSuccess;
    onQrSuccess?: OnSuccess;
    onError?: (error: unknown) => void;
};

interface SavedRequest extends FetchAndQrOptions {
    response: WhatsappRoutineResult | WhatsappLoginResult;
    onQrSuccess: OnSuccess;
    onError: (error: unknown) => void;
}

const req = {} as SavedRequest;

export async function fetchAndQr({
    path,
    data,
    mainContainerSelector,
    onError,
    onSuccess,
    onQrSuccess = onSuccess,
}: FetchAndQrOptions) {
    try {
        req.onError =
            onError ||
            ((err) => {
                console.error(err);
                alertSoon(
                    `Error: ${
                        err && typeof err === 'object' && 'message' in err
                            ? err.message
                            : JSON.stringify(err, null, 2)
                    }`,
                );
            });

        const response = await fetch(path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(
                `${path} failed: ${response.statusText} - ${response.status}`,
            );
        }

        const json = (await response.json()) as SavedRequest['response'];
        const success = 'success' in json && json.success;
        const qrCode = 'qrCode' in json && json.qrCode;
        const error = 'error' in json && json.error;

        req.path = path;
        req.data = data;
        req.mainContainerSelector = mainContainerSelector;
        req.onSuccess = onSuccess;
        req.onQrSuccess = onQrSuccess;
        req.response = json;

        if (qrCode) {
            handleQrResponse();
        } else {
            if (!success) {
                throw new Error(
                    `Error on form submission success=${success}: ${JSON.stringify(error, null, 2)}`,
                );
            }
            onSuccess(json);
        }
    } catch (error) {
        req.onError(error);
    }
}

function handleQrResponse() {
    // inject new script from /vendor/qrcode.js
    console.log('qrCode response found, handling it...'); // DELETE
    if ('QRCode' in window) {
        showQrCode();
    } else {
        const script = document.createElement('script');
        script.src = '/vendor/qrcode.js';
        script.onload = () => {
            console.log('qrcode.js loaded'); // DELETE
            showQrCode();
        };
        document.head.appendChild(script);
        console.log('qrcode.js injected to doc.head'); // DELETE
    }

    return;
}

function showQrCode() {
    if (!('qrCode' in req.response)) throw new Error('No qrCode in response');
    const qrCode = req.response.qrCode;

    const { mainContainerSelector, onQrSuccess } = req;
    const mainContainer = $(mainContainerSelector);
    checkExists(mainContainer, mainContainerSelector);
    const canvas = $('canvas');
    checkExists(canvas, 'canvas');

    console.log('injecting QR code'); // DELETE
    checkExists(QRCode, 'QRCode global variable');

    QRCode.toCanvas(canvas, qrCode, (err) => {
        if (err) throw err;
        console.log('QR code injected'); // DELETE
        checkExists(canvas.parentElement, 'canvas.parentElement');

        // hide login form
        mainContainer.style.display = 'none';
        // show QR code
        canvas.parentElement.style.display = 'block';
    });

    const tempToken =
        'tempToken' in req.response ? `?token=${req.response.tempToken}` : '';

    const Server = new EventSource(`/sse${tempToken}`);
    Server.addEventListener('qr', (event) => {
        console.log('qr event received'); // DELETE
        const qrCode = JSON.parse(event.data);
        QRCode.toCanvas(canvas, qrCode, (err) => {
            if (err) throw err;
            console.log('QR code updated'); // DELETE
        });
    });

    Server.addEventListener('authenticated', () => {
        console.log('Successfully authenticated'); // DELETE

        checkExists(canvas.parentElement, 'canvas.parentElement');
        mainContainer.style.display = 'initial';
        canvas.parentElement.style.display = 'none';
        Server.close();
        setTimeout(() => onQrSuccess(req.response), 50);
    });

    Server.addEventListener('error', (event) => {
        console.error('EventSource error:', JSON.stringify(event, null, 2));
    });
}

export function alertSoon(message: string) {
    setTimeout(() => alert(message), 50);
}

function checkExists(
    something: unknown,
    name: string,
): asserts something is NonNullable<unknown> {
    if (!something) {
        throw new Error(`CRITICAL ERROR: ${name} not found`);
    }
}
