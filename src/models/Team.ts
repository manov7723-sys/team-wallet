/**
 * @module Team Model
 *
 * Represents a multisig team wallet in the database.
 * Stores the on-chain wallet address, display metadata (name, description,
 * image), vote threshold, active status, and the full member roster with
 * per-member role flags (isOwner, hasVoter, hasContributor).
 * Soft-delete is handled via the isActive flag rather than hard deletes.
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITeamMember {
  key: string;
  name?: string;
  avatar?: string;
  isOwner: boolean;
  hasVoter: boolean;
  hasContributor: boolean;
  addedAt: Date;
}

export interface ITeam extends Document {
  teamWalletAddress: string;
  name: string;
  description?: string;
  image?: string;
  owner: string;
  members: ITeamMember[];
  threshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, trim: true, maxlength: 50 },
    avatar: { type: String, trim: true },
    isOwner: { type: Boolean, default: false },
    hasVoter: { type: Boolean, default: true },
    hasContributor: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TeamSchema = new Schema<ITeam>(
  {
    teamWalletAddress: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 32 },
    description: { type: String, trim: true, maxlength: 500 },
    image: { type: String, trim: true },
    owner: { type: String, required: true, trim: true, index: true },
    members: { type: [TeamMemberSchema], default: [] },
    threshold: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "teams" }
);

TeamSchema.index({ "members.key": 1 });

export const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>("Team", TeamSchema);
export default Team;
