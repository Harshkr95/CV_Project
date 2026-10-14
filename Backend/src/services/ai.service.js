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
                top: "10mm", 
                bottom: "10mm", 
                left: "12mm", 
                right: "12mm" 
            }
        })
        return pdfBuffer
    } finally {
        await browser.close()
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate a resume for a candidate with the following details:
        Resume: ${resume || "Not provided"}
        Self Description: ${selfDescription || "Not provided"}
        Job Description: ${jobDescription}

        PAGE SPECIFICATION (the renderer adds the margins, you do not):
        - Output is rendered to A4 with 10mm top/bottom and 12mm left/right margins.
        - Usable area is about 186mm wide x 277mm tall. The content MUST fit inside it on ONE page. Never more.
        - Start the CSS with: html, body { margin: 0; padding: 0; }
        - Do NOT use @page rules, vh/vw units, min-height, fixed or absolute positioning, or page-break rules.
        - Use a single column layout. No sidebars, no tables for layout, no images, no icons.

        SIZE RULES:
        - About 450-550 words total.
        - Fonts: body 10pt (10.5pt max), name 18-20pt, section headings 11-12pt, line-height 1.3.
        - Spacing: about 6-8px between sections, 2-3px between bullets.
        - Max 3 bullets per job or project, each 1-2 lines.
        - Include only the 2-3 most relevant projects and the experience most relevant to the job description.
        - Skills as compact comma-separated lines grouped by category.
        - Education in 1-2 lines per entry.
        - If something does not fit, remove the least relevant content. Do not shrink the font below 9.5pt.
        ${tooLong ? "- The previous version was TOO LONG. Cut at least 30% of the content: fewer bullets, shorter lines, fewer projects.\n" : ""}
        CONTENT RULES:
        - Use only facts present in the resume or self description. Do NOT invent employers, dates, degrees, metrics or skills.
        - Rephrase and reorder to match the job description, and use its keywords where they are truthful.
        - Start bullets with strong action verbs, and include numbers or outcomes only if the source has them.
        - Write like a real person: plain, specific wording, no buzzwords such as "passionate", "results-driven" or "leveraged".
        - Keep the contact details (name, phone, email, links) at the top exactly as given.
        - ATS friendly: real text, standard section names (Summary, Skills, Projects, Experience, Education, Certifications).
        - Simple professional look. One accent color for headings is fine.

        Return only the complete HTML document (starting with <!DOCTYPE html>) with inline CSS. No JSON, no markdown, no code fences, no explanation.`

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

    // "```html\n<!DOCTYPE html>...</html>\n```"
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