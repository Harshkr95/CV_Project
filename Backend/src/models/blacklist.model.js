const mongoose= require("mongoose")

const BlacklistTokenSchema= new mongoose.Schema({
    token:{
        type:String,
        required:[true,"Token is Required"]
    }
},{timestamps:true})

const tokenBlacklistModel=mongoose.model("blacklistToken",BlacklistTokenSchema)

module.exports=tokenBlacklistModel