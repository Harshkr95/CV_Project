require("dotenv").config();

const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function test() {
    try {
        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                {
                    role: "user",
                    content: "tell me about Interview"
                }
            ]
        });

        console.log(response.choices[0].message.content);

    } catch (error) {
        console.error("Groq Error:", error);
    }
}

test();