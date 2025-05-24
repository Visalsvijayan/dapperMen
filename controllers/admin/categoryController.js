const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')

const categoryInfo=async (req,res)=>{
    try {
        let search=""
        
        if(req.query.search){
             search=req.query.search
             
        }
         
        const page=parseInt(req.query.page) || 1
        const limit=4;
        const skip=(page-1)*limit;

        const categoryData=await Category.find({ $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]})
        .sort({})
        .skip(skip)
        .limit(limit);

        const totalCategories=await Category.countDocuments();
      
        const totalPages=Math.ceil(totalCategories/limit);
        res.render('categorymanagement',{
            cata:categoryData,
            currentPage:page,
            totalpages:totalPages,
            totalCategories:totalCategories


        });
    } catch (error) {
        console.log('error in category page',error)
        res.redirect('/pageerror')
    }
}

const addCategory= async(req,res)=>{
    const {name,description}=req.body;
    try {
        const existingCategory = await Category.findOne({
            name: { $regex: `^${name}$`, $options: 'i' }
        });
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"})

        }
        const newCategory=new Category({
            name,
            description
        })
        await newCategory.save();
        return res.json({message:'category added successfully'})
       

    } catch (error) {
        return res.status(500).json({error:"internal server error"})

        
    }
}

  
const addOffer = async (req, res) => {
    try {
        const { categoryId, offerPercentage } = req.body;
        const offer = parseInt(offerPercentage);

        if (!categoryId || isNaN(offer)) {
            return res.json({ status: false, message: "Invalid data" });
        }

        const category = await Category.findById(categoryId);
        if (!category) return res.json({ status: false, message: "Category not found" });

        const products = await Product.find({ category: category._id });

        // Apply offer to each product in category
        for (let product of products) {
            const effectiveOffer = Math.max(product.productOffer, offer);
            const offerAmount = Math.round(product.regularPrice * (effectiveOffer / 100));
            product.offerAmount = offerAmount;
            product.salePrice = product.regularPrice - offerAmount;
            await product.save();
        }

        // Save category offer
        category.categoryOffer = offer;
        await category.save();

        res.json({ status: true, message: "Category offer applied successfully" });

    } catch (error) {
        console.error("Error in addOffer:", error);
        res.status(500).json({ status: false, message: "Server error" });
    }
};
const removeOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });

        for (let product of products) {
            // If product has product-specific offer
            if (product.productOffer > 0) {
                const offerAmount = Math.round(product.regularPrice * (product.productOffer / 100));
                product.offerAmount = offerAmount;
                product.salePrice = product.regularPrice - offerAmount;
            } else {
                // Otherwise reset to regular price (no offer)
                product.offerAmount = 0;
                product.salePrice = product.regularPrice;
            }

            await product.save();
        }

        // Remove category offer
        category.categoryOffer = 0;
        await category.save();

        res.json({ status: true, message: "Category offer removed successfully" });

    } catch (error) {
        console.error("Error in removeOffer:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};


const getlistCategory=async(req,res)=>{
    try {
        let id=req.query.id
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect("/admin/category");
    } catch (error) {

        console.log('error in the getlistcategory route')
        res.redirect('/pageerror');
    }
}
const getUnlistCategory=async(req,res)=>{
    let id=req.query.id;
    await Category.updateOne({_id:id},{$set:{isListed:true}})
    res.redirect('/admin/category');
}

const geteditCategory=async(req,res)=>{
    try {
        const id=req.query.id
        const category=await Category.findById(id);
        res.render('edit-category',{category:category});

    } catch (error) {
        console.log('edit category page error:  ',error)
        res.render('pageerror')
        
    }
}
 
const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        
        if (!categoryName.trim() || !description.trim()) {
            return res.render("edit-category", {
                category: await Category.findById(id), 
                error: "Category Name and Description cannot be empty!",
            });
        }

        const existingCategory = await Category.findOne({ name: categoryName });

         
        if (existingCategory && existingCategory._id.toString() !== id) {
            return res.render("edit-category", {
                category: await Category.findById(id), 
                error: "Category already exists, please choose another name!",
            });
        }

        const updateCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description },
            { new: true }
        );

        if (updateCategory) {
            return res.redirect("/admin/category");
        } else {
            return res.render("edit-category", {
                category: await Category.findById(id), 
                error: "Category not found!",
            });
        }
    } catch (error) {
        console.log("Error in edit category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};



module.exports={
    categoryInfo,
    addCategory,
    addOffer,
    removeOffer,
    getlistCategory,
    getUnlistCategory,
    geteditCategory,
    editCategory
}