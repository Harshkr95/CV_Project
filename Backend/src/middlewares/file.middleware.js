const multer=require("multer")

const upload=multer({
    Storage:multer.memoryStorage(),
    limits:{
        filesize:3*1024*1024,//3MB
    }
    
})
module.exports=upload