/**
 * @module Token Model
 *
 * Persists SPL Token-2022 records created or imported by a team wallet.
 * Stores mint address, on-chain metadata (name, symbol, decimals,
 * initialSupply, metadataUri, imageUrl), token type (fungible / NFT),
 * whether it was imported vs created in-app, and optional Token-2022
 * extension config (transfer fee, non-transferable, interest-bearing).
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITokenExtensions {
  transferFee?: { bps: number };
  nonTransferable?: boolean;
  interestBearing?: { rate: number };
}

export interface IToken extends Document {
  mintAddress: string;
  teamWalletAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  tokenType: "fungible" | "nft";
  initialSupply: string;
  metadataUri: string;
  imageUrl: string;
  description?: string;
  extensions: ITokenExtensions;
  createdBy: string;
  imported: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TokenExtensionsSchema = new Schema<ITokenExtensions>(
  {
    transferFee: {
      type: { bps: { type: Number } },
      default: undefined,
    },
    nonTransferable: { type: Boolean },
    interestBearing: {
      type: { rate: { type: Number } },
      default: undefined,
    },
  },
  { _id: false }
);

const TokenSchema = new Schema<IToken>(
  {
    mintAddress: { type: String, required: true, unique: true, trim: true },
    teamWalletAddress: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 32 },
    symbol: { type: String, required: true, trim: true, maxlength: 10 },
    decimals: { type: Number, required: true, min: 0, max: 9 },
    tokenType: { type: String, required: true, enum: ["fungible", "nft"] },
    initialSupply: { type: String, default: "0" },
    metadataUri: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    description: { type: String, trim: true, maxlength: 500 },
    extensions: { type: TokenExtensionsSchema, default: {} },
    createdBy: { type: String, required: true, trim: true },
    imported: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "managed_tokens" }
);

TokenSchema.index({ teamWalletAddress: 1, createdAt: -1 });

export const Token: Model<IToken> =
  mongoose.models.Token || mongoose.model<IToken>("Token", TokenSchema);

export default Token;
