const Groq = require("groq-sdk");
const puppeteer = require("puppeteer")
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema")

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
})

const MODEL = "openai/gpt-oss-20b"

/**
 * Converts a Zod schema to JSON Schema.
 * Zod v4 has this built in; older Zod versions use zod-to-json-schema.
 */
function toJsonSchema(schema) {
    if (typeof z.toJSONSchema === "function") {
        return z.toJSONSchema(schema)
    }
    return zodToJsonSchema(schema)
}

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate an interview report for a candidate with the following details:
    Resume: ${resume}
    Self Description: ${selfDescription}
    Job Description: ${jobDescription}

    Keep it concise: about 5 technical questions, 5 behavioral questions, and a 7 day preparation plan.`

    const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content: `Return only valid JSON matching this schema:
                ${JSON.stringify(toJsonSchema(interviewReportSchema))}`
            },
            {
                role: "user",
                content: prompt
            }
        ],
        response_format: {
            type: "json_object"
        },
        temperature: 0.4,
        reasoning_effort: "low",
        max_completion_tokens: 8192
    })

    const content = response.choices[0].message.content
    if (!content) {
        throw new Error("The AI returned an empty response. Please try again.")
    }

    return JSON.parse(content)
}

async function generatePdffromHTML(htmlcontent) {
    const browser = await puppeteer.launch()

    try {
        const page = await browser.newPage()
        await page.setContent(htmlcontent, { waitUntil: "networkidle0" })

        const pdfBuffer = await page.pdf({
            format: "A4",
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        })
        return pdfBuffer
    } finally {
        await browser.close()
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
                        
                        Return only the complete HTML document of the resume (starting with <!DOCTYPE html>), which can be converted to PDF using a library like puppeteer. Do not wrap it in JSON, markdown or code fences, and do not add any explanation.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content: "You output exactly one complete HTML document with inline CSS. No markdown, no code fences, no explanations."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.4,
        reasoning_effort: "low",
        max_completion_tokens: 8192
    })

    let html = response.choices[0].message.content || ""

    // Remove markdown code fences if the model added them
    html = html
        .replace(/^\s*```(?:html)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim()

    if (!html) {
        throw new Error("The AI returned an empty resume. Please try again.")
    }

    const pdfBuffer = await generatePdffromHTML(html)
    return pdfBuffer
}

module.exports = { generateInterviewReport, generateResumePdf }