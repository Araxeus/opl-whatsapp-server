import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import z from 'zod';

const expectedResults = z.object({
    carID: z.string().optional(),
    km: z.number().optional(),
    startingPoint: z.string().optional(),
    destination: z.string().optional(),
});

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

input: "דיווח על רכב 320 43 702" -> output: {"carID": "320-43-702"}
input: "323 45 702 מאילן קרגלס לבן אליעזר 82 קילומטר 42,730" -> output: {"carID":"323-45-702","km":42730,"startingPoint":"אילן קרגלס","destination":"בן אליעזר 82"}
`;

async function inferCarData(text: string) {
    try {
        const completion = await openai.beta.chat.completions.parse({
            model: 'gpt-4o-2024-08-06', //'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
            ],
            response_format: zodResponseFormat(expectedResults, 'parking_data'),
        });
        const output = completion.choices[0].message.parsed;

        return {
            result: output,
            usage: completion.usage,
        };
    } catch (error) {
        console.error('Error parsing or fetching data:', error?.toString());
        return {};
    }
}

export default {
    inferCarData,
};
