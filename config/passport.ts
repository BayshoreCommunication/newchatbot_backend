import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User, { IUser } from "../models/userModel";

const configurePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: "/api/auth/google/callback",
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists in our database
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // If user exists, return user
            return done(null, user);
          }

          // If user doesn't exist, check if the email is already in use
          const email = profile.emails && profile.emails[0].value;
          if (!email) {
            return done(new Error("Email not found in Google profile"), undefined);
          }
          
          user = await User.findOne({ email: email });

          if (user) {
            // If email is in use by a local account, link the Google ID
            user.googleId = profile.id;
            user.avatar = user.avatar || (profile.photos && profile.photos[0].value);
            await user.save();
            return done(null, user);
          }

          // If no user exists, create a new one
          const newUser = new User({
            googleId: profile.id,
            email: email,
            companyName: profile.displayName, // A sensible default
            avatar: profile.photos && profile.photos[0].value,
            subscription: {
                plan: 'none',
                isActive: false
            }
          });

          await newUser.save();
          done(null, newUser);
        } catch (error: any) {
          done(error, undefined);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};

export default configurePassport;
