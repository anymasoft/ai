import OpenAI from "openai";
import "dotenv/config";

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({
    apiKey,
    ...(baseURL && { baseURL }),
});

export default openai;
