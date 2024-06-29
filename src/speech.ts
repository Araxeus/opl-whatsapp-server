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
    carID: string, // MUST BE of format 123-45-678 
    km: number 
    startingPoint: string 
    destination: string 
}

you will try to infer this data from the input in hebrew, if one of the fields isn't present in the input then do not include it in the json output

do not include prefixes, infer the name of the place - for example:
"מהכוננות" should become "כוננות"
"מאילן קארגלאס" should become "אילן קארגלאס"
"הביתה" should become "בית"

output only valid parsable json in the format specified above! - output starts with { and ends with }

after creating the output, check it again to make sure it adheres to the json rules above - especially the car number format 
`;

function inferCarData(text: string, parse: true): Promise<CarData>;
function inferCarData(text: string, parse?: false): Promise<string>;
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
            model: 'gpt-3.5-turbo',
            response_format: { type: 'json_object' },
        });

        const output = completion.choices[0].message.content?.trim() || '';

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

        return parse ? (JSON.parse(output) as CarData) : output;
    } catch (error) {
        console.error('Error parsing or fetching data:', error?.toString());
        return {};
    }
}

export default {
    inferCarData,
};
