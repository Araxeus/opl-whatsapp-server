import type { IncomingMessage } from 'node:http';
import OpenAI, { toFile } from 'openai';
import { isValidAudioWavRequest } from 'utils';

// Define an interface for the expected JSON output
interface CarData {
    carID?: string; // Optional field
    km?: number; // Optional field
    startingPoint?: string; // Optional field
    destination?: string; // Optional field
}

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
etc..

Output only valid parsable JSON in the specified format. The JSON must start with { and end with }.

After creating the output, check it to ensure it adheres to the JSON rules above, especially the car number format.

If the input is invalid or incomplete, return an empty JSON object: {}.
`;

function inferCarDataFromText(
    text: string,
    parse: true,
): Promise<{
    result: CarData;
    usage: OpenAI.Completions.CompletionUsage;
}>;
function inferCarDataFromText(
    text: string,
    parse?: false,
): Promise<{
    result: string;
    usage: OpenAI.Completions.CompletionUsage;
}>;
async function inferCarDataFromText(text: string, parse = false) {
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

        console.log('Completion:\n', JSON.stringify(completion, null, 2)); // DELETE or use logger

        const output = completion.choices[0].message.content?.trim() ?? '';

        console.log(`Output:\n${output}`); // DELETE or use logger

        // Try to parse the response as JSON
        // const jsonResponse: CarData = output ? JSON.parse(output) : {};
        // Additional validation to ensure carID format if present
        // if (
        //     jsonResponse.carID &&
        //     !/^\d{3}-\d{2}-\d{3}$/.test(jsonResponse.carID)
        // ) {
        //     // throw new Error('Invalid carID format');
        //     console.error('Invalid carID format');
        // }

        return {
            result: parse ? (JSON.parse(output) as CarData) : output,
            usage: completion.usage,
        };
    } catch (error) {
        console.error('Error parsing or fetching data:', error?.toString());
        return {};
    }
}

export async function speechToCarData(req: IncomingMessage) {
    if (!isValidAudioWavRequest(req)) {
        throw new Error('Invalid request: Content-Type is not audio/wav');
    }
    const transcription = await openai.audio.transcriptions.create({
        file: await toFile(req, 'audio.wav', {
            type: 'audio/wav',
        }),
        model: 'whisper-1',
        language: 'he',
    });

    console.log('Transcription:\n', JSON.stringify(transcription, null, 2)); // DELETE or use logger

    return await inferCarDataFromText(transcription.text);
}
