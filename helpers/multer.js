// const multer=require("multer");
// const path=require('path');

// const storage=multer.diskStorage({
//     destination:(req,file,cb)=>{
//         cb(null,path.join(__dirname,"../public/uploads/re-image"));
//         cb(null,path.join(__dirname,"../public/uploads/product-images"));
//     },
//     filename:(req,file,cb)=>{
//         cb(null,Date.now()+"-"+file.originalname);
//     }
    
// })

// module.exports=storage;

const multer = require("multer");
const path = require("path");

// Storage for Product Images
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../public/uploads/product-images")); // Store product images
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

// Storage for Brand Images
const brandStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../public/uploads/re-image")); // Store brand images
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

// Create Multer instances
const uploadProductImages = multer({ storage: productStorage });
const uploadBrandImage = multer({ storage: brandStorage });

module.exports = { uploadProductImages, uploadBrandImage };
