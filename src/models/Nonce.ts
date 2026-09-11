import mongoose, { Schema, Document, Model } from "mongoose";

export interface INonce extends Document {
  nonce: string;
  message: string;
  expiresAt: Date;
  createdAt: Date;
}

const NonceSchema = new Schema<INonce>(
  {
    nonce: { type: String, required: true, unique: true, index: true },
    message: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "nonces" }
);

NonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Nonce: Model<INonce> =
  mongoose.models.Nonce || mongoose.model<INonce>("Nonce", NonceSchema);

export default Nonce;
