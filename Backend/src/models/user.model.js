const mongoose= require("mongoose")

const userSchema= new mongoose.Schema({
    username:{
        type:String,
        unique:[true,"Already Taken"],
        required:true
    },
    email:{
        type:String,
        unique:[true,"Already Used"],
        required:true
    },
    password:{
        type:String,
        required:true
    }
}) 

const userModel=mongoose.model("users",userSchema)

module.exports=userModel