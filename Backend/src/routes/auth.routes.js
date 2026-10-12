const authController=require("../controllers/auth.controller")
const authMiddleware=require("../middlewares/auth.middleware")

const {Router}=require("express")
const authRouter=Router()

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access public
*/

authRouter.post("/register",authController.registerUserController)

/**
 * @route POST /api/auth/login
 * @description login a user
 * @access public
*/

authRouter.post("/login",authController.loginUserController)

/**
 * @route GET /api/auth/register
 * @description Register a new user
 * @access public
*/

authRouter.get("/logout",authController.logoutUserController)

/**
 * @route GET /api/auth/register
 * @description Register a new user
 * @access private
*/

authRouter.get("/get-me",authMiddleware.authUser,authController.getMeUserController)

module.exports=authRouter