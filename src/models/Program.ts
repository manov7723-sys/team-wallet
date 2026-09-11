/**
 * @module Program Model
 *
 * Persists Solana program records tracked under a team wallet.
 * Stores the programId, human-readable metadata (name, description),
 * the wallet that added it, and a chronological upgrade log containing
 * buffer addresses, notes, proposal keys, and execution signatures.
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUpgradeLog {
  bufferAddress: string;
  notes?: string;
  proposalKey?: string;
  signature?: string;
  proposedBy: string;
  executedAt?: Date;
}

export interface IProgram extends Document {
  programId: string;
  teamWalletAddress: string;
  name: string;
  description?: string;
  addedBy: string;
  upgradeLogs: IUpgradeLog[];
  createdAt: Date;
  updatedAt: Date;
}

const UpgradeLogSchema = new Schema<IUpgradeLog>(
  {
    bufferAddress: { type: String, required: true },
    notes: { type: String, maxlength: 500 },
    proposalKey: { type: String },
    signature: { type: String },
    proposedBy: { type: String, required: true },
    executedAt: { type: Date },
  },
  { _id: true, timestamps: false }
);

const ProgramSchema = new Schema<IProgram>(
  {
    programId: { type: String, required: true, unique: true, trim: true },
    teamWalletAddress: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 64 },
    description: { type: String, trim: true, maxlength: 500 },
    addedBy: { type: String, required: true, trim: true },
    upgradeLogs: { type: [UpgradeLogSchema], default: [] },
  },
  { timestamps: true, collection: "programs" }
);

ProgramSchema.index({ teamWalletAddress: 1, createdAt: -1 });

export const Program: Model<IProgram> =
  mongoose.models.Program || mongoose.model<IProgram>("Program", ProgramSchema);

export default Program;
