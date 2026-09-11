/**
 * @module ProposalLog Model
 *
 * Records the on-chain execution of a proposal for audit and UI purposes.
 * Maps a proposal account public key to the transaction signature and the
 * wallet address of the executor. Indexed on both proposalKey (unique)
 * and teamWalletAddress + createdAt for efficient team-scoped lookups.
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProposalLog extends Document {
  proposalKey: string;
  teamWalletAddress: string;
  signature: string;
  executedBy: string;
  createdAt: Date;
}

const ProposalLogSchema = new Schema<IProposalLog>(
  {
    proposalKey: { type: String, required: true, unique: true, index: true },
    teamWalletAddress: { type: String, required: true, index: true },
    signature: { type: String, required: true },
    executedBy: { type: String, required: true },
  },
  { timestamps: true, collection: "proposal_logs" }
);

ProposalLogSchema.index({ teamWalletAddress: 1, createdAt: -1 });

export const ProposalLog: Model<IProposalLog> =
  mongoose.models.ProposalLog || mongoose.model<IProposalLog>("ProposalLog", ProposalLogSchema);

export default ProposalLog;
