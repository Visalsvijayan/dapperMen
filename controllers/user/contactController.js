const env=require('dotenv').config();
const nodemailer=require('nodemailer')
const User=require('../../models/userSchema')
const statusCodes=require('../../config/statusCode')
const getContactPage=async(req,res)=>{
    try {
        const user=req.session.user;
        if(user){
            let userExist=await User.findOne({_id:user})
            if(!userExist|| userExist.isBlocked){
                req.session.destroy();
                res.redirect('/login')
            }
        }
        res.render('contactPage',{selectPage:'contact'})
    } catch (error) {
        res.status(statusCodes.INTERNAL_SERVER_ERROR).redirect('/pageNotFound');
        
    }
}

const transporter=nodemailer.createTransport({
    service:'gmail',
    auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD
    }
})

const contactMessageSend=async(req,res)=>{
    const{name,email,subject,message}=req.body
    
    //mail to admin
    const adminMail={
        from:email,
        to:process.env.NODEMAILER_EMAIL,
        subject: `New Contact Message: ${subject}`,
        text: `You got a new message from:\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    }
    //auto reply to the user
    const autoReply = {
        from:process.env.NODEMAILER_EMAIL,
        to: email,
        subject: 'Thank you for contacting us!',
        text: `Hi ${name},\n\nThank you for reaching out to us. We have received your message and will respond within 24 hours.\n\nBest regards,\ndapperMen Team`
    }
    try {
        await transporter.sendMail(adminMail);    // Send to admin
        await transporter.sendMail(autoReply);    // Auto-reply to user
        res.status(statusCodes.SUCCESS).json({success:true})
        
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({success:false})
    }
}

const aboutPage=async(req,res)=>{
    try {
        const user=req.session.user;
        if(user){
            let userExist=await User.findOne({_id:user})
            if(!userExist|| userExist.isBlocked){
                req.session.destroy();
                res.redirect('/login')
            }
        }
        res.render('about',{selectPage:'about'})
    } catch (error) {
        res.status(statusCodes.INTERNAL_SERVER_ERROR).redirect('/pageNotFound');
    }
}

module.exports={
    getContactPage,
    contactMessageSend,
    aboutPage
}