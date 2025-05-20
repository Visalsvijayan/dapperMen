const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://dappermens.shop/auth/google/callback", // Ensure this matches Google Console
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

         user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Link this Google account to the existing user
          user.googleId = profile.id;
          await user.save();
          return done(null, user);
        }
        const referralCode = await generateReferralCode(profile.displayName);
            user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            referralCode:referralCode
        });

        await user.save();
           
        return done(null, user);
        
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

const generateReferralCode = async (name) => {
  const firstName = name.trim().split(' ')[0].toUpperCase();
  let referralCode;
  let exists = true;

  while (exists) {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    referralCode = `${firstName}-${randomStr}`;
    exists = await User.exists({ referralCode });
  }
  console.log('ref:',referralCode)
  return referralCode;

};



module.exports = passport;
