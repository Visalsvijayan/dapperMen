const Product=require('../../models/productSchema')
const Category=require('../../models/categorySchema')
const Brand=require('../../models/brandSchema')
const User=require('../../models/userSchema')
const fs=require('fs');
const path=require('path');
const sharp=require("sharp");


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
                        .resize({ width: 300, height: 200 })
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
        const page=req.query.page || 1;
        const limit=4;
       
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
                totalpages:Math.ceil(count/limit),
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

        // Convert percentage to a number
        const offer = parseInt(percentage);
        if (isNaN(offer) || offer < 0) {
            return res.status(400).json({ status: false, message: "Invalid offer value" });
        }

        const findProduct = await Product.findById(productId);
        if (!findProduct) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        const findCategory = await Category.findById(findProduct.category);
        if (!findCategory) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        if (findCategory.categoryOffer > offer) {
            return res.json({ status: false, message: "This product category already has a higher offer" });
        }

        // Validate regularPrice
        const regularPrice = parseFloat(findProduct.regularPrice);
        if (isNaN(regularPrice)) {
            return res.status(400).json({ status: false, message: "Product has invalid regular price" });
        }

        // Calculate new sale price
        const salePrice = regularPrice - Math.floor(regularPrice * offer / 100);

        // Apply offer and save
        findProduct.salePrice = salePrice;
        findProduct.productOffer = offer;
        await findProduct.save();

        // Reset category offer
        findCategory.categoryOffer = 0;
        await findCategory.save();

        return res.json({ status: true });

    } catch (error) {
        console.error('Error in addProductOffer:', error);

        // Only respond once
        if (!res.headersSent) {
            return res.status(500).json({ status: false, message: "Internal server error" });
        }
    }
};

const removeProductOffer=async(req,res)=>{
    try {
        const {productId}=req.body;
        const findProduct=await Product.findOne({_id:productId})
        const percentage=findProduct.productOffer;
        findProduct.salePrice=findProduct.salePrice + Math.floor(findProduct.regularPrice*(percentage/100))
        findProduct.productOffer=0;
        await findProduct.save()
        res.json({status:true});
    } catch (error) {
        console.error('error in offer remval',error);
        res.redirect('/admin/pageNOtFound')
    }

}
const blockProduct=async (req,res)=>{
    try {
        let id=req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/products')
    } catch (error) {
        console.error('error in block the product',error)
        res.status(500).redirect('/admin/pageNotFound');
        
    }

    
}
const unblockProduct=async(req,res)=>{
    try {
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect('/admin/products')
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
        res.render('edit-product',{
            product:product,
            cat:category,
            brand:brand,
            selectedBrand

        })
    } catch (error) {
        res.status(500).redirect('/admin/pageNotFound')
        
    }
}

 
const editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const updates = req.body;
        const updatedIndexes = updates.updatedIndexes
                            ? updates.updatedIndexes.split(',').map(i => parseInt(i))
                            : [];
         
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.status(404).json("Product not found");
        }
        const duplicateProduct = await Product.findOne({
            productName: updates.productName,
            _id: { $ne: productId }
        });
        if (duplicateProduct) {
            return res.status(400).json("Product name already exists");
        }

        // Validate category
        const categoryId = await Category.findOne({ name: updates.category });
        if (!categoryId) {
            return res.status(400).json("Invalid category name");
        }

       
        let images = [...existingProduct.productImage];
        
         
        if (req.files && req.files.length > 0) {
           
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const replaceIndex = updatedIndexes[i];   
        
            const originalImagePath = file.path;
            const resizedFilename = `resized-${Date.now()}-${file.filename}`;
            const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFilename);
        
            await sharp(originalImagePath)
                .resize({ width: 300, height: 200 })
                .toFile(resizedImagePath);
        
            if (
                replaceIndex !== undefined &&
                !isNaN(replaceIndex) &&
                replaceIndex >= 0 &&
                replaceIndex < images.length
            ) {
                // Delete old image
                const oldImagePath = path.join('public', 'uploads', 'product-images', images[replaceIndex]);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
                 
                images[replaceIndex] = resizedFilename;
            } else {
               
                images.push(resizedFilename);
            }
          
            fs.unlinkSync(originalImagePath);
        }
 
    }

        // Update product data
        const updatedProduct = {
            productName: updates.productName,
            description: updates.descriptionData,
            brand: updates.brand,
            category: categoryId._id,
            regularPrice: updates.regularPrice,
            salePrice: updates.salePrice,
            quantity: updates.quantity,
            size: updates.size,
            color: updates.color,
            productImage: images,
            updatedOn: new Date()
        };

        // Save updated product
        await Product.findByIdAndUpdate(productId, updatedProduct, { new: true });
        
        return res.redirect(`/admin/products`);

    } catch (error) {
        console.log('Error updating product:', error);
        return res.redirect('/admin/pageerror');
    }
};
 
 
const getStockPage = async (req, res) => {
    try {
      const perPage = 4;  
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
  
      // Build search query
      const searchQuery = search
        ? { productName: { $regex: search, $options: 'i' } }  
        : {};
  
      
      const totalProducts = await Product.countDocuments(searchQuery);
  
      const products = await Product.find(searchQuery)
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