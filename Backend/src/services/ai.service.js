const Groq = require("groq-sdk")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
})

const MODEL = "openai/gpt-oss-20b"


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
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
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

                        Keep it concise: about 7 technical questions, 7 behavioral questions, and a 7 day preparation plan.
`

    const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content: `Return only valid JSON matching this schema:
                ${JSON.stringify(zodToJsonSchema(interviewReportSchema))}`
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

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch()

    try {
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })

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

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume || "Not provided"}
                        Self Description: ${selfDescription || "Not provided"}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.

                        STRICT ONE-PAGE RULES:
                        - The resume MUST fit on exactly ONE A4 page. Never more than one page.
                        - The renderer adds the page margins (10mm top/bottom, 12mm left/right). Start the CSS with: html, body { margin: 0; padding: 0; }
                        - Do NOT use @page rules, vh/vw units, min-height, fixed or absolute positioning, or page-break rules.
                        - Single column layout only. No sidebars, no images, no icons, no layout tables.
                        - About 450-550 words in total.
                        - Fonts: body 10pt (10.5pt max), name 18-20pt, section headings 11-12pt, line-height 1.3. Never go below 9.5pt.
                        - Small spacing: about 6-8px between sections and 2-3px between bullets.
                        - Maximum 3 bullet points per job or project, each 1-2 lines long.
                        - Include only the 2-3 most relevant projects and the experience most relevant to the job description.
                        - Write skills as compact comma-separated lines grouped by category.
                        - Keep education to 1-2 lines per entry.
                        - If something does not fit, remove the least relevant content instead of shrinking the text.

                        CONTENT RULES:
                        - Use only facts present in the resume or self description. Do NOT invent employers, dates, degrees, metrics or skills.
                        - Keep the contact details (name, phone, email, links) at the top exactly as given.
                        - Use standard section names (Summary, Skills, Projects, Experience, Education, Certifications).
                    `

    const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content: `Return only valid JSON matching this schema:
                ${JSON.stringify(zodToJsonSchema(resumePdfSchema))}`
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
        throw new Error("The AI returned an empty resume. Please try again.")
    }

    const jsonContent = resumePdfSchema.parse(JSON.parse(content))

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}

module.exports = { generateInterviewReport, generateResumePdf }