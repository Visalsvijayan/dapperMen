const Product=require('../../models/productSchema')
const Category=require('../../models/categorySchema')
const Brand=require('../../models/brandSchema')
const User=require('../../models/userSchema')
const fs=require('fs');
const path=require('path');
const sharp=require("sharp");
const { find } = require('../../models/addressSchema');


const getProductAddPage=async (req,res)=>{
    try {
        const category=await Category.find({isListed:true});
        const brand=await Brand.find({isBlocked:false})
        res.render('product-add',{
            cat:category,
            brand:brand

        });
    } catch (error) {
        console.log("error in get product add page",error)
        res.redirect('/pageerror')
        
    }
}

 
const addProducts = async (req, res) => {
     
    try {
        const products = req.body;

        // Check if the product already exists
        const productExists = await Product.findOne({ productName: products.productName });
        if (productExists) {
            return res.status(400).json("Product already exists, please try with another name");

        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                try {
                    const originalImagePath = file.path;
                    const resizedFilename = `resized-${Date.now()}-${file.filename}`;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFilename);

                    // Resize and save image
                    await sharp(originalImagePath)
                        .resize({ width: 500, height: 500 })
                        .toFile(resizedImagePath);

                    images.push(resizedFilename);
                } catch (error) {
                    console.log('Error processing image:', error);
                }
            }
        }

        // Validate category
        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).json("Invalid category name");
        }

        // Create a new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            offerAmount:(products.regularPrice)-(products.salePrice),  //added 
            createdOn: new Date(),
            quantity: products.quantity,
            size: products.size,
            color: products.color,
            productImage: images, // Save multiple images
            status: 'Available',
        });

        await newProduct.save();
        return res.redirect("/admin/addProducts");

    } catch (error) {
        console.log('Error saving product:', error);
        return res.redirect('/admin/pageerror');
    }
};


const getAllProducts=async(req,res)=>{
    try {
        const search=req.query.search || "";
        const page=parseInt(req.query.page) || 1;
        const limit=5;
       
        const productData=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}},

            ]
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .populate('category')
        .exec();

        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}},

            ]

        }).countDocuments();
        const category=await Category.find({isListed:true});
        const brand=await Brand.find({isBlocked:false});
        
        if(category&&brand){
            res.render("products",{
                data:productData,
                currentPage:page,
                search,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand,
         
            })
        }
        else{
            res.redirect('/admin/pageerror');
        }
    } catch (error) {
        console.error("product listing error:",error)
        res.redirect('/admin/pageerror');
    }

}
 
 
const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;
        const offer = parseInt(percentage);

        if (isNaN(offer) || offer < 0) {
            return res.status(400).json({ status: false, message: "Invalid offer value" });
        }

        const product = await Product.findById(productId).populate('category');
        if (!product) return res.status(404).json({ status: false, message: "Product not found" });

        const categoryOffer = product.category.categoryOffer || 0;

        // Prevent applying if category offer is greater or equal
        if (categoryOffer >= offer) {
            return res.json({ status: false, message: `Cannot apply. This product belongs to a category with ${categoryOffer}% offer.` });
        }

        // Apply new product offer
        const offerAmount = Math.round(product.regularPrice * (offer / 100));
        product.productOffer = offer;
        product.offerAmount = offerAmount;
        product.salePrice = product.regularPrice - offerAmount;
        await product.save();

        res.json({ status: true, message: "Product offer applied successfully" });

    } catch (error) {
        console.error("Error in addProductOffer:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};
const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;
        const product = await Product.findById(productId).populate('category');

        if (!product) return res.status(404).json({ status: false, message: "Product not found" });

        product.productOffer = 0;
        product.offerAmount = 0;

        // If category offer exists, apply it
        const categoryOffer = product.category.categoryOffer || 0;
        if (categoryOffer > 0) {
            const offerAmount = Math.round(product.regularPrice * (categoryOffer / 100));
            product.offerAmount = offerAmount;
            product.salePrice = product.regularPrice - offerAmount;
        } else {
            product.salePrice = product.regularPrice; // no discount at all
        }

        await product.save();
        res.json({ status: true });

    } catch (error) {
        console.error("Error in removeProductOffer:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};


const blockProduct=async (req,res)=>{
    try {
        let id=req.query.id
        let page=req.query.page;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect(`/admin/products?page=${page}`)
    } catch (error) {
        console.error('error in block the product',error)
        res.status(500).redirect('/admin/pageNotFound');
        
    }

    
}
const unblockProduct=async(req,res)=>{
    try {
        let id=req.query.id;
        let page=req.query.page;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect(`/admin/products?page=${page}`)
    } catch (error) {
        res.status(500).redirect('/admin/pageNotFound');
    }

}


const getEditProduct=async(req,res)=>{
    try {
        const id=req.query.id;
        const product=await Product.findOne({_id:id});
        const category=await Category.find({})
        const brand=await Brand.find({});
        const selectedBrand=product.brand
        const findCategory=await Product.findOne({_id:id}).populate('category')
        const selectedCategory=findCategory.category.name
     
        res.render('edit-product',{
            product:product,
            cat:category,
            brand:brand,
            selectedBrand,
            selectedCategory

        })
    } catch (error) {
        res.status(500).redirect('/admin/pageNotFound')
        
    }
}

 
const editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const updates = req.body;
        const currentPage = parseInt(req.query.page) || 1;

        const updatedIndexes = updates.updatedIndexes
            ? updates.updatedIndexes.split(',').map(i => parseInt(i))
            : [];

        const existingProduct = await Product.findById(productId);
        if (!existingProduct) return res.status(404).json("Product not found");

        const duplicateProduct = await Product.findOne({
            productName: updates.productName,
            _id: { $ne: productId }
        });
        if (duplicateProduct) return res.status(400).json("Product name already exists");

        const categoryId = await Category.findOne({ name: updates.category });
        if (!categoryId) return res.status(400).json("Invalid category name");

        let images = [...existingProduct.productImage];

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const replaceIndex = updatedIndexes[i];

                const originalImagePath = file.path;
                const resizedFilename = `resized-${Date.now()}-${file.filename}`;
                const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFilename);

                await sharp(originalImagePath)
                    .resize({ width: 500, height: 500 })
                    .toFile(resizedImagePath);

                // Replace or push image
                if (
                    replaceIndex !== undefined &&
                    !isNaN(replaceIndex) &&
                    replaceIndex >= 0 &&
                    replaceIndex < images.length
                ) {
                    // Delete old image
                    const oldImagePath = path.join('public', 'uploads', 'product-images', images[replaceIndex]);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlink(oldImagePath, (err) => {
                            if (err) console.error("Failed to delete old image:", err.message);
                        });
                    }
                    images[replaceIndex] = resizedFilename;
                } else {
                    images.push(resizedFilename);
                }

                // Delete temp original uploaded image
                if (fs.existsSync(originalImagePath)) {
                    fs.unlink(originalImagePath, (err) => {
                        if (err) console.error("Failed to delete original image:", err.message);
                    });
                }
            }
        }

        // Prepare update object
        const updatedProduct = {
            productName: updates.productName,
            description: updates.descriptionData,
            brand: updates.brand,
            category: categoryId._id,
            regularPrice: updates.regularPrice,
            salePrice: updates.salePrice,
            offerAmount: updates.regularPrice - updates.salePrice,
            quantity: updates.quantity,
            size: updates.size,
            color: updates.color,
            productImage: images,
            updatedOn: new Date()
        };

        // Save update
        await Product.findByIdAndUpdate(productId, updatedProduct);

        return res.redirect(`/admin/products?page=${currentPage}`);
    } catch (error) {
        console.log('Error updating product:', error);
        return res.redirect('/admin/pageerror');
    }
};

 
const getStockPage = async (req, res) => {
    try {
      const perPage = 6;  
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
  
      // Build search query
      const searchQuery = search
        ? { productName: { $regex: search, $options: 'i' } }  
        : {};
  
      
      const totalProducts = await Product.countDocuments(searchQuery);
  
      const products = await Product.find(searchQuery).sort({updatedAt:-1})
        .populate('category')
        .skip((page - 1) * perPage)
        .limit(perPage);
  
      const totalPages = Math.ceil(totalProducts / perPage);
  
      res.render('stock', {
        products,
        currentPage: page,
        totalPages,
        search,
      });
    } catch (error) {
      console.error('Error in stock listing:', error);
      res.status(500).redirect('/admin/pageerror');
    }
};
  

const updateQuantity=async(req,res)=>{
    try {
        const {quantity}=req.body;
        await Product.findByIdAndUpdate(req.params.id,{quantity})
        res.json({success:true})
    } catch (error) {
        console.error('error in update quantity',error)
        res.status(500).json({success:false,message:'error '})
    }
}

module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    getStockPage,
    updateQuantity

}