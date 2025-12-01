import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  email: string;
  password?: string;
  companyName?: string;
  companyType?: string;
  website?: string;
  language?: string;
  timezone?: string;
  avatar?: string;
  subscription: {
    plan: "none" | "basic" | "pro" | "enterprise" | "trial" | "professional"; // added trial/pro to types
    startDate?: Date;
    endDate?: Date;
    isActive: boolean;
    stripeCustomerId?: string;
  };
  googleId?: string;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema: Schema<IUser> = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      // Not required for Google OAuth users
    },
    companyName: {
      type: String,
      trim: true,
    },
    companyType: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    language: {
      type: String,
      default: "en",
    },
    timezone: {
      type: String,
    },
    avatar: {
      type: String, // URL to the avatar image
    },
    subscription: {
      plan: {
        type: String,
        enum: ["none", "trial", "professional", "enterprise"],
        default: "none",
      },
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      isActive: {
        type: Boolean,
        default: false,
      },
      stripeCustomerId: {
        type: String,
      }
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple documents to have a null value for this field
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password before saving
userSchema.pre<IUser>("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
    if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model<IUser>("User", userSchema);

export default User;
