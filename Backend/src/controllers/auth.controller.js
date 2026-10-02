const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const userModel = require("../models/user.model")
const tokenBlacklistModel = require("../models/blacklist.model")

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000
    //1 day
}

/**
 * @name registerUserController
 * @description register a new user
 * @access public
 */

async function registerUserController(req, res) {
    try {
        const { username, email, password } = req.body

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "not found"
            })
        }

        // Match an existing user with the same username OR the same email
        const isUserAlreadyExists = await userModel.findOne({
            $or: [{ username }, { email }]
        })

        if (isUserAlreadyExists) {
            return res.status(400).json({
                message: "user already exists"
            })
        }

        const hash = await bcrypt.hash(password, 10)

        const user = await userModel.create({
            username,
            email,
            password: hash
        })

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        )

        res.cookie("token", token, cookieOptions)

        res.status(201).json({
            message: "user registered successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        })//sends this response to the frontend
    } catch (err) {
        console.error(err)
        // 11000 = duplicate key (when the model has unique fields)
        if (err.code === 11000) {
            return res.status(400).json({ message: "user already exists" })
        }
        res.status(500).json({ message: "registration failed" })
    }
}

/**
 * @name loginUserController
 * @description login a user
 * @access public
 */

async function loginUserController(req, res) {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: "email and password not found" })
        }

        const user = await userModel.findOne({ email })

        if (!user || !user.password) {
            return res.status(400).json({ message: "please register first" })
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
            return res.status(400).json({ message: "password is not valid" })
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        )

        res.cookie("token", token, cookieOptions)

        res.status(200).json({
            message: "user logged in successfully",
            user: { id: user._id, username: user.username, email: user.email }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "login failed" })
    }
}

/**
 * @name logoutUserController
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */

async function logoutUserController(req, res) {
    try {
        const token = req.cookies.token

        if (token) {
            await tokenBlacklistModel.create({ token })
        }

        res.clearCookie("token", {
            httpOnly: true,
            secure: true,
            sameSite: "none"
        })

        res.status(200).json({
            message: "logout success"
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "logout failed" })
    }
}

/**
 * @name getMeUserController
 * @description  get the current logged in user details.
 * @access private
 */

async function getMeUserController(req, res) {
    try {
        const user = await userModel.findById(req.user.id)

        if (!user) {
            return res.status(404).json({ message: "user not found" })
        }

        res.status(200).json({
            message: "User details fetched successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "failed to fetch user" })
    }
}

module.exports = { registerUserController, loginUserController, logoutUserController, getMeUserController }