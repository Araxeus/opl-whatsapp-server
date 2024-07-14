import type { IncomingMessage } from 'node:http';
import logger from 'logger';
import OpenAI, { toFile } from 'openai';
import type { Logger } from 'pino';

if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY must be defined');
}

// Initialize the OpenAI client with the API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Ensure to set the API key in environment variables
});

const systemPrompt = `
You will act as an interpreter between the output of a hebrew speech recognition, and a program that receive json data with the following fields:
{
  carID: string, // MUST BE of format 123-45-678 (can be missing numbers but must have the dashes after the first 3 and 5 digits)
  km: number
  startingPoint: string
  destination: string
}

You will try to infer this data from the input in hebrew, USE ONLY EXISTING DATA - if the user didn't specify a key then don't include it.
(for example user might only provide startingPoint, or he might only provide km and destination, etc..)

Simplify the name of places and remove prefixes - for example:
"מהכוננות" should become "כוננות"
"מאילן קארגלאס" should become "אילן קארגלאס"
"הביתה" should become "בית"

Infer the correct way to write the car number, for example:
327-50-42-3 becomes 327-50-423,
1234-56-7 becomes 123-45-67,
123.56.432 becomes 123-56-432,
1 2 34 5 67 becomes 123-45-67,
320, 437, 02 becomes 320-43-702,
etc..

Output only valid parsable JSON in the specified format. The JSON must start with { and end with }.

After creating the output, check it to ensure it adheres to the JSON rules above, especially the car number format.

If the input is invalid or incomplete, return an empty JSON object: {}.

Complete examples:
input: "רכב מספר 720 458 0 3 מאילן קרגלס ירושלים לדרך בית לחם 142 קילומטר 703-27"
output: {
  "carID": "720-45-803",
  "km": 70327,
  "startingPoint": "אילן קארגלס, ירושלים",
  "destination": "דרך בית לחם 142"
}

input: "מהכוננות לביתה 243, 5-7"
output: {
  "startingPoint": "כוננות",
  "destination": "בית",
  "carID": "243-57"
}

input: "24370824"
output: {
  "carID": "243-70-824"
}
`;

async function inferCarDataFromText(
    text: string,
    log: Logger,
): Promise<{
    result: string;
    usage?: OpenAI.Completions.CompletionUsage;
}> {
    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: text,
                },
            ],
            model: 'gpt-4o', //'gpt-3.5-turbo',
            response_format: { type: 'json_object' },
        });

        return {
            result: completion.choices[0].message.content?.trim() ?? '',
            usage: completion.usage as OpenAI.Completions.CompletionUsage,
        };
    } catch (error) {
        log.error('Error parsing or fetching data:', error?.toString());
        return { result: '{}' };
    }
}

export async function speechToCarData(req: IncomingMessage, username: string) {
    if (req.headers['content-type'] !== 'audio/wav') {
        throw new Error('Invalid request: Content-Type is not audio/wav');
    }

    const transcription =
        (await openai.audio.transcriptions.create({
            file: await toFile(req, 'audio.wav', {
                type: 'audio/wav',
            }),
            model: 'whisper-1',
            language: 'he',
            prompt: '"רכב 320-43-702 מאילן קארגלס לדרך בית לחם 164, קילומטר 43720" "123-45-678" "דיווח על 876-54-321 חונה ביסמין, מקור צריפין"',
        })) || {};

    const log = logger.child({
        module: 'speechToCarData',
        user: username,
    });

    transcription.text ??= '';

    log.info(transcription);

    return await inferCarDataFromText(transcription.text, log);
}
