/**
 * @module User Model
 *
 * Represents an authenticated user identified by their Solana wallet address.
 * Stores optional profile data (name, avatar, email, bio), a hashed refresh
 * token for secure JWT rotation, and lastLoginAt for activity tracking.
 * Indexed on walletAddress (unique) for fast lookups on every auth request.
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  walletAddress: string;
  name?: string;
  avatar?: string;
  email?: string;
  bio?: string;
  refreshTokenHash?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    walletAddress: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, trim: true, maxlength: 50 },
    avatar: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    bio: { type: String, trim: true, maxlength: 500 },
    refreshTokenHash: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: "users" }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
