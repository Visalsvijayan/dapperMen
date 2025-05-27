const express=require('express');
const app=express();
const nodemon=require('nodemon')
const path=require('path');
const nocache=require('nocache')
const env=require('dotenv').config();
const session=require('express-session')
const connectDB=require('./config/db');
const cartCountMiddleware=require('./middlewares/cartCount')
const MongoStore = require('connect-mongo');

 

const passport=require('./config/passport')
const userRouter=require('./routes/userRouter')
const adminRouter=require('./routes/adminRouter');
 
connectDB();
 
app.use(express.json());
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,  
        ttl: 14 * 24 * 60 * 60 
    }),
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day (in ms)
    }
}));


 
// app.use(nocache());  
app.use(passport.initialize())
app.use(passport.session())

app.use((req, res, next) => {
     
    res.locals.user = req.user || req.session.user || null;
    next();
});
 
app.set("view engine","ejs");
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')])
// app.use(express.static(path.join(__dirname,'public')))
app.use(cartCountMiddleware)
app.use('/',userRouter)
app.use('/admin',adminRouter)
//middleware to handle the error routes in admin side
app.use('/admin/*',(req,res)=>{
    res.status(404).render('pageerror')
})
//middleware to handle the error routes in user side
app.use('*', (req, res) => {
    res.status(404).render('page-404'); 
}); 


 
 
app.listen(process.env.PORT,()=>console.log('server started'))
module.exports=app;
