const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()

app.set("trust proxy", 1) // needed on Render so secure cookies work

app.use(cors({
    origin: [
        "https://resumeproject-delta.vercel.app",
        "http://localhost:5173" // Vite dev server
    ],
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

module.exports = app