import OpenAI from 'openai';

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

Output only valid parsable JSON in the specified format. The JSON must start with { and end with }.

After creating the output, check it to ensure it adheres to the JSON rules above, especially the car number format.

If the input is invalid or incomplete, return an empty JSON object: {}.
`;

function inferCarData(
    text: string,
    parse: true,
): Promise<{
    result: CarData;
    usage: OpenAI.Completions.CompletionUsage;
}>;
function inferCarData(
    text: string,
    parse?: false,
): Promise<{
    result: string;
    usage: OpenAI.Completions.CompletionUsage;
}>;
async function inferCarData(text: string, parse = false) {
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
        const output = completion.choices[0].message.content?.trim() ?? '';

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

export default {
    inferCarData,
};
