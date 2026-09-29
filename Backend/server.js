require("dotenv").config()
const app= require("./src/app.js")
const connectToDB=require("./src/config/database.js")
connectToDB()

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});